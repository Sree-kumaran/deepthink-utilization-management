from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import Decision


class PatientData(BaseModel):
    model_config = ConfigDict(extra="allow")

    patient_id: str | None = None
    patient_name: str | None = None
    age: int | None = Field(default=None, ge=0, le=130)
    sex: str | None = None
    diagnoses: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)
    history: list[str] = Field(default_factory=list)


class ProviderData(BaseModel):
    model_config = ConfigDict(extra="allow")

    provider_id: str | None = None
    name: str | None = None
    specialty: str | None = None
    organization: str | None = None


class PlanData(BaseModel):
    model_config = ConfigDict(extra="allow")

    plan_id: str | None = None
    plan_name: str | None = None
    member_id: str | None = None


class ServiceData(BaseModel):
    model_config = ConfigDict(extra="allow")

    service_code: str | None = None
    service_name: str
    category: str | None = None
    requested_date: str | None = None
    site_of_service: str | None = None


class ClinicalData(BaseModel):
    model_config = ConfigDict(extra="allow")

    diagnosis: str | None = None
    indication: str | None = None
    symptoms: list[str] = Field(default_factory=list)
    clinical_findings: list[str] = Field(default_factory=list)
    prior_treatment: list[str] = Field(default_factory=list)
    prior_tests: list[str] = Field(default_factory=list)
    symptom_duration_weeks: int | None = Field(default=None, ge=0)
    prior_treatment_duration_weeks: int | None = Field(default=None, ge=0)
    duration: str | None = None


class AuthorizationCreate(BaseModel):
    external_request_id: str | None = None
    patient: PatientData = Field(default_factory=PatientData)
    provider: ProviderData = Field(default_factory=ProviderData)
    plan: PlanData = Field(default_factory=PlanData)
    service: ServiceData
    clinical: ClinicalData = Field(default_factory=ClinicalData)
    documents: list[dict[str, Any]] = Field(default_factory=list)
    conflicting_information: list[str] = Field(default_factory=list)


class AuthorizationResponse(BaseModel):
    id: str
    external_request_id: str | None
    status: str
    decision: Decision | None
    patient: dict
    provider: dict
    plan: dict
    service: dict
    clinical: dict
    missing_information: list
    conflicting_information: list
    extraction_confidence: float | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RuleResultResponse(BaseModel):
    rule_id: str
    rule_name: str
    result: str
    expected: str | None
    actual: str | None
    reason: str
    evidence: dict


class DecisionTrace(BaseModel):
    request_id: str
    # A pending nurse-review request has no final decision yet.
    decision: Decision | None
    policy_id: str
    policy_version: str
    evaluated_rules: int
    passed_rules: int
    failed_rules: int
    missing_rules: int
    conflict_rules: int
    reasons: list[str]
    rule_results: list[RuleResultResponse]
    policy_evidence: list[dict] = Field(default_factory=list)

    # Integrated deterministic Rule Engine output
    criticality: dict = Field(default_factory=dict)
    priority: dict = Field(default_factory=dict)
    medical_necessity: dict = Field(default_factory=dict)
    authorization: dict = Field(default_factory=dict)
    triggered_rules: list[dict] = Field(default_factory=list)
    explanation: list[str] = Field(default_factory=list)

    # Inference Pipeline ML & LLM Assessment
    ai_assessment: dict | None = Field(default_factory=dict)
    xgboost_prediction: dict | None = Field(default_factory=dict)
    llm_explanation: str | None = None
    human_review: dict | None = Field(default_factory=dict)
    governance_note: str | None = None


# ============================================================
# Nurse Review Schemas
# ============================================================

class ReviewCreate(BaseModel):
    assigned_to: str | None = None
    notes: str | None = None


class ReviewComplete(BaseModel):
    reviewer_decision: Decision
    notes: str = Field(min_length=1, max_length=5000)


class ReviewResponse(BaseModel):
    id: str
    request_id: str
    status: str
    assigned_to: str | None
    reviewer_decision: Decision | None
    notes: str | None
    created_at: datetime
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)