from __future__ import annotations
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AuditEvent


async def record_audit(
    db: AsyncSession,
    event_type: str,
    request_id: str | None = None,
    payload: dict[str, Any] | None = None,
    actor: str = "system",
    **kwargs: Any,
) -> AuditEvent:
    actual_payload = payload if payload is not None else kwargs.get("details", {})
    actual_actor = actor or kwargs.get("user", "system")
    event = AuditEvent(
        event_type=event_type,
        request_id=request_id,
        actor=actual_actor,
        payload=actual_payload,
    )
    db.add(event)
    await db.flush()
    return event

