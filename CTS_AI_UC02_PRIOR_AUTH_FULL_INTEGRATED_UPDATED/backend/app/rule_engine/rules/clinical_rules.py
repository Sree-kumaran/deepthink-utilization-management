"""
rules/clinical_rules.py

Clinical-category constants and pure helper functions.

These mirror the numeric thresholds used inside rule_config.json (R003,
R008, R009, R011). They are NOT read by the generic evaluator — the
evaluator only reads rule_config.json. They exist so:

  1. The "why 12 weeks / why 6 weeks / why 0.9" numbers have one documented
     home instead of being unexplained magic numbers in JSON.
  2. tests/test_rule_engine.py and any future reporting/UI code can import
     these instead of hardcoding the same numbers a second time.

IMPORTANT: if you change a threshold here, you must also update the
matching value in rule_config.json — the JSON is the actual source of
truth the evaluator runs against. These constants are documentation +
reuse, not live configuration.
"""

from __future__ import annotations

# Mirrors R008 in rule_config.json — symptom duration considered "chronic"
CHRONIC_SYMPTOM_DURATION_WEEKS: int = 12

# Mirrors R009 in rule_config.json — physical therapy duration considered
# a genuine, extended conservative-treatment attempt (not just a token PT visit)
EXTENDED_CONSERVATIVE_TREATMENT_WEEKS: int = 6

# Mirrors R007 in rule_config.json — retrieved evidence relevance score
# considered "strong" support for medical necessity
STRONG_EVIDENCE_RELEVANCE_THRESHOLD: float = 0.9


def is_chronic(symptom_duration_weeks: int) -> bool:
    """True if symptom duration meets the 'chronic' bar (R008)."""
    return symptom_duration_weeks >= CHRONIC_SYMPTOM_DURATION_WEEKS


def is_extended_conservative_treatment(
    physical_therapy: bool, physical_therapy_duration_weeks: int
) -> bool:
    """True if PT was actually done AND ran long enough to count (R009)."""
    return (
        physical_therapy
        and physical_therapy_duration_weeks >= EXTENDED_CONSERVATIVE_TREATMENT_WEEKS
    )


def is_strong_evidence(max_relevance_score: float) -> bool:
    """True if the best retrieved-evidence relevance score is 'strong' (R007)."""
    return max_relevance_score >= STRONG_EVIDENCE_RELEVANCE_THRESHOLD