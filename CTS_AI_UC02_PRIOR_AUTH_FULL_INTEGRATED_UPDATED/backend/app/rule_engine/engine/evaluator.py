"""
engine/evaluator.py

Config-driven deterministic rule evaluator.

Every configured rule is evaluated.

Result:
    passed -> condition matched
    failed -> condition did not match

The evaluator does not make a business decision.
It only evaluates the configured rules.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


SUPPORTED_OPERATORS = {
    "equals",
    "not_equals",
    "greater_than",
    "greater_than_or_equal",
    "less_than",
    "less_than_or_equal",
    "exists",
    "in",
}


def load_rule_config(path: str | Path) -> list[dict]:
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)

    rules = config.get("rules")

    if not isinstance(rules, list):
        raise ValueError("rule_config.json must contain a 'rules' list")

    return rules


def _evaluate_single_condition(
    condition: dict,
    flat_data: dict[str, Any],
) -> bool:
    field = condition["field"]
    operator = condition["operator"]
    expected = condition.get("value")
    actual = flat_data.get(field)

    if operator not in SUPPORTED_OPERATORS:
        raise ValueError(
            f"Unsupported operator in rule_config.json: {operator!r}"
        )

    if operator == "equals":
        return actual == expected

    if operator == "not_equals":
        return actual != expected

    if operator == "exists":
        return actual is not None

    if operator == "in":
        if actual is None:
            return False
        return actual in expected

    if actual is None:
        return False

    if operator == "greater_than":
        return actual > expected

    if operator == "greater_than_or_equal":
        return actual >= expected

    if operator == "less_than":
        return actual < expected

    if operator == "less_than_or_equal":
        return actual <= expected

    return False


def evaluate_condition(
    condition: dict,
    flat_data: dict[str, Any],
) -> bool:
    if "all_of" in condition:
        return all(
            evaluate_condition(item, flat_data)
            for item in condition["all_of"]
        )

    if "any_of" in condition:
        return any(
            evaluate_condition(item, flat_data)
            for item in condition["any_of"]
        )

    return _evaluate_single_condition(condition, flat_data)


def evaluate_rules(
    flat_data: dict[str, Any],
    rules_config: list[dict],
) -> list[dict]:
    results: list[dict] = []

    for rule in rules_config:
        passed = evaluate_condition(
            rule["condition"],
            flat_data,
        )

        results.append(
            {
                "rule_id": rule["rule_id"],
                "name": rule["name"],
                "category": rule["category"],
                "action": rule["action"],
                "impact": rule["impact"],
                "result": "passed" if passed else "failed",
            }
        )

    return results