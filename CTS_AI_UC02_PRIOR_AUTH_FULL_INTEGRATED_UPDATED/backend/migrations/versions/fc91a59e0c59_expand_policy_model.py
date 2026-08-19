"""expand policy model

Revision ID: fc91a59e0c59
Revises: 0001_initial
Create Date: 2026-08-14 19:17:41.182606
"""

from alembic import op
import sqlalchemy as sa


revision = "fc91a59e0c59"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade():
    # ---------------------------------------------------------
    # POLICIES
    # ---------------------------------------------------------

    op.add_column(
        "policies",
        sa.Column(
            "policy_family",
            sa.String(length=100),
            nullable=True,
        ),
    )

    # ---------------------------------------------------------
    # POLICY VERSIONS
    # ---------------------------------------------------------

    # Raw extracted text/content from the source policy document.
    op.add_column(
        "policy_versions",
        sa.Column(
            "raw_content",
            sa.Text(),
            nullable=True,
        ),
    )

    # Additional structured metadata.
    #
    # Add it as nullable first because policy_versions already
    # contains existing rows.
    op.add_column(
        "policy_versions",
        sa.Column(
            "metadata",
            sa.JSON(),
            nullable=True,
        ),
    )

    # Populate existing rows so the column can safely become
    # non-nullable.
    op.execute(
        sa.text(
            """
            UPDATE policy_versions
            SET metadata = '{}'
            WHERE metadata IS NULL
            """
        )
    )

    op.alter_column(
        "policy_versions",
        "metadata",
        existing_type=sa.JSON(),
        nullable=False,
    )

    # Keep the original uniqueness guarantee:
    #
    # One policy cannot have the same version twice.
    #
    # IMPORTANT:
    # Do NOT drop uq_policy_version.
    #
    # It already exists from 0001_initial.

    # Add an index for policy_id if it isn't already indexed.
    op.create_index(
        "ix_policy_versions_policy_id",
        "policy_versions",
        ["policy_id"],
        unique=False,
    )

    # ---------------------------------------------------------
    # RULE EVALUATIONS
    # ---------------------------------------------------------

    op.create_index(
        "ix_rule_evaluations_request_id",
        "rule_evaluations",
        ["request_id"],
        unique=False,
    )

    # ---------------------------------------------------------
    # NURSE REVIEWS
    # ---------------------------------------------------------

    op.create_index(
        "ix_nurse_reviews_request_id",
        "nurse_reviews",
        ["request_id"],
        unique=False,
    )

    # ---------------------------------------------------------
    # AUDIT EVENTS
    # ---------------------------------------------------------

    # Preserve the existing request_id index from 0001_initial.
    #
    # Also add event_type because the application can query the
    # audit trail by event type.
    op.create_index(
        "ix_audit_events_event_type",
        "audit_events",
        ["event_type"],
        unique=False,
    )

    # ---------------------------------------------------------
    # AUTHORIZATION REQUESTS
    # ---------------------------------------------------------

    # The original migration already has indexes on status and
    # decision. Keep those indexes rather than replacing them
    # with differently named duplicates.
    #
    # No changes required here.


def downgrade():
    # ---------------------------------------------------------
    # Reverse the changes made by upgrade()
    # ---------------------------------------------------------

    # Audit events
    op.drop_index(
        "ix_audit_events_event_type",
        table_name="audit_events",
    )

    # Nurse reviews
    op.drop_index(
        "ix_nurse_reviews_request_id",
        table_name="nurse_reviews",
    )

    # Rule evaluations
    op.drop_index(
        "ix_rule_evaluations_request_id",
        table_name="rule_evaluations",
    )

    # Policy versions
    op.drop_index(
        "ix_policy_versions_policy_id",
        table_name="policy_versions",
    )

    # Metadata
    op.drop_column(
        "policy_versions",
        "metadata",
    )

    # Raw policy content
    op.drop_column(
        "policy_versions",
        "raw_content",
    )

    # Policy family
    op.drop_column(
        "policies",
        "policy_family",
    )