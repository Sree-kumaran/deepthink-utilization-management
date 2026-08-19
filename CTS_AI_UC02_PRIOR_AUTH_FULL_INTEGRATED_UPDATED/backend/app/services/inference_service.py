"""
UC02 Inference Service
----------------------

Purpose:
    Convert the authorization request into a normalized set of
    clinical/service facts that the rule engine can evaluate.

CURRENT STAGE:
    This is a lightweight deterministic extraction/normalization
    layer so the API can work before the ML model is trained.

FUTURE:
    Replace the extraction implementation with:
        - clinical NLP model
        - LLM structured extraction
        - document/PDF extraction
        - OCR
        - trained ML model

IMPORTANT:
    The API contract does NOT need to change when the model is added.
"""

from typing import Any


class InferenceService:
    """
    Adapter around the future AI/ML inference pipeline.

    The rest of the backend should communicate with this class
    instead of directly calling a model.
    """

    async def extract_features(self, payload: Any) -> dict:
        """
        Convert the incoming authorization payload into normalized
        features.

        At the current MVP stage, the payload is already structured,
        so we mainly normalize it.

        Later this method can receive:
            - clinical notes
            - uploaded documents
            - free-text descriptions

        and return the same normalized structure.
        """

        patient = payload.patient
        provider = payload.provider
        plan = payload.plan
        service = payload.service
        clinical = payload.clinical

        # ---------------------------------------------------------
        # Normalize lists.
        #
        # This prevents None from propagating into the rule engine.
        # ---------------------------------------------------------

        symptoms = list(clinical.symptoms or [])
        prior_treatment = list(clinical.prior_treatment or [])
        prior_tests = list(clinical.prior_tests or [])

        diagnoses = list(
            getattr(patient, "diagnoses", None) or []
        )

        medications = list(
            getattr(patient, "medications", None) or []
        )

        history = list(
            getattr(patient, "history", None) or []
        )

        # ---------------------------------------------------------
        # Build normalized feature representation.
        # ---------------------------------------------------------

        features = {
            "request_id": str(
                getattr(payload, "request_id", "")
                or getattr(payload, "external_request_id", "")
            ),

            "patient": {
                "patient_id": getattr(patient, "patient_id", None),
                "patient_name": getattr(patient, "patient_name", None),
                "age": getattr(patient, "age", None),
                "sex": getattr(patient, "sex", None),
                "diagnoses": diagnoses,
                "medications": medications,
                "history": history,
            },

            "provider": {
                "provider_id": getattr(provider, "provider_id", None),
                "name": getattr(provider, "name", None),
                "specialty": getattr(provider, "specialty", None),
                "organization": getattr(provider, "organization", None),
            },

            "plan": {
                "plan_id": getattr(plan, "plan_id", None),
                "plan_name": getattr(plan, "plan_name", None),
                "member_id": getattr(plan, "member_id", None),
            },

            "service": {
                "service_code": getattr(service, "service_code", None),
                "service_name": getattr(service, "service_name", None),
                "category": getattr(service, "category", None),
                "requested_date": getattr(
                    service,
                    "requested_date",
                    None,
                ),
                "site_of_service": getattr(
                    service,
                    "site_of_service",
                    None,
                ),
            },

            "clinical": {
                "diagnosis": getattr(
                    clinical,
                    "diagnosis",
                    None,
                ),
                "indication": getattr(
                    clinical,
                    "indication",
                    None,
                ),
                "symptoms": symptoms,
                "clinical_findings": list(
                    clinical.clinical_findings or []
                ),
                "prior_treatment": prior_treatment,
                "prior_tests": prior_tests,
                "symptom_duration_weeks": getattr(
                    clinical,
                    "symptom_duration_weeks",
                    None,
                ),
                "prior_treatment_duration_weeks": getattr(
                    clinical,
                    "prior_treatment_duration_weeks",
                    None,
                ),
                "duration": getattr(
                    clinical,
                    "duration",
                    None,
                ),
            },
        }

        return features


# Singleton used by the service layer.
inference_service = InferenceService()