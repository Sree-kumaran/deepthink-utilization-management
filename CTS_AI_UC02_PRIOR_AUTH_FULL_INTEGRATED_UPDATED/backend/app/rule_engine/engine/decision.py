"""
engine/decision.py

Determines the final internal deterministic-engine decision.
"""

from __future__ import annotations

from typing import Literal


Decision = Literal[
    "accept",
    "nurse_review",
    "more_info_required",
]


def determine_decision(scores: dict) -> Decision:

    # ---------------------------------------------------------
    # 1. Explicit forced decision
    # ---------------------------------------------------------

    force_decision = scores.get(
        "force_decision"
    )

    if force_decision:
        return force_decision

    # ---------------------------------------------------------
    # 2. Missing information
    # ---------------------------------------------------------

    necessity_status = (
        scores["medical_necessity"]["status"]
    )

    if necessity_status == "insufficient_information":
        return "more_info_required"

    # ---------------------------------------------------------
    # 3. Medical necessity unsupported
    # ---------------------------------------------------------

    if necessity_status == "not_supported":
        return "nurse_review"

    # ---------------------------------------------------------
    # 4. High / critical cases
    # ---------------------------------------------------------

    criticality_level = (
        scores["criticality"]["level"]
    )

    if criticality_level in {
        "high",
        "critical",
    }:
        return "nurse_review"

    # ---------------------------------------------------------
    # 5. Automatic approval
    # ---------------------------------------------------------

    return "accept"