import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, FileCheck2, Loader2, ShieldCheck } from "lucide-react";
import DecisionCard from "../components/DecisionCard";
import DecisionWorkflow from "../components/DecisionWorkflow";
import api from "../services/api";

function display(value, fallback = "Not available") { if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return fallback; if (Array.isArray(value)) return value.join(", "); if (typeof value === "object") return JSON.stringify(value); return String(value); }
function nextAction(decision) { if (decision === "APPROVE") return "Proceed with authorization."; if (decision === "PEND_FOR_NURSE_REVIEW") return "Route the request to the nurse reviewer for final clinical review."; return "Collect the missing information and resubmit the request for evaluation."; }

export default function Decision() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = routeId || location.state?.requestId || location.state?.auth?.id;
  const [auth, setAuth] = useState(location.state?.auth || null);
  const [trace, setTrace] = useState(location.state?.trace || location.state?.evaluation || null);
  const [policy, setPolicy] = useState(location.state?.policy || null);
  const [policyVersion, setPolicyVersion] = useState(location.state?.policyVersion || null);
  const initialTrace = useRef(location.state?.trace || location.state?.evaluation || null);
  const initialPolicy = useRef(location.state?.policy || null);
  const initialPolicyVersion = useRef(location.state?.policyVersion || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) { setError("No authorization request ID was provided."); setLoading(false); return; }
      try {
        setLoading(true); setError(null);
        const authorization = await api.authorization.get(id);
        const decisionTrace = initialTrace.current || await api.authorization.trace(id);
        if (cancelled) return;
        setAuth(authorization); setTrace(decisionTrace);
        if (decisionTrace?.policy_id) {
          try { const p = initialPolicy.current || await api.policy.get(decisionTrace.policy_id); if (!cancelled) setPolicy(p); const v = initialPolicyVersion.current || await api.policy.getVersion(decisionTrace.policy_id, decisionTrace.policy_version); if (!cancelled) setPolicyVersion(v); } catch { /* optional metadata */ }
        }
      } catch (err) { if (!cancelled) setError(err.message || "Unable to load authorization decision."); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const outcome = auth?.decision || trace?.decision || "REQUEST_MORE_INFORMATION";
  const counts = useMemo(() => {
    const rules = trace?.rule_results || [];
    return {
      evaluated: Number(trace?.evaluated_rules ?? rules.length),
      passed: Number(trace?.passed_rules ?? 0),
      failed: Number(trace?.failed_rules ?? 0),
      missing: Number(trace?.missing_rules ?? 0),
    };
  }, [trace]);
  const confidenceValue = trace?.confidence ?? auth?.decision_confidence;
  const confidencePercent = confidenceValue !== undefined && confidenceValue !== null ? Math.round(Number(confidenceValue) <= 1 ? Number(confidenceValue) * 100 : Number(confidenceValue)) : null;
  const summary = (trace?.explanation || trace?.reasons || []).join(" ") || "The final recommendation is based on the completed backend policy evaluation.";

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" /><p className="text-sm text-text-secondary">Loading authorization decision...</p></div></div>;
  if (error) return <div className="mx-auto max-w-3xl"><button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} /> Go Back</button><div className="rounded-xl border border-danger/30 bg-danger/10 p-5 flex gap-3"><AlertCircle className="text-danger" size={20} /><div><p className="font-semibold text-danger">Unable to load authorization decision</p><p className="mt-1 text-sm text-danger/80">{error}</p></div></div></div>;

  const decisionModel = { outcome, confidence: trace?.confidence_level || auth?.decision_confidence_level, confidencePercent, };
  return <div className="mx-auto w-full max-w-[1400px]">
    <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} /> Go Back</button>
    <header className="mb-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex items-start gap-3"><div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={21} /></div><div><h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Authorization Decision</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">Final recommendation based on clinical evidence and policy evaluation.</p></div></div><div className="rounded-xl border border-border bg-surface px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Request ID</p><p className="mt-1 text-sm font-bold text-text-primary">{id}</p></div></div></header>
    <DecisionWorkflow current="decision" />
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-card"><div className="border-b border-border px-5 py-4 sm:px-6"><h2 className="text-sm font-bold text-text-primary">Request Summary</h2></div><div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0"><Summary label="Request ID" value={id} /><Summary label="Patient" value={auth?.patient?.patient_name || auth?.patient?.patient_id} /><Summary label="Requested Service" value={auth?.service?.service_name} /><Summary label="Policy" value={policy?.name || trace?.policy_id} /><Summary label="Policy Version" value={policyVersion?.version || trace?.policy_version} /></div></section>
    <div className="mx-auto w-full max-w-4xl"><DecisionCard decision={decisionModel} onTrace={() => navigate(`/decision-trace/${id}`, { state: { auth, trace, policy, policyVersion } })} />
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCheck2 size={18} /></div><div><h2 className="text-base font-bold text-text-primary">Decision Summary</h2><p className="mt-0.5 text-xs text-text-secondary">Reasoning based on the completed policy evaluation.</p></div></div><div className="mt-5 rounded-xl border border-border bg-surface-secondary p-4 sm:p-5"><p className="text-sm leading-7 text-text-primary">{summary}</p></div></section>
      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="mb-5"><h2 className="text-base font-bold text-text-primary">Evaluation Summary</h2><p className="mt-1 text-xs text-text-secondary">Values are taken from the backend decision trace.</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Policy Rules Evaluated" value={counts.evaluated} /><Metric label="Rules Passed" value={counts.passed} positive /><Metric label="Rules Failed" value={counts.failed} danger /><Metric label="Information Missing" value={counts.missing} warning /></div></section>
      <section className="mt-6 overflow-hidden rounded-2xl border border-primary/20 bg-surface shadow-card"><div className="border-b border-primary/10 bg-primary/[0.04] px-5 py-5 sm:px-6"><p className="text-[10px] font-bold uppercase tracking-widest text-primary">Next Step</p><h2 className="mt-1 text-lg font-bold text-text-primary">Recommended Next Action</h2></div><div className="p-5 sm:p-6"><p className="text-sm leading-6 text-text-secondary">{nextAction(outcome)}</p><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => navigate(`/decision-trace/${id}`, { state: { auth, trace, policy, policyVersion } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary hover:bg-surface-secondary sm:w-auto">Why this decision? <ArrowRight size={17} /></button><button type="button" onClick={() => navigate(`/policy-evaluation/${id}`, { state: { auth, trace, policy, policyVersion } })} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover sm:w-auto">Back to Policy Evaluation <ArrowLeft size={17} /></button></div></div></section>
    </div>
  </div>;
}
function Summary({ label, value }) { return <div className="px-5 py-4 transition hover:bg-surface-secondary"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-1.5 truncate text-sm font-semibold text-text-primary">{display(value)}</p></div>; }
function Metric({ label, value, positive, danger, warning }) { const cls = positive ? "text-success" : danger ? "text-danger" : warning ? "text-warning" : "text-text-primary"; return <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className={`mt-2 text-2xl font-bold ${cls}`}>{value}</p></div>; }
