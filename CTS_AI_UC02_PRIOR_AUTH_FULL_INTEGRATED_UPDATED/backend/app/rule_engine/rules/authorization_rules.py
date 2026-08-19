"""
rules/authorization_rules.py

Authorization is not a scored concept like criticality/priority/necessity —
it's a direct boolean fact stated by the policy context (Input B). R005 in
rule_config.json sets `authorization_required: true` as its action when
`prior_authorization_required` is true, but we also expose this direct
lookup so engine/scoring.py has a reliable fallback even in the (currently
impossible, since R005's condition mirrors the raw field 1:1) case where
no rule fires to set it explicitly.
"""

from __future__ import annotations


def derive_authorization_required(flat_data: dict) -> bool:
    """
    Read authorization requirement straight from the normalized/flattened
    input dict (built by engine/normalizer.py from Input A + Input B).

    flat_data is expected to contain `prior_authorization_required`,
    sourced from rag_context.policy_context.prior_authorization_required.
    Defaults to False (no authorization required) if the field is absent,
    which is the safe default for an unknown/legacy policy context.
    """
    return bool(flat_data.get("prior_authorization_required", False))