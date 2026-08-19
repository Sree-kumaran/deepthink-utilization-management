"""
engine/normalizer.py

Combines PatientClaim + RagContext into the flat structure consumed
by the deterministic rule engine.
"""

from __future__ import annotations

from typing import Any

from ..rules import derive_documentation_missing
from ..schemas import PatientClaim, RagContext


def normalize(
    patient_claim: PatientClaim,
    rag_context: RagContext,
) -> dict[str, Any]:

    flat: dict[str, Any] = {}

    # ---------------------------------------------------------
    # Patient / claim
    # ---------------------------------------------------------

    flat["patient_id"] = patient_claim.patient_id
    flat["age"] = patient_claim.age
    flat["gender"] = patient_claim.gender
    flat["diagnosis"] = patient_claim.diagnosis
    flat["requested_service"] = patient_claim.requested_service

    flat["symptom_duration_weeks"] = (
        patient_claim.symptom_duration_weeks
    )

    flat["physical_therapy"] = (
        patient_claim.physical_therapy
    )

    flat["physical_therapy_duration_weeks"] = (
        patient_claim.physical_therapy_duration_weeks
    )

    flat["medication_tried"] = (
        patient_claim.medication_tried
    )

    flat["clinical_indication"] = (
        patient_claim.clinical_indication
    )

    flat["insurance_plan"] = (
        patient_claim.insurance_plan
    )

    flat["required_documentation"] = (
        patient_claim.required_documentation
    )

    # ---------------------------------------------------------
    # Policy / RAG
    # ---------------------------------------------------------

    flat["prior_authorization_required"] = (
        rag_context.policy_context.prior_authorization_required
    )

    flat["medical_necessity_required"] = (
        rag_context.policy_context.medical_necessity_required
    )

    # ---------------------------------------------------------
    # Clinical context
    # ---------------------------------------------------------

    flat["severity"] = (
        rag_context.clinical_context.severity
    )

    flat["red_flag_symptoms"] = (
        rag_context.clinical_context.red_flag_symptoms
    )

    flat["functional_impairment"] = (
        rag_context.clinical_context.functional_impairment
    )

    # ---------------------------------------------------------
    # Treatment
    # ---------------------------------------------------------

    flat["conservative_treatment_failed"] = (
        rag_context.prior_treatment.conservative_treatment_failed
    )

    # ---------------------------------------------------------
    # Derived RAG relevance
    # ---------------------------------------------------------

    relevance_scores = [
        evidence.relevance_score
        for evidence in rag_context.retrieved_evidence
    ]

    flat["max_relevance_score"] = (
        max(relevance_scores)
        if relevance_scores
        else 0.0
    )

    # ---------------------------------------------------------
    # Documentation
    # ---------------------------------------------------------

    flat["documentation_missing"] = (
        derive_documentation_missing(flat)
    )

    return flat