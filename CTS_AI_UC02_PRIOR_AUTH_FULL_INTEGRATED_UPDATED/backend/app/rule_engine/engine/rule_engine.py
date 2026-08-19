"""
engine/rule_engine.py

Single entry point for the deterministic rule engine.

Pipeline:

    normalize
        ->
    evaluate ALL configured rules
        ->
    keep PASSED rules for scoring
        ->
    compute scores
        ->
    determine decision
        ->
    validate EngineOutput
"""

from __future__ import annotations

from pathlib import Path

from ..schemas import EngineOutput, PatientClaim, RagContext

from .decision import determine_decision
from .evaluator import evaluate_rules, load_rule_config
from .normalizer import normalize
from .scoring import compute_scores


RULE_CONFIG_PATH = (
    Path(__file__).resolve().parent.parent
    / "rules"
    / "rule_config.json"
)


_IMPACT_SENTENCES: dict[str, str] = {
    "safety_override":
        "A safety-related red flag was identified and escalated for review.",

    "supports_medical_necessity":
        "Clinical evidence supports the medical necessity of this request.",

    "increases_priority":
        "Factors were found that increase processing priority.",

    "sets_authorization_required":
        "Prior authorization is required under the applicable policy.",

    "forces_more_info_required":
        "Required documentation is missing; more information is needed.",

    "increases_criticality":
        "Clinical severity indicators increase the criticality of this case.",

    "blocks_medical_necessity":
        "Medical necessity could not be confirmed due to missing clinical indication.",

    "confirms_eligibility":
        "The patient's insurance plan is recognized and eligible.",
}


def _build_explanation(
    triggered_rules: list[dict],
) -> list[str]:

    sentences: list[str] = []

    for rule in triggered_rules:
        sentence = _IMPACT_SENTENCES.get(rule["impact"])

        if sentence and sentence not in sentences:
            sentences.append(sentence)

    if not sentences:
        sentences.append(
            "No configured deterministic rule conditions were satisfied."
        )

    return sentences


class RuleEngine:

    @staticmethod
    def evaluate(
        patient_claim: PatientClaim,
        rag_context: RagContext,
    ) -> EngineOutput:

        flat_data = normalize(
            patient_claim,
            rag_context,
        )

        rules_config = load_rule_config(
            RULE_CONFIG_PATH
        )

        # Evaluate ALL 12 configured rules.
        evaluated = evaluate_rules(
            flat_data,
            rules_config,
        )

        # Only passed rules contribute to scoring.
        triggered = [
            rule
            for rule in evaluated
            if rule["result"] == "passed"
        ]

        scores = compute_scores(
            flat_data,
            triggered,
        )

        decision = determine_decision(
            scores
        )

        evaluated_rules_out = [
            {
                "rule_id": rule["rule_id"],
                "rule_name": rule["name"],
                "result": rule["result"],
                "impact": rule["impact"],
            }
            for rule in evaluated
        ]

        triggered_rules_out = [
            {
                "rule_id": rule["rule_id"],
                "rule_name": rule["name"],
                "result": rule["result"],
                "impact": rule["impact"],
            }
            for rule in triggered
        ]

        explanation = _build_explanation(
            triggered
        )

        return EngineOutput(
            patient_id=patient_claim.patient_id,

            rule_engine_result={
                "criticality": scores["criticality"],
                "priority": scores["priority"],
                "medical_necessity": scores["medical_necessity"],
                "authorization": scores["authorization"],
                "decision": decision,
            },

            evaluated_rules=evaluated_rules_out,

            triggered_rules=triggered_rules_out,

            explanation=explanation,
        )