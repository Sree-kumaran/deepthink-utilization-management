"""
schemas/rag_context.py

Input B — RAG Context.

Treated as already-retrieved structured knowledge. The RuleEngine does not
know or care whether this dict was produced by a real RAG pipeline, a
JSON file, or a mock — it just consumes the shape below.

`extra="allow"` on every nested model so a real RAG layer can add fields
later (e.g. `referral_required`, free-text `evidence`) without breaking
this contract.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class PolicyContext(BaseModel):
    model_config = ConfigDict(extra="allow")

    prior_authorization_required: bool
    medical_necessity_required: bool


class ClinicalContext(BaseModel):
    model_config = ConfigDict(extra="allow")

    severity: Literal["low", "moderate", "high", "critical"]
    red_flag_symptoms: bool
    functional_impairment: bool | None = None


class PriorTreatment(BaseModel):
    model_config = ConfigDict(extra="allow")

    conservative_treatment_failed:  bool | None = None


class RetrievedEvidence(BaseModel):
    model_config = ConfigDict(extra="allow")

    source: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    evidence: Optional[str] = None


class RagContext(BaseModel):
    model_config = ConfigDict(extra="allow")

    policy_context: PolicyContext
    clinical_context: ClinicalContext
    prior_treatment: PriorTreatment
    retrieved_evidence: List[RetrievedEvidence] = Field(default_factory=list)