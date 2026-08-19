from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import RuleDefinition


class PolicyCreate(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    version: str = "v1"
    effective_from: str | None = None
    rules: list[RuleDefinition] = Field(default_factory=list)
    source_references: list[dict] = Field(default_factory=list)
    raw_content: str = Field(min_length=1)


class PolicyVersionCreate(BaseModel):
    version: str = Field(min_length=1, max_length=50)
    effective_from: str | None = None
    effective_to: str | None = None
    status: str = "DRAFT"
    rules: list[RuleDefinition] = Field(default_factory=list)
    source_references: list[dict] = Field(default_factory=list)
    raw_content: str = Field(min_length=1)


class PolicyResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    policy_family: str | None = None
    active_version: str
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PolicyVersionResponse(BaseModel):
    id: str
    policy_id: str
    version: str
    status: str
    effective_from: str | None
    effective_to: str | None
    rules: list
    source_references: list
    raw_content: str | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="policy_metadata", serialization_alias="metadata")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
