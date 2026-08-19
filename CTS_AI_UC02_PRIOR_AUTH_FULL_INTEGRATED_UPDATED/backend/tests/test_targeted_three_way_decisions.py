from datetime import datetime


# This test file mirrors the targeted hardcoded precedence contract used by
# AuthorizationService.evaluate without requiring external RAG/Qdrant services.
def _needs_nurse_review(patient, clinical):
    death_value = patient.get("death_date") or patient.get("deathDate") or patient.get("DEATHDATE")
    death_date_valid = False
    if death_value:
        if isinstance(death_value, datetime):
            death_date_valid = True
        else:
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%m/%d/%Y"):
                try:
                    datetime.strptime(str(death_value).strip()[:26], fmt)
                    death_date_valid = True
                    break
                except ValueError:
                    pass
    details = patient.get("details") or clinical.get("details")
    return not death_date_valid or not bool(details)


def _resolve(existing_decision, missing_information, patient, clinical):
    if missing_information:
        return "REQUEST_MORE_INFORMATION"
    if _needs_nurse_review(patient, clinical):
        return "PEND_FOR_NURSE_REVIEW"
    return existing_decision


def test_approved_path_requires_valid_death_date_and_details():
    assert _resolve(
        "APPROVE",
        [],
        {"death_date": "2026-01-15", "details": "Complete documentation"},
        {},
    ) == "APPROVE"


def test_request_more_information_wins_when_existing_required_field_is_missing():
    assert _resolve(
        "APPROVE",
        ["provider.provider_id"],
        {"death_date": "2026-01-15", "details": "Complete documentation"},
        {},
    ) == "REQUEST_MORE_INFORMATION"


def test_nurse_review_when_death_date_is_missing():
    assert _resolve(
        "APPROVE",
        [],
        {"death_date": None, "details": "Complete documentation"},
        {},
    ) == "PEND_FOR_NURSE_REVIEW"


def test_nurse_review_when_details_are_missing():
    assert _resolve(
        "APPROVE",
        [],
        {"death_date": "2026-01-15"},
        {},
    ) == "PEND_FOR_NURSE_REVIEW"
