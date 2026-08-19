from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.review_service import ReviewService


class Result:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


@pytest.mark.asyncio
async def test_create_review_requires_pending_status():
    db = AsyncMock()
    db.execute.side_effect = [Result(SimpleNamespace(id="req-1", status="DECIDED")), Result(None)]

    with pytest.raises(Exception) as exc_info:
        await ReviewService().create_review(
            db, "req-1", SimpleNamespace(assigned_to="Nurse Reviewer", notes=None)
        )

    assert "not currently pending nurse review" in str(exc_info.value)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_complete_approve_moves_authorization_to_decided():
    db = AsyncMock()
    db.add = MagicMock()
    review = SimpleNamespace(
        id="review-1", request_id="req-1", status="OPEN", assigned_to="Nurse Reviewer",
        reviewer_decision=None, notes=None, completed_at=None
    )
    request = SimpleNamespace(id="req-1", status="PENDING_NURSE_REVIEW", decision="PEND_FOR_NURSE_REVIEW")
    db.execute.side_effect = [Result(review), Result(request)]

    with patch("app.services.review_service.record_audit", new=AsyncMock()):
        result = await ReviewService().complete_review(
            db, "review-1", SimpleNamespace(reviewer_decision="APPROVE", notes="Approved")
        )

    assert request.status == "DECIDED"
    assert request.decision == "APPROVE"
    assert review.status == "COMPLETED"
    assert result is review


@pytest.mark.asyncio
async def test_complete_pend_creates_next_open_review():
    db = AsyncMock()
    db.add = MagicMock()
    review = SimpleNamespace(
        id="review-1", request_id="req-1", status="OPEN", assigned_to="Nurse Reviewer",
        reviewer_decision=None, notes=None, completed_at=None
    )
    request = SimpleNamespace(id="req-1", status="PENDING_NURSE_REVIEW", decision="PEND_FOR_NURSE_REVIEW")
    db.execute.side_effect = [Result(review), Result(request)]

    with patch("app.services.review_service.record_audit", new=AsyncMock()):
        await ReviewService().complete_review(
            db, "review-1", SimpleNamespace(reviewer_decision="PEND_FOR_NURSE_REVIEW", notes="Further review")
        )

    assert request.status == "PENDING_NURSE_REVIEW"
    assert review.status == "COMPLETED"
    created = [call.args[0] for call in db.add.call_args_list if getattr(call.args[0], "status", None) == "OPEN"]
    assert len(created) == 1
    assert created[0].request_id == "req-1"
