from app.services.rule_engine_adapter import RuleEngineAdapter


def test_p001_style_knee_mri_rule_engine_integration():
    adapter = RuleEngineAdapter()

    output = adapter.evaluate(
        patient={
            "patient_id": "P001",
            "age": 46,
            "sex": "M",
            "diagnoses": ["Chronic knee pain"],
            "medications": ["Pain medication"],
        },
        plan={
            "plan_id": "PAYER001",
            "plan_name": "Demo Health Insurance",
        },
        service={"service_name": "MRI Knee"},
        clinical={
            "diagnosis": "Chronic knee pain",
            "indication": "Knee pain with functional limitation",
            "symptom_duration_weeks": 84,
            "physical_therapy": True,
            "physical_therapy_duration_weeks": 8,
            "medication_tried": True,
            "prior_treatment": ["Physical therapy", "Pain medication"],
        },
        policy_evidence=[
            {
                "policy_id": "UHC-MRI-KNEE-001",
                "version": "v1.0",
                "score": 0.836,
                "text": (
                    "MRI of the Knee. "
                    "Prior Authorization: Required. "
                    "Medical necessity criteria apply."
                ),
            }
        ],
    )

    result = output.rule_engine_result

    assert result.decision == "accept"
    assert result.authorization.required is True
    assert result.medical_necessity.status == "supported"

    rule_ids = {rule.rule_id for rule in output.triggered_rules}
    assert {"R003", "R004", "R005", "R008", "R009"} <= rule_ids
