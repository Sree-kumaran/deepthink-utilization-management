# UC02 Rule Engine Integration

The supplied 12-rule deterministic Rule Engine is now integrated into the backend.

## Runtime flow

Authorization API -> Policy/version validation -> RAG policy evidence -> Rule Engine Adapter -> 12-rule engine -> PostgreSQL/audit -> DecisionTrace.

The ML/LLM layer is intentionally not part of this integration.

## Integration boundary

`app/services/rule_engine_adapter.py` converts the backend authorization request and RAG evidence into the Rule Engine's:

- `PatientClaim`
- `RagContext`

The Rule Engine remains stateless and config-driven.

## Rule engine package

The supplied engine lives under:

`app/rule_engine/`

Rules are configured in:

`app/rule_engine/rules/rule_config.json`

The engine output includes:

- criticality
- priority
- medical necessity
- authorization requirement
- decision
- triggered rules
- explanation

## Important data fallback

The current backend authorization schema does not contain an explicit clinical severity field. The adapter therefore uses `moderate` as the engine's neutral baseline when severity is absent. This is an integration fallback, not a claim that the patient's clinically measured severity is moderate.

Likewise, red-flag status is only true when explicitly supplied by the backend. Functional impairment can be derived from explicit backend wording such as "functional limitation" or "functional impairment".

## Policy evidence

The adapter derives `prior_authorization_required` and `medical_necessity_required` from the retrieved policy evidence. The selected policy/version is filtered before the evidence reaches the Rule Engine.

## Testing

A focused integration test is available at:

`tests/test_rule_engine_integration.py`

It validates the P001-style knee MRI flow without requiring Gemini or Qdrant.
