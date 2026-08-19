"""
rules/criticality_rules.py

Criticality represents clinical urgency/severity — independent of how
fast the paperwork should move (that's priority_rules.py).

Two responsibilities, both pure/stateless:
  1. Map the RAG-provided `severity` string to a numeric baseline score.
  2. Map a final accumulated score (baseline + all triggered-rule
     `criticality_support` adjustments) back to a discrete level.

engine/scoring.py orchestrates the actual accumulation; this module only
holds the lookup tables and the pure conversion functions so the same
baseline/threshold logic isn't duplicated or drifted between callers
(including tests).
"""

from __future__ import annotations

from typing import Literal

CriticalityLevel = Literal["low", "moderate", "high", "critical"]

# Starting point before any rule adjustments are added. `severity` is a
# clinical-context field (Input B), not itself the final criticality —
# rules like R001 (red flag) and R008 (chronic duration) can still push
# the score up from here.
SEVERITY_BASELINE_SCORE: dict[str, float] = {
    "low": 0.15,
    "moderate": 0.35,
    "high": 0.60,
    "critical": 0.85,
}

# Ordered highest-threshold-first. First threshold the score clears wins.
# Chosen so a bare "moderate" severity (0.35) stays "moderate" on its own,
# but any safety-override rule firing (R001 +0.6, R010 +0.5) reliably
# pushes the level up to "high" or "critical" rather than getting lost
# in the middle of a band.
CRITICALITY_LEVEL_THRESHOLDS: list[tuple[float, CriticalityLevel]] = [
    (0.80, "critical"),
    (0.55, "high"),
    (0.30, "moderate"),
    (0.00, "low"),
]


def baseline_score_for_severity(severity: str) -> float:
    """Look up the starting criticality score for a given severity string."""
    return SEVERITY_BASELINE_SCORE.get(severity, SEVERITY_BASELINE_SCORE["moderate"])


def score_to_level(score: float) -> CriticalityLevel:
    """Convert a final (clamped 0.0-1.0) criticality score into a discrete level."""
    clamped = max(0.0, min(1.0, score))
    for threshold, level in CRITICALITY_LEVEL_THRESHOLDS:
        if clamped >= threshold:
            return level
    return "low"  # unreachable given the 0.00 floor entry, kept for safety