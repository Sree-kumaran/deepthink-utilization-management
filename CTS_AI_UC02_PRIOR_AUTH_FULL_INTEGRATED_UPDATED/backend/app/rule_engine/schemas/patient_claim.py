"""
schemas/patient_claim.py

Input A — Patient / Claim Features.

Source-independent by design: today this comes from a local JSON file,
later it may come from a FastAPI backend or a database. The RuleEngine
must not care. `extra="allow"` means any additional fields a future
source sends (e.g. new backend-derived features) will NOT break
validation — they simply ride along unused until the engine is
updated to read them.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class PatientClaim(BaseModel):
    model_config = ConfigDict(extra="allow")

    patient_id: str
    age: int = Field(..., ge=0, le=130)
    gender: str
    diagnosis: str
    requested_service: str
    symptom_duration_weeks: int = Field(..., ge=0)
    physical_therapy: bool
    physical_therapy_duration_weeks: int = Field(..., ge=0)
    medication_tried: bool
    clinical_indication: bool | None = None
    insurance_plan: str

    # Forward-compatible field. Not present in any current sample, but the
    # schema must accept it the moment a real backend starts sending it —
    # documentation_rules.py will read this once it's populated.
    required_documentation: Optional[List[str]] = None