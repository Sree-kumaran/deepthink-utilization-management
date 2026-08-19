"""
rules/priority_rules.py

Priority represents how quickly the claim/authorization should be
PROCESSED — not how clinically urgent the patient's condition is. It
takes criticality as one input signal but is computed independently, so
it must be able to diverge from criticality in either direction:

  - criticality=high,  priority=urgent  (red flag AND documentation ready)
  - criticality=high,  priority=normal  (severe but no processing urgency
    signal fired — e.g. no functional impairment, no missing docs)
  - criticality=low,   priority=high    (routine severity but functional
    impairment + missing-documentation rules push processing urgency up)

engine/scoring.py starts from CRITICALITY_TO_PRIORITY_BASELINE[criticality
level] and then adds every triggered rule's `priority_support` on top
(R004 functional impairment, R006 missing docs, R010 severity override,
etc.) before converting to a level via score_to_level below.
"""

from __future__ import annotations

from typing import Literal

PriorityLevel = Literal["low", "normal", "high", "urgent"]

# Baseline priority score seeded FROM the already-computed criticality
# level. This is intentionally a weaker signal than criticality's own
# thresholds (see the gaps) so that priority-specific rules (functional
# impairment, missing docs) can still move the needle independently
# rather than criticality mechanically determining priority.
CRITICALITY_TO_PRIORITY_BASELINE: dict[str, float] = {
    "low": 0.15,
    "moderate": 0.35,
    "high": 0.55,
    "critical": 0.70,
}

# Ordered highest-threshold-first, same pattern as criticality_rules.py.
PRIORITY_LEVEL_THRESHOLDS: list[tuple[float, PriorityLevel]] = [
    (0.75, "urgent"),
    (0.50, "high"),
    (0.25, "normal"),
    (0.00, "low"),
]


def baseline_score_for_criticality(criticality_level: str) -> float:
    """Look up the starting priority score for a given criticality level."""
    return CRITICALITY_TO_PRIORITY_BASELINE.get(
        criticality_level, CRITICALITY_TO_PRIORITY_BASELINE["moderate"]
    )


def score_to_level(score: float) -> PriorityLevel:
    """Convert a final (clamped 0.0-1.0) priority score into a discrete level."""
    clamped = max(0.0, min(1.0, score))
    for threshold, level in PRIORITY_LEVEL_THRESHOLDS:
        if clamped >= threshold:
            return level
    return "low"  # unreachable given the 0.00 floor entry, kept for safety