from datetime import datetime
from pydantic import BaseModel,ConfigDict,Field
from app.schemas.common import RuleDefinition
class PolicyCreate(BaseModel):
    id:str; name:str; description:str|None=None; version:str="v1"; effective_from:str|None=None; rules:list[RuleDefinition]=Field(min_length=1); source_references:list[dict]=Field(default_factory=list)
class PolicyVersionCreate(BaseModel):
    version:str; effective_from:str|None=None; effective_to:str|None=None; status:str="DRAFT"; rules:list[RuleDefinition]=Field(min_length=1); source_references:list[dict]=Field(default_factory=list)
class PolicyResponse(BaseModel):
    id:str; name:str; active_version:str; active:bool; created_at:datetime
    model_config=ConfigDict(from_attributes=True)
class PolicyVersionResponse(BaseModel):
    id:str; policy_id:str; version:str; status:str; effective_from:str|None; effective_to:str|None; rules:list; source_references:list
    model_config=ConfigDict(from_attributes=True)
