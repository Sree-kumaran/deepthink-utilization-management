"""
rules/documentation_rules.py

Derives `documentation_missing` — the flag R006 in rule_config.json checks
to force a `more_info_required` decision.

PHASE 1 PLACEHOLDER LOGIC (explicitly allowed by the spec):
There is no backend yet to confirm whether a listed required document was
actually submitted or not — Input A's optional `required_documentation`
field only tells us a policy/backend THINKS certain documents are needed
for this claim, not whether they've been collected.

So for Phase 1 we treat "a non-empty required_documentation list is
present" as "documentation is missing" outright. This is deliberately
conservative and will need to change the moment a real backend can report
actual submission status (e.g. `submitted_documentation: list[str]` to
diff against `required_documentation`) — at that point this function is
the only place that needs to change, nothing in engine/ or rules/*.json.
"""

from __future__ import annotations


def derive_documentation_missing(flat_data: dict) -> bool:
    """
    Phase 1 placeholder: documentation is considered missing if and only if
    `required_documentation` is present and non-empty.

    - Field absent or None -> no documentation was ever required -> False
    - Field present but empty list -> nothing outstanding -> False
    - Field present with >=1 entries -> treated as not yet confirmed
      collected -> True
    """
    required_docs = flat_data.get("required_documentation")
    if not required_docs:
        return False
    return len(required_docs) > 0