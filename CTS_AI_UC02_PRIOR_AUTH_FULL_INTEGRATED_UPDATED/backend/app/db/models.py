from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utcnow():
    return datetime.now(timezone.utc)


class AuthorizationRequest(Base):
    __tablename__ = "authorization_requests"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    external_request_id: Mapped[str | None] = mapped_column(
        String(120),
        unique=True,
    )

    idempotency_key: Mapped[str | None] = mapped_column(
        String(180),
        unique=True,
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default="RECEIVED",
        index=True,
    )

    decision: Mapped[str | None] = mapped_column(
        String(50),
        index=True,
    )

    patient: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    provider: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    plan: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    service: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    clinical: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    documents: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    extraction_confidence: Mapped[float | None] = mapped_column(
        Float,
    )

    missing_information: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    conflicting_information: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    evaluations = relationship(
        "RuleEvaluation",
        back_populates="request",
        cascade="all, delete-orphan",
    )

    # Workflow invariant: a PENDING_NURSE_REVIEW authorization must have an OPEN NurseReview.
    reviews = relationship(
        "NurseReview",
        back_populates="request",
        cascade="all, delete-orphan",
    )

    audit_events = relationship(
        "AuditEvent",
        back_populates="request",
        cascade="all, delete-orphan",
    )


class Policy(Base):
    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(
        String(100),
        primary_key=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
    )

    policy_family: Mapped[str | None] = mapped_column(String(100))
    

    active_version: Mapped[str] = mapped_column(
        String(50),
        default="v1",
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    versions = relationship(
        "PolicyVersion",
        back_populates="policy",
        cascade="all, delete-orphan",
    )


class PolicyVersion(Base):
    __tablename__ = "policy_versions"

    id: Mapped[str] = mapped_column(
        String(150),
        primary_key=True,
    )

    policy_id: Mapped[str] = mapped_column(
        ForeignKey("policies.id"),
        index=True,
    )

    version: Mapped[str] = mapped_column(
        String(50),
    )

    effective_from: Mapped[str | None] = mapped_column(
        String(40),
    )

    effective_to: Mapped[str | None] = mapped_column(
        String(40),
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="DRAFT",
    )

    rules: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    source_references: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    # Complete extracted text from the original policy.
    raw_content: Mapped[str | None] = mapped_column(
        Text,
    )

    # Python attribute is policy_metadata because
    # "metadata" is reserved by SQLAlchemy's Declarative API.
    # The actual PostgreSQL column remains named "metadata".
    policy_metadata: Mapped[dict] = mapped_column(
        "metadata",
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    policy = relationship(
        "Policy",
        back_populates="versions",
    )


class RuleEvaluation(Base):
    __tablename__ = "rule_evaluations"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    request_id: Mapped[str] = mapped_column(
        ForeignKey(
            "authorization_requests.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    rule_id: Mapped[str] = mapped_column(
        String(100),
    )

    rule_name: Mapped[str] = mapped_column(
        String(255),
    )

    result: Mapped[str] = mapped_column(
        String(30),
    )

    expected: Mapped[str | None] = mapped_column(
        Text,
    )

    actual: Mapped[str | None] = mapped_column(
        Text,
    )

    reason: Mapped[str] = mapped_column(
        Text,
    )

    evidence: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    request = relationship(
        "AuthorizationRequest",
        back_populates="evaluations",
    )


class NurseReview(Base):
    __tablename__ = "nurse_reviews"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    request_id: Mapped[str] = mapped_column(
        ForeignKey(
            "authorization_requests.id",
            ondelete="CASCADE",
        ),
        index=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        default="OPEN",
        index=True,
    )

    assigned_to: Mapped[str | None] = mapped_column(
        String(150),
    )

    reviewer_decision: Mapped[str | None] = mapped_column(
        String(50),
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
    )

    request = relationship(
        "AuthorizationRequest",
        back_populates="reviews",
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    request_id: Mapped[str | None] = mapped_column(
        ForeignKey(
            "authorization_requests.id",
            ondelete="SET NULL",
        ),
    )

    event_type: Mapped[str] = mapped_column(
        String(100),
        index=True,
    )

    actor: Mapped[str] = mapped_column(
        String(150),
        default="system",
    )

    payload: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
    )

    request = relationship(
        "AuthorizationRequest",
        back_populates="audit_events",
    )