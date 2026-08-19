from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.services.extraction_service import extraction_service
from app.services.inference_client import InferenceClient, inference_client
from app.services.authorization_service import AuthorizationService


EXPECTED_61_FEATURES = [
    "FIPS",
    "ZIP",
    "LON",
    "HEALTHCARE_EXPENSES",
    "HEALTHCARE_COVERAGE",
    "INCOME",
    "encounter_count",
    "encounter_type_count",
    "unique_encounter_count",
    "condition_count",
    "unique_condition_count",
    "medication_count",
    "unique_medication_count",
    "procedure_count",
    "unique_procedure_count",
    "careplan_count",
    "unique_careplan_count",
    "allergy_count",
    "device_count",
    "unique_device_count",
    "immunization_count",
    "unique_immunization_count",
    "claim_count",
    "unique_claim_diagnosis_count",
    "PREFIX_Mrs.",
    "PREFIX_Ms.",
    "PREFIX_Unknown",
    "SUFFIX_MD",
    "SUFFIX_PhD",
    "SUFFIX_Unknown",
    "MARITAL_M",
    "MARITAL_S",
    "MARITAL_Unknown",
    "MARITAL_W",
    "RACE_black",
    "RACE_hawaiian",
    "RACE_native",
    "RACE_other",
    "RACE_white",
    "ETHNICITY_nonhispanic",
    "GENDER_M",
    "COUNTY_Berkshire County",
    "COUNTY_Bristol County",
    "COUNTY_Dukes County",
    "COUNTY_Essex County",
    "COUNTY_Franklin County",
    "COUNTY_Hampden County",
    "COUNTY_Hampshire County",
    "COUNTY_Middlesex County",
    "COUNTY_Nantucket County",
    "COUNTY_Norfolk County",
    "COUNTY_Plymouth County",
    "COUNTY_Suffolk County",
    "COUNTY_Worcester County",
    "CITY_FREQUENCY",
    "age",
    "coverage_expense_ratio",
    "medication_per_encounter",
    "procedure_per_encounter",
    "condition_per_encounter",
    "claim_per_encounter",
]


def test_extraction_service_produces_all_61_canonical_features():
    patient = {
        "patient_id": "P-1001",
        "patient_name": "John Doe",
        "age": 53,
        "gender": "M",
        "prefix": "Mr.",
        "marital": "M",
        "race": "white",
        "ethnicity": "nonhispanic",
        "county": "Suffolk County",
        "diagnoses": ["Tear of meniscus of right knee"],
        "medications": ["Ibuprofen"],
    }
    clinical = {
        "diagnosis": "Tear of meniscus of right knee",
        "indication": "Knee pain",
        "symptoms": ["Pain", "Swelling"],
        "prior_treatment": ["Physical therapy"],
        "symptom_duration_weeks": 8,
    }
    service = {
        "service_name": "MRI Right Knee",
    }
    plan = {
        "plan_name": "Demo Payer",
    }

    features, summary = extraction_service.build_features_for_authorization(
        patient=patient,
        clinical=clinical,
        service=service,
        plan=plan,
    )

    assert len(features) == 61
    assert set(features.keys()) == set(EXPECTED_61_FEATURES)
    for k, v in features.items():
        assert isinstance(v, (int, float))
    assert "John Doe" not in summary
    assert "53-year-old" in summary


@pytest.mark.asyncio
async def test_inference_client_handles_offline_gracefully():
    client = InferenceClient(base_url="http://invalid-host-that-does-not-exist:9999")
    health = await client.health()
    assert health["status"] in ("offline", "unhealthy")


@pytest.mark.asyncio
async def test_authorization_evaluation_integrates_inference_assessment():
    auth_service = AuthorizationService()
    db = AsyncMock()

    mock_request = MagicMock()
    mock_request.id = "req-123"
    mock_request.patient = {
        "patient_id": "P-1001",
        "age": 45,
        "gender": "M",
        "death_date": "2026-01-01",
        "details": "Full clinical notes",
        "diagnoses": ["Tear of meniscus of right knee"],
        "medications": ["Ibuprofen"],
    }
    mock_request.clinical = {
        "diagnosis": "Tear of meniscus of right knee",
        "indication": "Knee pain",
        "symptoms": ["Pain"],
        "prior_treatment": ["Physical therapy"],
        "symptom_duration_weeks": 12,
        "physical_therapy": True,
        "physical_therapy_duration_weeks": 8,
        "medication_tried": True,
        "details": "Full clinical notes",
    }
    mock_request.service = {"service_name": "MRI Right Knee"}
    mock_request.plan = {"plan_id": "PLAN01", "plan_name": "UHC"}
    mock_request.documents = []
    mock_request.missing_information = []
    mock_request.conflicting_information = []

    mock_policy = MagicMock()
    mock_policy.id = "POL-01"
    mock_policy.name = "MRI Knee Policy"
    mock_policy.active_version = "v1.0"

    mock_pv = MagicMock()
    mock_pv.policy_id = "POL-01"
    mock_pv.version = "v1.0"
    mock_pv.status = "ACTIVE"

    db.get.side_effect = lambda model, id_: mock_request if "AuthorizationRequest" in str(model) else mock_policy
    db.scalar.return_value = mock_pv

    mock_evidence = [
        {
            "policy_id": "POL-01",
            "version": "v1.0",
            "score": 0.9,
            "text": "MRI Knee Prior Authorization Required. Conservative therapy criteria apply.",
        }
    ]

    mock_assessment_result = {
        "patient_id": "P-1001",
        "final_decision": "Approve",
        "authorization_required": True,
        "ai_assessment": {
            "xgboost_prediction": {
                "priority_class": 1,
                "priority_label": "MEDIUM",
                "criticality_score": 0.42,
            },
            "llm_explanation": "Assistive ML: Conservative therapy duration satisfies criteria.",
        },
        "human_review": {"required": False, "reason": "No gaps."},
        "governance_note": "Rule Engine is authoritative.",
    }

    with patch("app.services.authorization_service.rag_service.retrieve_policy_evidence", new=AsyncMock(return_value=mock_evidence)), \
         patch.object(inference_client, "assess", new=AsyncMock(return_value=mock_assessment_result)), \
         patch("app.services.authorization_service.record_audit", new=AsyncMock()) as mock_audit:

        trace = await auth_service.evaluate(db, "req-123", "POL-01", "v1.0")

        assert trace["decision"] == "APPROVE"
        assert trace["ai_assessment"]["xgboost_prediction"]["priority_label"] == "MEDIUM"
        assert trace["llm_explanation"] == "Assistive ML: Conservative therapy duration satisfies criteria."
        assert mock_audit.called
        # Check audit payload
        audit_call_args = mock_audit.call_args[0]
        audit_payload = audit_call_args[3]
        assert audit_payload["decision"] == "APPROVE"
        assert "ai_assessment" in audit_payload
        assert len(audit_payload["features"]) == 61


