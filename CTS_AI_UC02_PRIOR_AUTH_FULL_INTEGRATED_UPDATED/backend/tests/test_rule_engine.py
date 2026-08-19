from app.services.rule_engine import DeterministicRuleEngine
def test_approve():
    e=DeterministicRuleEngine(); data={"clinical":{"diagnosis":"Knee pain","symptom_duration_weeks":8,"prior_treatment":["PT"],"indication":"Persistent symptoms"},"plan":{"plan_id":"A"}}; rules=[{"id":"1","name":"dx","field":"clinical.diagnosis","operator":"exists","required":True,"reason":"dx"},{"id":"2","name":"duration","field":"clinical.symptom_duration_weeks","operator":"gte","value":6,"required":True,"reason":"duration"},{"id":"3","name":"tx","field":"clinical.prior_treatment","operator":"exists","required":True,"reason":"tx"},{"id":"4","name":"ind","field":"clinical.indication","operator":"exists","required":True,"reason":"ind"},{"id":"5","name":"plan","field":"plan.plan_id","operator":"exists","required":True,"reason":"plan"}]; d,r=e.evaluate(data,rules); assert d=="APPROVE" and all(x.result=="PASS" for x in r)
def test_more_info():
    e=DeterministicRuleEngine(); d,r=e.evaluate({"clinical":{}},[{"id":"1","name":"dx","field":"clinical.diagnosis","operator":"exists","required":True,"reason":"dx"}]); assert d=="REQUEST_MORE_INFORMATION" and r[0].result=="MISSING"
def test_pend():
    e=DeterministicRuleEngine(); d,r=e.evaluate({"clinical":{"symptom_duration_weeks":3}},[{"id":"1","name":"duration","field":"clinical.symptom_duration_weeks","operator":"gte","value":6,"required":True,"reason":"duration"}]); assert d=="PEND_FOR_NURSE_REVIEW" and r[0].result=="FAIL"
def test_conflict():
    e=DeterministicRuleEngine(); d,r=e.evaluate({},[],["4 weeks in one document; 8 weeks in another"]); assert d=="PEND_FOR_NURSE_REVIEW" and r[0].result=="CONFLICT"
