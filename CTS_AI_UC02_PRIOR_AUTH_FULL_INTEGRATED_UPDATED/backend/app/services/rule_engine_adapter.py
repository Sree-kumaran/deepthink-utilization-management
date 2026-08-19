from __future__ import annotations

import re
from typing import Any

from app.rule_engine.engine import RuleEngine
from app.rule_engine.schemas import PatientClaim, RagContext


def _as_bool(
    value: Any,
    default: bool = False,
) -> bool:

    if isinstance(value, bool):
        return value

    if value is None:
        return default

    if isinstance(value, str):
        return value.strip().lower() in {
            "true",
            "yes",
            "1",
            "y",
        }

    return bool(value)


def _text(value: Any) -> str:
    return str(value or "").strip()


def _contains_any(
    text: str,
    terms: tuple[str, ...],
) -> bool:

    value = text.lower()

    return any(
        term in value
        for term in terms
    )


class RuleEngineAdapter:

    def build_patient_claim(
        self,
        patient: dict[str, Any],
        plan: dict[str, Any],
        service: dict[str, Any],
        clinical: dict[str, Any],
    ) -> PatientClaim:

        diagnoses = patient.get("diagnoses") or []

        diagnosis = (
            _text(clinical.get("diagnosis"))
            or _text(clinical.get("indication"))
            or (
                _text(diagnoses[0])
                if diagnoses
                else ""
            )
        )

        clinical_indication_raw = (
            clinical.get("clinical_indication")
        )

        if clinical_indication_raw is None:
            clinical_indication_raw = clinical.get(
                "indication"
            )

        if isinstance(
            clinical_indication_raw,
            bool,
        ):
            clinical_indication = (
                clinical_indication_raw
            )
        else:
            clinical_indication = bool(
                _text(clinical_indication_raw)
                or diagnosis
            )

        prior_treatment = (
            clinical.get("prior_treatment")
            or []
        )

        pt = clinical.get(
            "physical_therapy"
        )

        if pt is None:
            pt = any(
                (
                    "physical therap" in _text(x).lower()
                    or "physiotherapy" in _text(x).lower()
                )
                for x in prior_treatment
            )

        pt_duration = clinical.get(
            "physical_therapy_duration_weeks"
        )

        if pt_duration is None:
            pt_duration = 0

        medication_tried = clinical.get(
            "medication_tried"
        )

        if medication_tried is None:
            medication_tried = bool(
                patient.get("medications")
            )

        return PatientClaim(
            patient_id=_text(
                patient.get("patient_id")
            ),

            age=int(
                patient.get("age") or 0
            ),

            gender=_text(
                patient.get("gender")
                or patient.get("sex")
                or "unknown"
            ),

            diagnosis=diagnosis,

            requested_service=_text(
                service.get("service_name")
            ),

            symptom_duration_weeks=int(
                clinical.get(
                    "symptom_duration_weeks"
                )
                or 0
            ),

            physical_therapy=_as_bool(pt),

            physical_therapy_duration_weeks=int(
                pt_duration or 0
            ),

            medication_tried=_as_bool(
                medication_tried
            ),

            clinical_indication=clinical_indication,

            insurance_plan=_text(
                plan.get("plan_name")
                or plan.get("plan_id")
                or ""
            ),

            required_documentation=clinical.get(
                "required_documentation"
            ),
        )

    def build_rag_context(
        self,
        clinical: dict[str, Any],
        policy_evidence: list[dict[str, Any]],
    ) -> RagContext:

        if not policy_evidence:
            raise ValueError(
                "Rule Engine requires matching RAG policy evidence."
            )

        policy_text = "\n".join(
            _text(item.get("text"))
            for item in policy_evidence
            if _text(item.get("text"))
        ).lower()

        # Robustly detect:
        #
        # Prior Authorization: Required
        # Prior Authorization Required
        # Pre-Authorization: Required
        #
        prior_authorization_required = bool(
            re.search(
                r"(prior|pre)[-\s]?authorization"
                r".{0,40}"
                r"\brequired\b",
                policy_text,
                flags=re.IGNORECASE | re.DOTALL,
            )
        )

        medical_necessity_required = (
            "medical necessity"
            in policy_text
        )

        severity = _text(
            clinical.get("severity")
        ).lower()

        combined_clinical = " ".join([
            _text(clinical.get("indication")),
            _text(clinical.get("diagnosis")),
            _text(clinical.get("clinical_notes")),
            " ".join(_text(x) for x in (clinical.get("symptoms") or [])),
        ]).lower()

        if severity not in {
            "low",
            "moderate",
            "high",
            "critical",
        }:
            if _contains_any(combined_clinical, ("critical", "emergency", "severe acute")):
                severity = "critical"
            elif _contains_any(combined_clinical, ("urgent", "high severity", "severe")):
                severity = "high"
            else:
                severity = "moderate"

        explicit_red_flag = clinical.get(
            "red_flag_symptoms"
        )

        if explicit_red_flag is not None:
            red_flag_symptoms = _as_bool(explicit_red_flag)
        else:
            red_flag_symptoms = _contains_any(
                combined_clinical,
                (
                    "red flag",
                    "cauda equina",
                    "motor deficit",
                    "neurological deficit",
                    "acute weakness",
                    "rapidly progressive",
                    "severe instability",
                ),
            )

        explicit_functional = clinical.get(
            "functional_impairment"
        )

        if explicit_functional is not None:

            functional_impairment = _as_bool(
                explicit_functional
            )

        else:

            combined = " ".join(
                [
                    _text(
                        clinical.get("indication")
                    ),

                    _text(
                        clinical.get("diagnosis")
                    ),

                    " ".join(
                        _text(x)
                        for x in (
                            clinical.get(
                                "symptoms"
                            )
                            or []
                        )
                    ),

                    " ".join(
                        _text(x)
                        for x in (
                            clinical.get(
                                "clinical_findings"
                            )
                            or []
                        )
                    ),
                ]
            )

            functional_impairment = (
                _contains_any(
                    combined,
                    (
                        "functional impairment",
                        "functional limitation",
                        "difficulty with daily",
                        "limits daily activities",
                        "activity limitation",
                    ),
                )
            )

        explicit_failed = clinical.get(
            "conservative_treatment_failed"
        )

        if explicit_failed is not None:

            conservative_failed = _as_bool(
                explicit_failed
            )

        else:

            treatment_text = " ".join(
                _text(x)
                for x in (
                    clinical.get(
                        "prior_treatment"
                    )
                    or []
                )
            )

            conservative_failed = (
                _contains_any(
                    treatment_text,
                    (
                        "failed",
                        "unsuccessful",
                        "no improvement",
                        "did not improve",
                        "without improvement",
                    ),
                )
            )

        evidence = []

        for item in policy_evidence:

            source = item.get("source")

            if isinstance(source, dict):
                source = (
                    source.get("source")
                    or source.get("policy_id")
                    or "policy"
                )

            source = (
                _text(source)
                or "policy"
            )

            try:
                score = float(
                    item.get("score") or 0.0
                )
            except (
                TypeError,
                ValueError,
            ):
                score = 0.0

            evidence.append(
                {
                    "source": source,
                    "relevance_score": max(
                        0.0,
                        min(score, 1.0),
                    ),
                    "evidence": (
                        _text(
                            item.get("text")
                        )
                        or None
                    ),
                }
            )

        return RagContext(
            policy_context={
                "prior_authorization_required":
                    prior_authorization_required,

                "medical_necessity_required":
                    medical_necessity_required,
            },

            clinical_context={
                "severity": severity,
                "red_flag_symptoms":
                    red_flag_symptoms,
                "functional_impairment":
                    functional_impairment,
            },

            prior_treatment={
                "conservative_treatment_failed":
                    conservative_failed,
            },

            retrieved_evidence=evidence,
        )

    def evaluate(
        self,
        *,
        patient: dict[str, Any],
        plan: dict[str, Any],
        service: dict[str, Any],
        clinical: dict[str, Any],
        policy_evidence: list[dict[str, Any]],
    ):

        patient_claim = self.build_patient_claim(
            patient,
            plan,
            service,
            clinical,
        )

        rag_context = self.build_rag_context(
            clinical,
            policy_evidence,
        )

        return RuleEngine.evaluate(
            patient_claim,
            rag_context,
        )


rule_engine_adapter = RuleEngineAdapter()