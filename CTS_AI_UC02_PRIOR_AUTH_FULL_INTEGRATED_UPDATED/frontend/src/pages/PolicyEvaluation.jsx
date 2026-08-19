import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronDown, Loader2, XCircle, Clock3 } from "lucide-react";
import api from "../services/api";
import DecisionWorkflow from "../components/DecisionWorkflow";
import { choosePolicy } from "../utils/policySelection";

function display(value, fallback = "Not available") { if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return fallback; if (Array.isArray(value)) return value.join(", "); if (typeof value === "object") return JSON.stringify(value); return String(value); }
function resultStyle(result) { const value = String(result || "MISSING").toUpperCase(); if (value === "PASS" || value === "PASSED") return { label: "PASS", icon: CheckCircle2, cls: "bg-success/10 text-success border-success/20" }; if (value === "FAIL" || value === "FAILED") return { label: "FAIL", icon: XCircle, cls: "bg-danger/10 text-danger border-danger/20" }; return { label: "MISSING", icon: Clock3, cls: "bg-warning/10 text-warning border-warning/20" }; }

export default function PolicyEvaluation() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = routeId || location.state?.requestId || location.state?.authorization?.id;
  const [auth, setAuth] = useState(location.state?.auth || location.state?.authorization || null);
  const [evaluation, setEvaluation] = useState(location.state?.trace || location.state?.evaluation || null);
  const [policy, setPolicy] = useState(location.state?.policy || null);
  const [policyVersion, setPolicyVersion] = useState(location.state?.policyVersion || null);
  const initialEvaluation = useRef(location.state?.trace || location.state?.evaluation || null);
  const initialPolicy = useRef(location.state?.policy || null);
  const initialPolicyVersion = useRef(location.state?.policyVersion || null);
  const [openRules, setOpenRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) { setError("No authorization request ID was provided."); setLoading(false); return; }
      try {
        setLoading(true); setError(null);
        const authorization = await api.authorization.get(id);
        if (cancelled) return;
        setAuth(authorization);

        let trace = initialEvaluation.current;
        if (!trace) {
          try { trace = await api.authorization.trace(id); } catch { trace = null; }
        }

        const policies = await api.policy.list();
        if (cancelled) return;
        let selected = trace?.policy_id ? policies.find((item) => item.id === trace.policy_id) : null;
        selected = selected || initialPolicy.current || choosePolicy(policies, { payer: authorization.plan?.plan_name, service: authorization.service?.service_name });
        if (!selected) throw new Error("No active policy is available for evaluation.");
        setPolicy(selected);

        let selectedVersion = null;
        if (trace?.policy_version) {
          selectedVersion = await api.policy.getVersion(selected.id, trace.policy_version);
        } else if (initialPolicyVersion.current) {
          selectedVersion = initialPolicyVersion.current;
        } else if (selected.active_version) {
          selectedVersion = await api.policy.getActiveVersion(selected.id);
        }
        if (cancelled) return;
        setPolicyVersion(selectedVersion);

        if (!trace?.rule_results?.length) {
          trace = await api.authorization.evaluate(id, selected.id, selectedVersion?.version || selected.active_version);
        }
        if (!cancelled) setEvaluation(trace);
      } catch (err) { if (!cancelled) setError(err.message || "Failed to load policy evaluation."); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const rules = evaluation?.rule_results || [];
  const counts = useMemo(() => {
    const currentRules = evaluation?.rule_results || [];
    return {
      evaluated: Number(evaluation?.evaluated_rules ?? currentRules.length),
      passed: Number(evaluation?.passed_rules ?? currentRules.filter((r) => ["PASS", "PASSED"].includes(String(r.result).toUpperCase())).length),
      failed: Number(evaluation?.failed_rules ?? currentRules.filter((r) => ["FAIL", "FAILED"].includes(String(r.result).toUpperCase())).length),
      missing: Number(evaluation?.missing_rules ?? currentRules.filter((r) => String(r.result).toUpperCase() === "MISSING").length),
    };
  }, [evaluation]);

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" /><p className="text-sm text-text-secondary">Loading policy evaluation...</p></div></div>;
  if (error) return <div className="mx-auto max-w-3xl"><button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} /> Go Back</button><div className="rounded-xl border border-danger/30 bg-danger/10 p-5 flex gap-3"><AlertCircle className="text-danger" size={20} /><div><p className="font-semibold text-danger">Policy evaluation failed</p><p className="mt-1 whitespace-pre-line text-sm text-danger/80">{error}</p></div></div></div>;

  return <div className="mx-auto w-full max-w-[1400px]">
    <button onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} /> Go Back</button>
    <header className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-card"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">Policy Evaluation</p><h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">Policy Evaluation</h1><p className="mt-2 text-sm leading-6 text-text-secondary">Clinical information is being evaluated against the applicable authorization policy.</p></div><span className="rounded-full bg-success/10 px-4 py-2 text-xs font-bold text-success">Evaluation Complete</span></div><div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"><Summary label="Patient" value={auth?.patient?.patient_name || auth?.patient?.patient_id} /><Summary label="Patient ID" value={auth?.patient?.patient_id} /><Summary label="Diagnosis" value={auth?.clinical?.diagnosis} /><Summary label="Requested Service" value={auth?.service?.service_name} /><Summary label="Insurance" value={auth?.plan?.plan_name} /></div></header>

    <DecisionWorkflow current="policy" />

    <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Summary label="Policy" value={policy?.name || evaluation?.policy_id} /><Summary label="Version" value={policyVersion?.version || evaluation?.policy_version} /><Summary label="Status" value={evaluation?.decision ? "Evaluation Complete" : "Pending"} /></div></section>

    <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-bold text-text-primary">Policy Rules</h2><p className="mt-1 text-xs text-text-secondary">Every rule below is rendered from the existing backend decision trace.</p></div><div className="text-right"><p className="text-xs font-semibold text-text-secondary">Rules Evaluated</p><p className="mt-1 text-2xl font-bold text-primary">{counts.evaluated}</p></div></div><div className="mt-5 space-y-3">{rules.length ? rules.map((rule) => { const info = resultStyle(rule.result); const Icon = info.icon; const open = Boolean(openRules[rule.rule_id]); return <div key={rule.rule_id} className="overflow-hidden rounded-xl border border-border bg-surface-secondary"><button type="button" onClick={() => setOpenRules((current) => ({ ...current, [rule.rule_id]: !open }))} className="flex w-full items-center justify-between gap-4 p-4 text-left"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${info.cls}`}><Icon size={17} /></span><div><p className="text-sm font-bold text-text-primary">{rule.rule_id} — {rule.rule_name}</p><p className="mt-1 text-xs text-text-secondary">{display(rule.reason)}</p></div></div><div className="flex items-center gap-3"><span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${info.cls}`}>{info.label}</span><ChevronDown size={17} className={`text-text-muted transition ${open ? "rotate-180" : ""}`} /></div></button>{open && <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-3"><Detail label="Evidence" value={rule.evidence || rule.actual} /><Detail label="Expected" value={rule.expected} /><Detail label="Explanation" value={rule.reason} /></div>}</div>; }) : <p className="rounded-xl border border-border bg-surface-secondary p-5 text-sm text-text-secondary">No policy rules were returned by the backend.</p>}</div></section>

    <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Rules Evaluated" value={counts.evaluated} /><Metric label="Passed" value={counts.passed} positive /><Metric label="Failed" value={counts.failed} danger /><Metric label="Missing" value={counts.missing} warning /></section>

    <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between"><button type="button" onClick={() => navigate(`/decision-trace/${id}`, { state: { auth, trace: evaluation, policy, policyVersion } })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary hover:bg-surface-secondary"><ArrowLeft size={17} /> Back to Decision Trace</button><button type="button" onClick={() => navigate(`/decision/${id}`, { state: { auth, trace: evaluation, policy, policyVersion } })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover">View Authorization Decision <ArrowRight size={17} /></button></div>
  </div>;
}
function Summary({ label, value }) { return <div className="rounded-xl border border-border bg-surface-secondary p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-1.5 truncate text-sm font-semibold text-text-primary">{display(value)}</p></div>; }
function Detail({ label, value }) { return <div><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-primary">{display(value)}</p></div>; }
function Metric({ label, value, positive, danger, warning }) { const cls = positive ? "text-success" : danger ? "text-danger" : warning ? "text-warning" : "text-text-primary"; return <div className="rounded-xl border border-border bg-surface p-4 shadow-card"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</p><p className={`mt-2 text-2xl font-bold ${cls}`}>{value}</p></div>; }
