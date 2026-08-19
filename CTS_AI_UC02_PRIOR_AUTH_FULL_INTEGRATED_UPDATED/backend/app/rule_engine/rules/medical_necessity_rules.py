"""
rules/medical_necessity_rules.py

Medical necessity starts from a neutral baseline (neither supported nor
unsupported) and moves based on triggered rules' `medical_necessity_support`
values (R002 failed conservative treatment, R003 clinical indication,
R007 strong evidence, R009 extended PT) or gets force-set outright by
R011 (missing clinical indication -> not_supported) via
`force_medical_necessity_status` — force wins over the score entirely,
handled in engine/scoring.py.

Three status bands, deliberately with real room for the middle band:
  - score too low or evidence too thin           -> not_supported
  - some support but not enough to be confident   -> insufficient_information
  - clear supporting evidence accumulated          -> supported
"""

from __future__ import annotations

from typing import Literal

MedicalNecessityStatus = Literal[
    "supported", "not_supported", "insufficient_information"
]

# Neutral starting point. Nothing has been confirmed or denied yet — every
# triggered rule's medical_necessity_support (positive or negative) is
# added on top of this by engine/scoring.py.
BASE_SCORE: float = 0.40

# Ordered highest-threshold-first, same pattern as criticality/priority.
STATUS_THRESHOLDS: list[tuple[float, MedicalNecessityStatus]] = [
    (0.65, "supported"),
    (0.30, "insufficient_information"),
    (0.00, "not_supported"),
]


def score_to_status(score: float) -> MedicalNecessityStatus:
    """Convert a final (clamped 0.0-1.0) necessity score into a discrete status."""
    clamped = max(0.0, min(1.0, score))
    for threshold, status in STATUS_THRESHOLDS:
        if clamped >= threshold:
            return status
    return "not_supported"  # unreachable given the 0.00 floor entry