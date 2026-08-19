from __future__ import annotations
from typing import Any


from pydantic import BaseModel, Field


class PolicyContext(BaseModel):
    prior_authorization_required: bool
    medical_necessity_required: bool


class ClinicalContext(BaseModel):
    severity: str | None = None
    red_flag_symptoms: bool | None = None
    functional_impairment: bool | None = None


class PriorTreatment(BaseModel):
    conservative_treatment_failed: bool | None = None


class RetrievedEvidence(BaseModel):
    source: str
    relevance_score: float = Field(
        ge=0.0,
        le=1.0,
    )

class RAGQueryRequest(BaseModel):
    question: str = Field(
        ...,
        min_length=1,
    )

    requested_service: str | None = None

    patient_context: dict[str, Any] = Field(
        default_factory=dict,
    )

    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
    )
class RAGResponse(BaseModel):
    policy_context: PolicyContext
    clinical_context: ClinicalContext
    prior_treatment: PriorTreatment
    retrieved_evidence: list[RetrievedEvidence]