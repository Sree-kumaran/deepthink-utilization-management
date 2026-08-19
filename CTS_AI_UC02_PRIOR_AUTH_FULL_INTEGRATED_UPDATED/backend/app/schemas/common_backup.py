from typing import Literal
from pydantic import BaseModel,Field
Decision=Literal["APPROVE","PEND_FOR_NURSE_REVIEW","REQUEST_MORE_INFORMATION"]
class RuleDefinition(BaseModel):
    id:str=Field(min_length=1,max_length=100); name:str; field:str; operator:Literal["exists","not_exists","equals","not_equals","contains","not_contains","in","gte","lte","gt","lt"]; value:object|None=None; required:bool=True; reason:str; failure_outcome:Literal["PEND_FOR_NURSE_REVIEW","REQUEST_MORE_INFORMATION"]="PEND_FOR_NURSE_REVIEW"
