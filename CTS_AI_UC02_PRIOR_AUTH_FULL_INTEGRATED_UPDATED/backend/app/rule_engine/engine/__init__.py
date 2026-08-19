"""
engine package.

Re-exports the single public entry point:
    from engine import RuleEngine
    output = RuleEngine.evaluate(patient_claim, rag_context)
"""

from .rule_engine import RuleEngine

__all__ = ["RuleEngine"]