@pytest.mark.asyncio
async def test_trace_allows_null_decision_for_pending_nurse_review():
    auth_service = AuthorizationService()
    db = AsyncMock()

    mock_request = MagicMock()
    mock_request.id = "req-pending"
    mock_request.decision = None
    mock_request.status = "PENDING_NURSE_REVIEW"

    db.get.return_value = mock_request

    mock_exec_result = MagicMock()
    mock_exec_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_exec_result
    db.scalar.return_value = None

    trace = await auth_service.trace(db, "req-pending")

    assert trace["request_id"] == "req-pending"
    assert trace["decision"] is None


@pytest.mark.asyncio
async def test_evaluation_request_more_information_outcome():
    auth_service = AuthorizationService()
    db = AsyncMock()

    mock_request = MagicMock()
    mock_request.id = "req-missing-info"
    mock_request.patient = {"patient_id": "P-1001", "age": 45, "death_date": "2026-01-01", "details": "Notes"}
    mock_request.clinical = {"diagnosis": "", "indication": "", "details": "Notes"}  # missing diagnosis/indication
    mock_request.service = {"service_name": "MRI Knee"}
    mock_request.plan = {"plan_id": "PLAN01", "plan_name": "UHC"}
    mock_request.documents = []
    mock_request.missing_information = ["clinical.diagnosis_or_indication"]
    mock_request.conflicting_information = []

    mock_policy = MagicMock()
    mock_policy.id = "POL-01"
    mock_policy.name = "MRI Knee Policy"
    mock_policy.active_version = "v1.0"
    mock_pv = MagicMock(status="ACTIVE")

    db.get.side_effect = lambda model, id_: mock_request if "AuthorizationRequest" in str(model) else mock_policy
    db.scalar.return_value = mock_pv

    mock_evidence = [{"policy_id": "POL-01", "version": "v1.0", "score": 0.9, "text": "Prior Authorization Required"}]

    with patch("app.services.authorization_service.rag_service.retrieve_policy_evidence", new=AsyncMock(return_value=mock_evidence)), \
         patch.object(inference_client, "assess", new=AsyncMock(return_value={})), \
         patch("app.services.authorization_service.record_audit", new=AsyncMock()):

        trace = await auth_service.evaluate(db, "req-missing-info", "POL-01", "v1.0")

        assert trace["decision"] == "REQUEST_MORE_INFORMATION"
        assert mock_request.status == "AWAITING_MORE_INFORMATION"


@pytest.mark.asyncio
async def test_evaluation_pending_nurse_review_when_death_date_missing():
    auth_service = AuthorizationService()
    db = AsyncMock()

    mock_request = MagicMock()
    mock_request.id = "req-nurse-review"
    mock_request.patient = {"patient_id": "P-1001", "age": 45, "death_date": None, "details": "Complete notes"}
    mock_request.clinical = {
        "diagnosis": "Tear of meniscus",
        "indication": "Knee pain",
        "details": "Complete notes",
        "symptom_duration_weeks": 8,
        "physical_therapy": True,
        "physical_therapy_duration_weeks": 8,
        "medication_tried": True,
        "prior_treatment": ["PT"],
    }
    mock_request.service = {"service_name": "MRI Knee"}
    mock_request.plan = {"plan_id": "PLAN01", "plan_name": "UHC"}
    mock_request.documents = []
    mock_request.missing_information = []
    mock_request.conflicting_information = []

    mock_policy = MagicMock(id="POL-01", name="Policy", active_version="v1.0")
    mock_pv = MagicMock(status="ACTIVE")

    db.get.side_effect = lambda model, id_: mock_request if "AuthorizationRequest" in str(model) else mock_policy
    db.scalar.side_effect = [mock_pv, None]  # mock_pv for PolicyVersion, None for existing NurseReview

    mock_evidence = [{"policy_id": "POL-01", "version": "v1.0", "score": 0.9, "text": "Prior Authorization Required. Medical necessity."}]

    with patch("app.services.authorization_service.rag_service.retrieve_policy_evidence", new=AsyncMock(return_value=mock_evidence)), \
         patch.object(inference_client, "assess", new=AsyncMock(return_value={})), \
         patch("app.services.authorization_service.record_audit", new=AsyncMock()):

        trace = await auth_service.evaluate(db, "req-nurse-review", "POL-01", "v1.0")

        assert trace["decision"] == "PEND_FOR_NURSE_REVIEW"
        assert mock_request.status == "PENDING_NURSE_REVIEW"

