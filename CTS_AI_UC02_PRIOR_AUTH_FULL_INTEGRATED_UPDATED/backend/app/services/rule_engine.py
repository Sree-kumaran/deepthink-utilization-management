from dataclasses import dataclass
@dataclass
class RuleResult:
    rule_id:str; rule_name:str; result:str; expected:str|None; actual:str|None; reason:str; evidence:dict
class DeterministicRuleEngine:
    @staticmethod
    def get_value(data,path):
        value=data
        for part in path.split("."):
            if not isinstance(value,dict) or part not in value: return None
            value=value[part]
        return value
    def evaluate_rule(self,data,rule):
        actual=self.get_value(data,rule["field"]); op=rule["operator"]; expected=rule.get("value")
        try:
            if op=="exists": passed=actual not in (None,"",[])
            elif op=="not_exists": passed=actual in (None,"",[])
            elif op=="equals": passed=actual==expected
            elif op=="not_equals": passed=actual!=expected
            elif op=="contains": passed=expected in actual if isinstance(actual,(list,str,dict)) else False
            elif op=="not_contains": passed=expected not in actual if isinstance(actual,(list,str,dict)) else True
            elif op=="in": passed=actual in expected if isinstance(expected,list) else False
            elif op=="gte": passed=actual is not None and actual>=expected
            elif op=="lte": passed=actual is not None and actual<=expected
            elif op=="gt": passed=actual is not None and actual>expected
            elif op=="lt": passed=actual is not None and actual<expected
            else: raise ValueError(f"Unsupported operator: {op}")
        except TypeError: passed=False
        return RuleResult(rule["id"],rule["name"],"PASS" if passed else ("MISSING" if actual in (None,"",[]) and rule.get("required",True) else "FAIL"),str(expected) if expected is not None else None,str(actual) if actual is not None else None,rule["reason"],{"field":rule["field"],"operator":op,"failure_outcome":rule.get("failure_outcome"),"source":"deterministic_rule_engine"})
    def evaluate(self,data,rules,preexisting_conflicts=None):
        results=[self.evaluate_rule(data,r) for r in rules]
        for conflict in preexisting_conflicts or []: results.append(RuleResult(f"CONFLICT:{len(results)+1}","Input consistency check","CONFLICT",None,conflict,f"Conflicting information detected: {conflict}",{"type":"input_conflict"}))
        if any(r.result=="CONFLICT" for r in results): decision="PEND_FOR_NURSE_REVIEW"
        elif any(r.result=="MISSING" for r in results): decision="REQUEST_MORE_INFORMATION"
        elif any(r.result=="FAIL" for r in results): decision="PEND_FOR_NURSE_REVIEW"
        else: decision="APPROVE"
        return decision,results
