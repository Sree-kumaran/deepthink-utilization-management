"""
explanation/explanation_generator.py

Turns triggered_rules into human-readable sentences for EngineOutput.explanation.

Per the spec, this is derived ONLY from actual triggered rules — never
from raw patient/RAG data directly. If a rule didn't fire, it contributes
nothing, so the explanation always stays honest about what actually
influenced the decision.

Two-layer lookup:
  1. RULE_EXPLANATIONS  — specific, natural-language sentence per rule_id.
     This is what most triggered rules will hit, and gives much more
     readable output than a generic category message.
  2. IMPACT_FALLBACK    — generic "rule-impact -> sentence" map, used only
     if a rule_id isn't in RULE_EXPLANATIONS (e.g. someone adds a brand
     new rule to rule_config.json and hasn't written specific copy for it
     yet). This guarantees the explanation generator never breaks or goes
     silent just because rule_config.json grew a new rule.

Takes the SAME triggered_rules shape used in EngineOutput.triggered_rules
(dicts with rule_id, rule_name, result, impact) — not the internal
evaluator format — so this module has no coupling to engine internals.
"""

from __future__ import annotations

# Layer 1: specific sentence per rule_id.
RULE_EXPLANATIONS: dict[str, str] = {
    "R001": "A red-flag symptom was detected, triggering an immediate safety escalation regardless of other findings.",
    "R002": "Conservative treatment was attempted and did not resolve the patient's symptoms.",
    "R003": "The requested service has a clear clinical indication and medical necessity review is required under policy.",
    "R004": "The patient is experiencing functional impairment, which increases how quickly this case should be processed.",
    "R005": "Prior authorization is required for the requested service under the applicable policy.",
    "R006": "One or more required documents have not been confirmed as submitted, so more information is needed before a decision can be made.",
    "R007": "Retrieved policy evidence strongly supports this request (high relevance score).",
    "R008": "The patient's symptoms have persisted long enough to be considered chronic.",
    "R009": "The patient completed an extended course of physical therapy before requesting this service.",
    "R010": "The reported clinical severity is high or critical, requiring escalated review.",
    "R011": "No clinical indication was documented for the requested service, so medical necessity cannot be confirmed.",
    "R012": "The patient's insurance plan is recognized and confirmed eligible.",
}

# Layer 2: generic rule-impact -> sentence map, used as a fallback so a
# newly added rule (edited only in rule_config.json, per the config-driven
# design) still produces SOME sentence even before RULE_EXPLANATIONS is
# updated with rule-specific copy.
IMPACT_FALLBACK: dict[str, str] = {
    "safety_override": "A safety-related finding was identified and escalated for review.",
    "supports_medical_necessity": "Clinical evidence supports the medical necessity of this request.",
    "increases_priority": "Factors were found that increase processing priority.",
    "sets_authorization_required": "Prior authorization is required under the applicable policy.",
    "forces_more_info_required": "Required documentation is missing; more information is needed.",
    "increases_criticality": "Clinical severity indicators increase the criticality of this case.",
    "blocks_medical_necessity": "Medical necessity could not be confirmed based on the available clinical information.",
    "confirms_eligibility": "The patient's insurance plan is recognized and eligible.",
}


def generate_explanation(triggered_rules: list[dict]) -> list[str]:
    """
    Build the ordered, de-duplicated list of explanation sentences from
    triggered rules only.

    triggered_rules: list of dicts shaped like EngineOutput.triggered_rules
                      entries — must have at least "rule_id" and "impact".
    """
    sentences: list[str] = []

    for rule in triggered_rules:
        rule_id = rule.get("rule_id", "")
        impact = rule.get("impact", "")

        sentence = RULE_EXPLANATIONS.get(rule_id)
        if sentence is None:
            rule_name = rule.get("rule_name", rule_id)
            sentence = IMPACT_FALLBACK.get(
                impact, f"Rule {rule_id} ({rule_name}) was triggered."
            )

        if sentence not in sentences:
            sentences.append(sentence)

    if not sentences:
        sentences.append("No rules were triggered for this evaluation.")

    return sentences