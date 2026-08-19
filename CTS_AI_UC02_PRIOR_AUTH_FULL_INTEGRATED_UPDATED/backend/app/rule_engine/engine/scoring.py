"""
engine/scoring.py

Turns triggered rules + flat normalized data into the four scored
result blocks: criticality, priority, medical_necessity, authorization.

Accumulation strategy (deliberately simple and auditable — no ML here):
  criticality_score  = severity baseline + sum(criticality_support)
  priority_score     = f(final criticality level) + sum(priority_support)
  necessity_score    = neutral base + sum(medical_necessity_support)
                        (or force_medical_necessity_status wins outright)
  authorization       = derived from policy context, overridable by any
                        rule's explicit authorization_required action

Priority is deliberately computed FROM criticality's *level* (not its raw
score) plus its own independent adjustments — this is what allows
criticality and priority to diverge instead of just mirroring each other.
"""

from __future__ import annotations

from typing import Any

from ..rules import (
    MEDICAL_NECESSITY_BASE_SCORE,
    baseline_score_for_criticality,
    baseline_score_for_severity,
    criticality_score_to_level,
    derive_authorization_required,
    medical_necessity_score_to_status,
    priority_score_to_level,
)


def _clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def compute_scores(flat_data: dict[str, Any], triggered_rules: list[dict]) -> dict:
    """
    Returns a dict shaped like:
        {
          "criticality": {"level": ..., "score": ...},
          "priority": {"level": ..., "score": ...},
          "medical_necessity": {"status": ..., "score": ...},
          "authorization": {"required": ...},
          "force_decision": <str | None>,   # internal only, NOT part of the
                                             # output schema — decision.py
                                             # reads this, rule_engine.py
                                             # strips it before building
                                             # EngineOutput.
        }
    """
    criticality_score = baseline_score_for_severity(flat_data.get("severity", "moderate"))
    priority_extra = 0.0
    necessity_score = MEDICAL_NECESSITY_BASE_SCORE
    force_necessity_status: str | None = None
    force_decision: str | None = None
    authorization_required = derive_authorization_required(flat_data)

    for rule in triggered_rules:
        action = rule["action"]

        criticality_score += action.get("criticality_support", 0.0)
        priority_extra += action.get("priority_support", 0.0)
        necessity_score += action.get("medical_necessity_support", 0.0)

        if "authorization_required" in action:
            authorization_required = action["authorization_required"]

        if "force_medical_necessity_status" in action:
            force_necessity_status = action["force_medical_necessity_status"]

        if "force_decision" in action:
            force_decision = action["force_decision"]

    # --- Criticality ---
    criticality_score = _clamp(criticality_score)
    criticality_level = criticality_score_to_level(criticality_score)

    # --- Priority (seeded from criticality LEVEL, then own adjustments) ---
    priority_baseline = baseline_score_for_criticality(criticality_level)
    priority_score = _clamp(priority_baseline + priority_extra)
    priority_level = priority_score_to_level(priority_score)

    # --- Medical necessity ---
    necessity_score = _clamp(necessity_score)
    necessity_status = (
        force_necessity_status
        if force_necessity_status is not None
        else medical_necessity_score_to_status(necessity_score)
    )

    return {
        "criticality": {"level": criticality_level, "score": round(criticality_score, 2)},
        "priority": {"level": priority_level, "score": round(priority_score, 2)},
        "medical_necessity": {"status": necessity_status, "score": round(necessity_score, 2)},
        "authorization": {"required": authorization_required},
        "force_decision": force_decision,
    }