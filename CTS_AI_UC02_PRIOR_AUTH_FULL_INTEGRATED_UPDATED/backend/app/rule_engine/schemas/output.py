"""
schemas/output.py

Strict output contract for the deterministic rule engine.
"""

from __future__ import annotations

from typing import List, Literal

from pydantic import BaseModel, ConfigDict, Field


class CriticalityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Literal["low", "moderate", "high", "critical"]
    score: float = Field(..., ge=0.0, le=1.0)


class PriorityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    level: Literal["low", "normal", "high", "urgent"]
    score: float = Field(..., ge=0.0, le=1.0)


class MedicalNecessityResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal[
        "supported",
        "not_supported",
        "insufficient_information",
    ]
    score: float = Field(..., ge=0.0, le=1.0)


class AuthorizationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    required: bool


class RuleEngineResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criticality: CriticalityResult
    priority: PriorityResult
    medical_necessity: MedicalNecessityResult
    authorization: AuthorizationResult
    decision: Literal[
        "accept",
        "nurse_review",
        "more_info_required",
    ]


class EvaluatedRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: str
    rule_name: str
    result: Literal["passed", "failed"]
    impact: str


class EngineOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: str
    rule_engine_result: RuleEngineResult

    # ALL configured rules.
    evaluated_rules: List[EvaluatedRule]

    # Only rules whose condition passed.
    triggered_rules: List[EvaluatedRule]

    explanation: List[str]