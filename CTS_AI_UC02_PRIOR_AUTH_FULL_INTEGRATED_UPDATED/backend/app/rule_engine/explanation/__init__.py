"""
explanation package.

Re-exports the single public entry point:
    from explanation import generate_explanation
    explanation = generate_explanation(triggered_rules)
"""

from .explanation_generator import generate_explanation

__all__ = ["generate_explanation"]