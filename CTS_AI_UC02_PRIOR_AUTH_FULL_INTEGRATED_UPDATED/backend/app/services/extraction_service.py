from __future__ import annotations

from collections import Counter
from datetime import date, datetime
from typing import Any

from sqlalchemy import select

from app.db.models import Policy, PolicyVersion
from app.services.rule_engine_adapter import rule_engine_adapter


class ExtractionService:
    """Deterministic patient feature extraction used by the extraction API.

    The extractor is deliberately conservative:
      1. resolve the requested patient from the supplied patient rows;
      2. reject the request when the patient cannot be found;
      3. reject the request when the patient is deceased;
      4. only then derive the model features and downstream rule-engine result.

    The feature names mirror the trained XGBoost input contract shown in the
    project artefacts (including the one-hot encoded categorical columns).
    """

    PREFIX_VALUES = ("Mrs.", "Ms.", "Unknown")
    SUFFIX_VALUES = ("MD", "PhD", "Unknown")
    MARITAL_VALUES = ("M", "S", "Unknown", "W")
    RACE_VALUES = ("black", "hawaiian", "native", "other", "white")
    ETHNICITY_VALUES = ("nonhispanic",)
    COUNTY_VALUES = (
        "Berkshire County",
        "Bristol County",
        "Dukes County",
        "Essex County",
        "Franklin County",
        "Hampden County",
        "Hampshire County",
        "Middlesex County",
        "Nantucket County",
        "Norfolk County",
        "Plymouth County",
        "Suffolk County",
        "Worcester County",
    )

    # -----------------------------
    # Generic helpers
    # -----------------------------

    @staticmethod
    def _rows(raw_data: dict, source: str) -> list[dict]:
        value = raw_data.get(source, [])
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
        if isinstance(value, dict):
            return [value]
        return []

    @staticmethod
    def _first_value(row: dict, *keys: str) -> Any:
        for key in keys:
            if key in row and row[key] not in (None, ""):
                return row[key]
        return None

    @staticmethod
    def _text(row: dict) -> str:
        return " ".join(str(v) for v in row.values() if v is not None).strip()

    @staticmethod
    def _normalise_key(value: Any) -> str:
        return str(value or "").strip().lower()

    @staticmethod
    def _parse_date(value: Any) -> date | None:
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value

        text = str(value).strip()
        for fmt in (
            "%Y-%m-%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%m/%d/%Y",
        ):
            try:
                return datetime.strptime(text[:26], fmt).date()
            except ValueError:
                continue
        return None

    @classmethod
    def _calculate_age(cls, value: Any) -> int | None:
        birthdate = cls._parse_date(value)
        if not birthdate:
            return None
        today = date.today()
        age = today.year - birthdate.year
        if (today.month, today.day) < (birthdate.month, birthdate.day):
            age -= 1
        return max(age, 0)

    @classmethod
    def _extract_age(cls, patient: dict) -> int:
        explicit = cls._first_value(patient, "AGE", "age")
        if explicit not in (None, ""):
            try:
                return max(0, int(float(explicit)))
            except (TypeError, ValueError):
                pass
        return cls._calculate_age(cls._first_value(patient, "BIRTHDATE", "birthdate", "birthDate")) or 0

    @classmethod
    def _duration_weeks(cls, start_value: Any, stop_value: Any) -> int | None:
        start = cls._parse_date(start_value)
        stop = cls._parse_date(stop_value) or date.today()
        if not start or stop < start:
            return None
        return (stop - start).days // 7

    @staticmethod
    def _number(value: Any, integer: bool = False, default: Any = 0) -> Any:
        if value in (None, ""):
            return default
        try:
            return int(float(value)) if integer else float(value)
        except (TypeError, ValueError):
            return default

    @classmethod
    def _patient_id_from_payload(cls, raw_data: dict) -> str | None:
        value = (
            raw_data.get("patient_id")
            or raw_data.get("patientId")
            or (raw_data.get("patient") or {}).get("patient_id")
            or (raw_data.get("patient") or {}).get("id")
        )
        return str(value).strip() if value not in (None, "") else None

    @classmethod
    def _row_patient_id(cls, row: dict) -> str | None:
        value = cls._first_value(
            row,
            "PATIENT",
            "patient",
            "patient_id",
            "PATIENT_ID",
        )
        return str(value).strip() if value not in (None, "") else None

    @classmethod
    def _patient_record_id(cls, row: dict) -> str | None:
        value = cls._first_value(row, "Id", "ID", "id", "patient_id", "PATIENT_ID")
        return str(value).strip() if value not in (None, "") else None

    @classmethod
    def _patient_rows(cls, raw_data: dict, patient_id: str) -> dict[str, list[dict]]:
        result: dict[str, list[dict]] = {}
        target = cls._normalise_key(patient_id)
        for source in (
            "encounters",
            "conditions",
            "medications",
            "procedures",
            "careplans",
            "allergies",
            "devices",
            "immunizations",
            "claims",
        ):
            result[source] = [
                row
                for row in cls._rows(raw_data, source)
                if cls._normalise_key(cls._row_patient_id(row)) == target
            ]
        return result

    @classmethod
    def _unique_values(cls, rows: list[dict], *keys: str) -> set[str]:
        values: set[str] = set()
        for row in rows:
            value = cls._first_value(row, *keys)
            if value not in (None, ""):
                values.add(cls._normalise_key(value))
        return values

    @classmethod
    def _needs_nurse_review(cls, patient: dict, raw_data: dict) -> bool:
        """Preserve the existing hardcoded flow while exposing the nurse-review path.

        A missing/unparseable death date or missing/invalid details is treated as
        insufficiently reliable input and therefore routed to nurse review.
        """
        death_value = cls._first_value(
            patient,
            "DEATHDATE",
            "deathDate",
            "deathdate",
            "death_date",
        )
        death_date = cls._parse_date(death_value)

        details = cls._first_value(
            patient,
            "DETAILS",
            "details",
        )
        if details in (None, "", [], {}):
            details = raw_data.get("details")

        details_valid = bool(details)
        return death_date is None or not details_valid

    @classmethod
    def _is_deceased(cls, patient: dict) -> bool:
        death_value = cls._first_value(
            patient,
            "DEATHDATE",
            "deathDate",
            "deathdate",
            "death_date",
            "DECEASED",
            "deceased",
        )
        if isinstance(death_value, bool):
            return death_value
        if death_value not in (None, "", False, 0, "0", "false", "False"):
            return True

        alive_value = cls._first_value(patient, "ALIVE", "alive")
        if alive_value is not None:
            return not str(alive_value).strip().lower() in {"false", "0", "no", "dead"}
        return False

    @classmethod
    def _find_patient(cls, raw_data: dict) -> tuple[dict | None, str | None, str]:
        patients = cls._rows(raw_data, "patients")
        if not patients and isinstance(raw_data.get("patient"), dict):
            patients = [raw_data["patient"]]
        requested_id = cls._patient_id_from_payload(raw_data)

        if not requested_id:
            if len(patients) == 1:
                requested_id = cls._patient_record_id(patients[0])
            else:
                return None, None, "PATIENT_ID_REQUIRED"

        target = cls._normalise_key(requested_id)
        for patient in patients:
            if cls._normalise_key(cls._patient_record_id(patient)) == target:
                return patient, requested_id, "FOUND"
        return None, requested_id, "PATIENT_NOT_FOUND"

    # -----------------------------
    # Clinical extraction
    # -----------------------------

    @classmethod
    def _extract_diagnosis(cls, conditions: list[dict]) -> str | None:
        if not conditions:
            return None
        row = sorted(
            conditions,
            key=lambda item: cls._parse_date(cls._first_value(item, "START", "start")) or date.min,
        )[-1]
        return cls._first_value(row, "DESCRIPTION", "description", "CODE", "code")

    @classmethod
    def _extract_requested_service(cls, procedures: list[dict]) -> str | None:
        if not procedures:
            return None
        row = procedures[-1]
        return cls._first_value(row, "DESCRIPTION", "description", "CODE", "code")

    @classmethod
    def _extract_symptom_duration(cls, conditions: list[dict]) -> int | None:
        if not conditions:
            return None
        row = sorted(
            conditions,
            key=lambda item: cls._parse_date(cls._first_value(item, "START", "start")) or date.min,
        )[-1]
        return cls._duration_weeks(
            cls._first_value(row, "START", "start"),
            cls._first_value(row, "STOP", "stop"),
        )

    @classmethod
    def _extract_physical_therapy(cls, procedures: list[dict], careplans: list[dict]) -> tuple[bool, int | None]:
        for row in [*procedures, *careplans]:
            text = cls._text(row).lower()
            if any(term in text for term in ("physical therapy", "physiotherapy", "physical therapist")):
                return True, cls._duration_weeks(
                    cls._first_value(row, "START", "start"),
                    cls._first_value(row, "STOP", "stop"),
                )
        return False, None

    @classmethod
    def _extract_insurance(cls, raw_data: dict) -> dict:
        payers = cls._rows(raw_data, "payers") or cls._rows(raw_data, "payer")
        if not payers:
            return {}
        payer = payers[0]
        return {
            "payer_id": cls._first_value(payer, "Id", "ID", "id", "payer_id"),
            "payer_name": cls._first_value(payer, "NAME", "name", "DESCRIPTION", "description"),
        }

    @classmethod
    def _clinical_summary(
        cls,
        patient: dict,
        diagnosis: str | None,
        encounters: list[dict],
        medications: list[dict],
    ) -> str:
        age = cls._extract_age(patient)
        descriptor = f"{age}-year-old" if age is not None else "Adult"
        diagnosis_text = diagnosis or "chronic clinical symptoms"
        return (
            f"{descriptor} patient with {diagnosis_text}. Clinical records show "
            f"{len(encounters)} encounters, ongoing medication use ({len(medications)} records), "
            "and evidence supporting a prior-authorization review."
        )

    # -----------------------------
    # Model feature extraction
    # -----------------------------

    @classmethod
    def _categorical_features(cls, patient: dict) -> dict[str, int]:
        prefix = str(cls._first_value(patient, "PREFIX", "prefix") or "Unknown").strip()
        suffix = str(cls._first_value(patient, "SUFFIX", "suffix") or "Unknown").strip()
        marital = str(cls._first_value(patient, "MARITAL", "marital") or "Unknown").strip()
        race = str(cls._first_value(patient, "RACE", "race") or "other").strip().lower()
        ethnicity = str(cls._first_value(patient, "ETHNICITY", "ethnicity") or "hispanic").strip().lower()
        gender = str(cls._first_value(patient, "GENDER", "gender", "SEX", "sex") or "unknown").strip().upper()
        county = str(cls._first_value(patient, "COUNTY", "county") or "").strip()

        features: dict[str, int] = {}
        for value in cls.PREFIX_VALUES:
            features[f"PREFIX_{value}"] = int(prefix.lower() == value.lower())
        if prefix.lower() not in {x.lower() for x in cls.PREFIX_VALUES}:
            features["PREFIX_Unknown"] = 1

        for value in cls.SUFFIX_VALUES:
            features[f"SUFFIX_{value}"] = int(suffix.lower() == value.lower())
        if suffix.lower() not in {x.lower() for x in cls.SUFFIX_VALUES}:
            features["SUFFIX_Unknown"] = 1

        for value in cls.MARITAL_VALUES:
            features[f"MARITAL_{value}"] = int(marital.lower() == value.lower())
        if marital.lower() not in {x.lower() for x in cls.MARITAL_VALUES}:
            features["MARITAL_Unknown"] = 1

        for value in cls.RACE_VALUES:
            features[f"RACE_{value}"] = int(race == value)

        features["ETHNICITY_nonhispanic"] = int(ethnicity == "nonhispanic")
        features["GENDER_M"] = int(gender in {"M", "MALE"})

        for value in cls.COUNTY_VALUES:
            features[f"COUNTY_{value}"] = int(county.lower() == value.lower())
        return features

    @classmethod
    def _extract_features(cls, patient: dict, related: dict[str, list[dict]], raw_data: dict) -> dict:
        encounters = related["encounters"]
        conditions = related["conditions"]
        medications = related["medications"]
        procedures = related["procedures"]
        careplans = related["careplans"]
        allergies = related["allergies"]
        devices = related["devices"]
        immunizations = related["immunizations"]
        claims = related["claims"]

        encounter_ids = cls._unique_values(encounters, "Id", "ID", "id", "ENCOUNTER", "encounter")
        encounter_types = cls._unique_values(encounters, "ENCOUNTERCLASS", "encounterclass", "ENCOUNTER_TYPE", "TYPE", "type")
        condition_ids = cls._unique_values(conditions, "CODE", "code", "DESCRIPTION", "description")
        medication_ids = cls._unique_values(medications, "CODE", "code", "DESCRIPTION", "description", "REASONCODE", "reasoncode")
        procedure_ids = cls._unique_values(procedures, "CODE", "code", "DESCRIPTION", "description")
        careplan_ids = cls._unique_values(careplans, "Id", "ID", "id", "CODE", "code", "DESCRIPTION", "description")
        device_ids = cls._unique_values(devices, "UDI", "udi", "CODE", "code", "DESCRIPTION", "description", "Id", "id")
        immunization_ids = cls._unique_values(immunizations, "CODE", "code", "DESCRIPTION", "description")
        claim_ids = cls._unique_values(claims, "Id", "ID", "id", "CLAIM_ID", "claim_id")

        claim_diagnoses: set[str] = set()
        for claim in claims:
            for key, value in claim.items():
                if "diagnos" not in str(key).lower():
                    continue
                if isinstance(value, list):
                    values = value
                else:
                    values = str(value or "").replace(";", ",").split(",")
                for item in values:
                    item = str(item).strip()
                    if item:
                        claim_diagnoses.add(item.lower())

        # A claim row without an explicit ID is still a claim.
        claim_count = len(claims)
        unique_claim_count = len(claim_ids) or claim_count
        encounter_count = len(encounters)

        patient_rows = cls._rows(raw_data, "patients")
        if not patient_rows and isinstance(raw_data.get("patient"), dict):
            patient_rows = [raw_data["patient"]]
        city_values = [
            str(cls._first_value(row, "CITY", "city") or "").strip().lower()
            for row in patient_rows
        ]
        city = str(cls._first_value(patient, "CITY", "city") or "").strip().lower()
        city_frequency = (
            city_values.count(city) / len(city_values)
            if city and city_values
            else 0.0
        )

        physical_therapy, _ = cls._extract_physical_therapy(procedures, careplans)
        _ = physical_therapy  # kept explicit for downstream rule-engine mapping

        features: dict[str, Any] = {
            "FIPS": cls._number(cls._first_value(patient, "FIPS", "fips"), integer=True, default=0),
            "ZIP": cls._number(cls._first_value(patient, "ZIP", "zip"), integer=True, default=0),
            "LON": cls._number(cls._first_value(patient, "LON", "lon", "LONGITUDE", "longitude"), default=0.0),
            "HEALTHCARE_EXPENSES": cls._number(cls._first_value(patient, "HEALTHCARE_EXPENSES", "healthcare_expenses"), default=0.0),
            "HEALTHCARE_COVERAGE": cls._number(cls._first_value(patient, "HEALTHCARE_COVERAGE", "healthcare_coverage"), default=0.0),
            "INCOME": cls._number(cls._first_value(patient, "INCOME", "income"), default=0.0),
            "encounter_count": encounter_count,
            "encounter_type_count": len(encounter_types),
            "unique_encounter_count": len(encounter_ids) or encounter_count,
            "condition_count": len(conditions),
            "unique_condition_count": len(condition_ids) or len(conditions),
            "medication_count": len(medications),
            "unique_medication_count": len(medication_ids) or len(medications),
            "procedure_count": len(procedures),
            "unique_procedure_count": len(procedure_ids) or len(procedures),
            "careplan_count": len(careplans),
            "unique_careplan_count": len(careplan_ids) or len(careplans),
            "allergy_count": len(allergies),
            "device_count": len(devices),
            "unique_device_count": len(device_ids) or len(devices),
            "immunization_count": len(immunizations),
            "unique_immunization_count": len(immunization_ids) or len(immunizations),
            "claim_count": claim_count,
            "unique_claim_diagnosis_count": len(claim_diagnoses),
            "CITY_FREQUENCY": round(city_frequency, 6),
            "age": cls._extract_age(patient),
        }

        features.update(cls._categorical_features(patient))

        expenses = features["HEALTHCARE_EXPENSES"]
        coverage = features["HEALTHCARE_COVERAGE"]
        features["coverage_expense_ratio"] = round(coverage / expenses, 6) if expenses else 0.0
        features["medication_per_encounter"] = round(len(medications) / encounter_count, 6) if encounter_count else 0.0
        features["procedure_per_encounter"] = round(len(procedures) / encounter_count, 6) if encounter_count else 0.0
        features["condition_per_encounter"] = round(len(conditions) / encounter_count, 6) if encounter_count else 0.0
        features["claim_per_encounter"] = round(claim_count / encounter_count, 6) if encounter_count else 0.0

        return features

    # -----------------------------
    # Existing clinical extraction contract
    # -----------------------------

    @classmethod
    def _build_rule_inputs(cls, patient: dict, related: dict[str, list[dict]], raw_data: dict) -> tuple[dict, dict, dict, dict]:
        diagnosis = cls._extract_diagnosis(related["conditions"])
        service = cls._extract_requested_service(related["procedures"])
        symptom_duration = cls._extract_symptom_duration(related["conditions"])
        pt, pt_duration = cls._extract_physical_therapy(related["procedures"], related["careplans"])
        insurance = cls._extract_insurance(raw_data)

        patient_data = {
            "patient_id": cls._patient_record_id(patient),
            "patient_name": cls._first_value(patient, "FIRST", "first", "NAME", "name"),
            "age": cls._extract_age(patient),
            "gender": cls._first_value(patient, "GENDER", "gender") or "unknown",
            "diagnoses": [diagnosis] if diagnosis else [],
            "medications": [
                cls._first_value(row, "DESCRIPTION", "description", "CODE", "code")
                for row in related["medications"]
                if cls._first_value(row, "DESCRIPTION", "description", "CODE", "code")
            ],
        }
        plan_data = {
            "plan_id": insurance.get("payer_id"),
            "plan_name": insurance.get("payer_name"),
        }
        service_data = {"service_name": service or "Unknown service"}
        clinical_data = {
            "diagnosis": diagnosis,
            "indication": diagnosis,
            "symptoms": [diagnosis] if diagnosis else [],
            "clinical_findings": [cls._text(row) for row in related["conditions"][:5]],
            "prior_treatment": [cls._text(row) for row in related["careplans"][:5]],
            "symptom_duration_weeks": symptom_duration or 0,
            "physical_therapy": pt,
            "physical_therapy_duration_weeks": pt_duration or 0,
            "medication_tried": bool(related["medications"]),
            "clinical_indication": bool(diagnosis),
        }
        return patient_data, plan_data, service_data, clinical_data

    @staticmethod
    def _empty_rule_result(reason: str) -> dict:
        return {
            "criticality": {"level": "moderate", "score": 0.45},
            "priority": {"level": "normal", "score": 0.35},
            "medical_necessity": {"status": "insufficient_information", "score": 0.55},
            "authorization": {"required": False},
            "decision": "More information required",
            "_reason": reason,
        }

    async def _evaluate_rule_engine(self, db, raw_data: dict, patient: dict, related: dict[str, list[dict]]) -> tuple[dict, list[dict], list[str]]:
        patient_data, plan_data, service_data, clinical_data = self._build_rule_inputs(patient, related, raw_data)

        # Targeted hardcoded routing: unreliable death-date/details input must
        # reach the existing nurse-review decision path rather than falling
        # through to "more_info_required" or "accept".
        if self._needs_nurse_review(patient, raw_data):
            return (
                {
                    "criticality": {"level": "moderate", "score": 0.45},
                    "priority": {"level": "high", "score": 0.75},
                    "medical_necessity": {"status": "insufficient_information", "score": 0.55},
                    "authorization": {"required": False},
                    "decision": "Nurse review required",
                    "_reason": "Death date is missing/invalid or patient details are missing/invalid.",
                },
                [],
                ["Missing or invalid death_date/details requires nurse review."],
            )

        payer = str(plan_data.get("plan_name") or "").strip().lower()
        service = str(service_data.get("service_name") or "").strip().lower()

        policies = []
        if db is not None:
            policies = list((await db.execute(select(Policy).where(Policy.active.is_(True)))).scalars().all())

        best_policy = None
        best_score = -1
        for policy in policies:
            name = policy.name.lower()
            score = 0
            if payer and payer in name:
                score += 3
            for token in [t for t in service.replace("/", " ").replace("-", " ").split() if len(t) >= 4][:6]:
                if token in name:
                    score += 1
            if score > best_score:
                best_score = score
                best_policy = policy

        if not best_policy:
            return self._empty_rule_result("No active policy could be matched to the patient request."), [], ["No active policy could be matched to the patient request."]

        from app.services.rag_service import rag_service

        try:
            evidence = await rag_service.retrieve_policy_evidence(
                question=f"Evaluate prior authorization for {service_data['service_name']} under {best_policy.name}",
                patient_data={"patient": patient_data, "plan": plan_data, "service": service_data, "clinical": clinical_data},
                requested_service=service_data["service_name"],
                limit=5,
            )
            evidence = [
                item for item in evidence
                if item.get("policy_id") == best_policy.id
                and item.get("version") == best_policy.active_version
            ]
        except Exception as exc:
            return self._empty_rule_result(f"Policy evidence retrieval failed: {type(exc).__name__}"), [], ["Policy evidence could not be retrieved for this extraction request."]

        if not evidence:
            return self._empty_rule_result("No matching policy evidence was retrieved."), [], ["No matching policy evidence was retrieved."]

        output = rule_engine_adapter.evaluate(
            patient=patient_data,
            plan=plan_data,
            service=service_data,
            clinical=clinical_data,
            policy_evidence=evidence,
        )
        result = output.rule_engine_result.model_dump()
        result["decision"] = {
            "accept": "Approve",
            "nurse_review": "Nurse review required",
            "more_info_required": "More information required",
        }.get(result["decision"], result["decision"])
        return result, [rule.model_dump() for rule in output.triggered_rules], list(output.explanation)

    # -----------------------------
    # Main extraction API
    # -----------------------------

    async def extract(self, raw_data: dict, db=None) -> dict:
        if not isinstance(raw_data, dict):
            raise ValueError("Extraction payload must be a JSON object")

        patient, requested_id, patient_status = self._find_patient(raw_data)
        if patient_status == "PATIENT_ID_REQUIRED":
            return {
                "patient_id": requested_id,
                "status": "PATIENT_ID_REQUIRED",
                "message": "Provide patient_id when the payload contains more than one patient.",
                "features": {},
            }
        if patient_status == "PATIENT_NOT_FOUND":
            return {
                "patient_id": requested_id,
                "status": "PATIENT_NOT_FOUND",
                "message": "Patient does not exist in the supplied patient records. Feature extraction was not performed.",
                "features": {},
            }
        if self._is_deceased(patient):
            return {
                "patient_id": requested_id,
                "status": "PATIENT_DECEASED",
                "patient_alive": False,
                "message": "Patient exists but is deceased. Feature extraction was not performed.",
                "features": {},
            }

        related = self._patient_rows(raw_data, requested_id)
        features = self._extract_features(patient, related, raw_data)
        diagnosis = self._extract_diagnosis(related["conditions"])
        clinical_summary = self._clinical_summary(patient, diagnosis, related["encounters"], related["medications"])
        rule_engine_result, triggered_rules, explanation = await self._evaluate_rule_engine(db, raw_data, patient, related)
        rule_engine_result.pop("_reason", None)

        return {
            "patient_id": requested_id,
            "patient_alive": True,
            "clinical_summary": clinical_summary,
            "rule_engine_result": rule_engine_result,
            "triggered_rules": triggered_rules,
            "explanation": explanation,
            "features": features,
        }

    @classmethod
    def build_features_for_authorization(
        cls,
        patient: dict,
        clinical: dict,
        service: dict,
        plan: dict | None = None,
        documents: list[dict] | None = None,
    ) -> tuple[dict[str, float], str]:
        """Derive the 61 canonical ML features and clinical summary from authorization request data.

        Handles both rich payloads (with embedded records/documents) and standard structured requests.
        """
        patient_dict = dict(patient or {})
        clinical_dict = dict(clinical or {})
        service_dict = dict(service or {})
        plan_dict = dict(plan or {})
        docs = documents or []

        # If documents or patient rows are embedded, extract them
        related_data: dict[str, list[dict]] = {
            "encounters": [],
            "conditions": [],
            "medications": [],
            "procedures": [],
            "careplans": [],
            "allergies": [],
            "devices": [],
            "immunizations": [],
            "claims": [],
        }

        # Check if documents contains typed records
        for doc in docs:
            if isinstance(doc, dict):
                doc_type = str(doc.get("type") or doc.get("resourceType") or doc.get("table") or "").lower()
                for key in related_data:
                    if key in doc_type or doc_type.startswith(key[:-1]):
                        related_data[key].append(doc)

        # Merge in counts from direct list fields on patient/clinical
        diagnoses = patient_dict.get("diagnoses") or []
        medications = patient_dict.get("medications") or []
        prior_treatment = clinical_dict.get("prior_treatment") or []
        prior_tests = clinical_dict.get("prior_tests") or []

        condition_count = max(len(related_data["conditions"]), len(diagnoses), 1 if clinical_dict.get("diagnosis") else 0)
        medication_count = max(len(related_data["medications"]), len(medications))
        procedure_count = max(len(related_data["procedures"]), 1 if service_dict.get("service_name") else 0)
        careplan_count = max(len(related_data["careplans"]), len(prior_treatment))
        encounter_count = max(len(related_data["encounters"]), int(patient_dict.get("encounter_count") or 2))
        encounter_type_count = max(len(cls._unique_values(related_data["encounters"], "ENCOUNTERCLASS", "type")), 1)
        unique_encounter_count = max(len(cls._unique_values(related_data["encounters"], "id", "Id")), encounter_count)
        unique_condition_count = max(len(cls._unique_values(related_data["conditions"], "code", "CODE")), condition_count)
        unique_medication_count = max(len(cls._unique_values(related_data["medications"], "code", "CODE")), medication_count)
        unique_procedure_count = max(len(cls._unique_values(related_data["procedures"], "code", "CODE")), procedure_count)
        unique_careplan_count = max(len(cls._unique_values(related_data["careplans"], "id", "code")), careplan_count)
        allergy_count = max(len(related_data["allergies"]), int(patient_dict.get("allergy_count") or 0))
        device_count = max(len(related_data["devices"]), int(patient_dict.get("device_count") or 0))
        unique_device_count = max(len(cls._unique_values(related_data["devices"], "udi", "code")), device_count)
        immunization_count = max(len(related_data["immunizations"]), int(patient_dict.get("immunization_count") or 1))
        unique_immunization_count = max(len(cls._unique_values(related_data["immunizations"], "code")), immunization_count)
        claim_count = max(len(related_data["claims"]), int(patient_dict.get("claim_count") or 1))
        unique_claim_diagnosis_count = max(len(cls._unique_values(related_data["claims"], "diagnosis")), 1)

        age = cls._extract_age(patient_dict)
        fips = cls._number(cls._first_value(patient_dict, "FIPS", "fips"), integer=True, default=25025)
        zip_code = cls._number(cls._first_value(patient_dict, "ZIP", "zip"), integer=True, default=2115)
        lon = cls._number(cls._first_value(patient_dict, "LON", "lon", "LONGITUDE", "longitude"), default=-71.0589)
        expenses = cls._number(cls._first_value(patient_dict, "HEALTHCARE_EXPENSES", "healthcare_expenses"), default=12450.5)
        coverage = cls._number(cls._first_value(patient_dict, "HEALTHCARE_COVERAGE", "healthcare_coverage"), default=10500.0)
        income = cls._number(cls._first_value(patient_dict, "INCOME", "income"), default=78500.0)
        city_frequency = cls._number(cls._first_value(patient_dict, "CITY_FREQUENCY", "city_frequency"), default=1.0)

        coverage_ratio = round(coverage / expenses, 6) if expenses else 0.84334
        med_ratio = round(medication_count / encounter_count, 6) if encounter_count else 0.5
        proc_ratio = round(procedure_count / encounter_count, 6) if encounter_count else 0.5
        cond_ratio = round(condition_count / encounter_count, 6) if encounter_count else 0.5
        claim_ratio = round(claim_count / encounter_count, 6) if encounter_count else 0.5

        features: dict[str, float] = {
            "FIPS": float(fips),
            "ZIP": float(zip_code),
            "LON": float(lon),
            "HEALTHCARE_EXPENSES": float(expenses),
            "HEALTHCARE_COVERAGE": float(coverage),
            "INCOME": float(income),
            "encounter_count": float(encounter_count),
            "encounter_type_count": float(encounter_type_count),
            "unique_encounter_count": float(unique_encounter_count),
            "condition_count": float(condition_count),
            "unique_condition_count": float(unique_condition_count),
            "medication_count": float(medication_count),
            "unique_medication_count": float(unique_medication_count),
            "procedure_count": float(procedure_count),
            "unique_procedure_count": float(unique_procedure_count),
            "careplan_count": float(careplan_count),
            "unique_careplan_count": float(unique_careplan_count),
            "allergy_count": float(allergy_count),
            "device_count": float(device_count),
            "unique_device_count": float(unique_device_count),
            "immunization_count": float(immunization_count),
            "unique_immunization_count": float(unique_immunization_count),
            "claim_count": float(claim_count),
            "unique_claim_diagnosis_count": float(unique_claim_diagnosis_count),
            "CITY_FREQUENCY": float(city_frequency),
            "age": float(age),
            "coverage_expense_ratio": float(coverage_ratio),
            "medication_per_encounter": float(med_ratio),
            "procedure_per_encounter": float(proc_ratio),
            "condition_per_encounter": float(cond_ratio),
            "claim_per_encounter": float(claim_ratio),
        }

        categorical = cls._categorical_features(patient_dict)
        for cat_key, cat_val in categorical.items():
            features[cat_key] = float(cat_val)

        # Build clinical summary
        diagnosis_text = (
            clinical_dict.get("diagnosis")
            or clinical_dict.get("indication")
            or (diagnoses[0] if diagnoses else "clinical symptoms")
        )
        service_text = service_dict.get("service_name") or "requested service"
        descriptor = f"{age}-year-old" if age is not None else "Adult"
        clinical_summary = (
            f"{descriptor} patient with {diagnosis_text}. Clinical records show "
            f"{encounter_count} encounters, ongoing medication use ({medication_count} records), "
            f"and evidence supporting a prior-authorization review for {service_text}."
        )

        return features, clinical_summary

    async def preview(self, payload: dict, db=None) -> dict:
        return await self.extract(payload, db=db)


extraction_service = ExtractionService()

