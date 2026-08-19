import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Stethoscope,
  XCircle,
} from "lucide-react";
import api from "../services/api";
import DecisionWorkflow from "../components/DecisionWorkflow";

function display(value, fallback = "Not available") {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && !value.length)
  )
    return fallback;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusInfo(result) {
  const value = String(result || "MISSING").toUpperCase();
  if (value === "PASS" || value === "PASSED")
    return {
      label: "PASS",
      icon: CheckCircle2,
      classes: "bg-success/10 text-success border-success/20",
    };
  if (value === "FAIL" || value === "FAILED")
    return {
      label: "FAIL",
      icon: XCircle,
      classes: "bg-danger/10 text-danger border-danger/20",
    };
  return {
    label: "MISSING",
    icon: Clock3,
    classes: "bg-warning/10 text-warning border-warning/20",
  };
}

export default function DecisionTrace() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = routeId || location.state?.requestId || location.state?.auth?.id;
  const [auth, setAuth] = useState(location.state?.auth || null);
  const [trace, setTrace] = useState(location.state?.trace || null);
  const [policy, setPolicy] = useState(null);
  const [policyVersion, setPolicyVersion] = useState(null);
  const [openRules, setOpenRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkingNurseReview, setCheckingNurseReview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setError("No authorization request ID was provided.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [authorization, decisionTrace] = await Promise.all([
          api.authorization.get(id),
          api.authorization.trace(id),
        ]);
        if (cancelled) return;
        setAuth(authorization);
        setTrace(decisionTrace);
        if (decisionTrace?.policy_id) {
          try {
            const p = await api.policy.get(decisionTrace.policy_id);
            if (!cancelled) setPolicy(p);
            if (decisionTrace.policy_version) {
              const v = await api.policy.getVersion(
                decisionTrace.policy_id,
                decisionTrace.policy_version
              );
              if (!cancelled) setPolicyVersion(v);
            }
          } catch {
            /* policy metadata is supplemental */
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load the decision trace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const rules = trace?.rule_results || [];
  const counts = useMemo(() => {
    const currentRules = trace?.rule_results || [];
    return {
      evaluated: Number(trace?.evaluated_rules ?? currentRules.length),
      passed: Number(
        trace?.passed_rules ??
          currentRules.filter((r) =>
            ["PASS", "PASSED"].includes(String(r.result).toUpperCase())
          ).length
      ),
      failed: Number(
        trace?.failed_rules ??
          currentRules.filter((r) =>
            ["FAIL", "FAILED"].includes(String(r.result).toUpperCase())
          ).length
      ),
      missing: Number(
        trace?.missing_rules ??
          currentRules.filter((r) => String(r.result).toUpperCase() === "MISSING")
            .length
      ),
    };
  }, [trace]);

  const completion = counts.evaluated
    ? Math.min(
        100,
        Math.round(
          ((counts.passed + counts.failed + counts.missing) / counts.evaluated) * 100
        )
      )
    : 0;

  const isPendingNurseReview =
    auth?.status === "PENDING_NURSE_REVIEW" ||
    auth?.decision === "PEND_FOR_NURSE_REVIEW";

  const goToNurseReview = async () => {
    setCheckingNurseReview(true);
    try {
      const authorization = await api.authorization.get(id);
      if (authorization?.status !== "PENDING_NURSE_REVIEW") {
        throw new Error(
          "Authorization request is not currently pending nurse review."
        );
      }
      navigate(`/nurse-review/${id}`);
    } catch (err) {
      setError(
        err.message || "This request is not currently available for nurse review."
      );
    } finally {
      setCheckingNurseReview(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-text-secondary">Loading decision trace...</p>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="mx-auto max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} /> Go Back
        </button>
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 flex items-start gap-3">
          <AlertCircle className="text-danger" size={20} />
          <div>
            <p className="font-semibold text-danger">Unable to load decision trace</p>
            <p className="mt-1 whitespace-pre-line text-sm text-danger/80">{error}</p>
          </div>
        </div>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <button
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
      >
        <ArrowLeft size={16} /> Go Back
      </button>

      <header className="mb-6 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Decision Trace
            </p>
            <h1 className="mt-1 text-2xl font-bold text-text-primary sm:text-3xl">
              Why This Decision?
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
              Review the clinical evidence, policy conditions, evaluation results, and final recommendation.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-4 py-2 text-xs font-bold text-primary">
            {display(trace?.decision || auth?.decision)}
          </span>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Summary label="Request ID" value={id} />
          <Summary
            label="Patient"
            value={auth?.patient?.patient_name || auth?.patient?.patient_id}
          />
          <Summary label="Requested Service" value={auth?.service?.service_name} />
          <Summary label="Policy" value={policy?.name || trace?.policy_id} />
          <Summary
            label="Policy Version"
            value={trace?.policy_version || policyVersion?.version}
          />
        </div>
      </header>

      <DecisionWorkflow current="rules" />

      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Evaluation Summary</h2>
            <p className="mt-1 text-xs text-text-secondary">
              All rule results returned by the backend decision trace.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-text-secondary">
              Evaluation Completion
            </p>
            <p className="mt-1 text-2xl font-bold text-primary">{completion}%</p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Rules Evaluated" value={counts.evaluated} />
          <Metric label="Passed" value={counts.passed} positive />
          <Metric label="Failed" value={counts.failed} danger />
          <Metric label="Missing" value={counts.missing} warning />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-bold text-text-primary">Conditions Evaluated</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Expand a condition to see the backend result, evidence, and explanation.
        </p>
        <div className="mt-5 space-y-3">
          {rules.length ? (
            rules.map((rule) => {
              const info = statusInfo(rule.result);
              const Icon = info.icon;
              const open = Boolean(openRules[rule.rule_id]);
              return (
                <div
                  key={rule.rule_id}
                  className="overflow-hidden rounded-xl border border-border bg-surface-secondary"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenRules((current) => ({
                        ...current,
                        [rule.rule_id]: !open,
                      }))
                    }
                    className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${info.classes}`}
                      >
                        <Icon size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary">
                          {display(rule.rule_name, rule.rule_id)}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {rule.rule_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-bold ${info.classes}`}
                      >
                        {info.label}
                      </span>
                      <ChevronDown
                        size={17}
                        className={`text-text-muted transition ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>
                  {open && (
                    <div className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-3">
                      <Detail
                        label="Supporting Evidence"
                        value={rule.evidence || rule.actual}
                      />
                      <Detail label="Expected" value={rule.expected} />
                      <Detail label="Explanation" value={rule.reason} />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-border bg-surface-secondary p-5 text-sm text-text-secondary">
              No rule evaluations are available for this request.
            </p>
          )}
        </div>
      </section>

      {trace?.explanation?.length || trace?.reasons?.length ? (
        <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-base font-bold text-text-primary">
            AI / Decision Explanation
          </h2>
          <ul className="mt-3 space-y-2">
            {(trace.explanation || trace.reasons).map((item, index) => (
              <li key={index} className="text-sm leading-6 text-text-secondary">
                • {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:justify-between">
        {isPendingNurseReview ? (
          <button
            type="button"
            onClick={goToNurseReview}
            disabled={checkingNurseReview}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            <Stethoscope size={17} />{" "}
            {checkingNurseReview ? "Checking Nurse Review..." : "Go to Nurse Review"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate(`/authorization/${id}`)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary hover:bg-surface-secondary"
          >
            <ArrowLeft size={17} /> Back to Authorization Details
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            navigate(`/policy-evaluation/${id}`, {
              state: { auth, trace, policy, policyVersion },
            })
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          Continue to Policy Evaluation <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1.5 truncate text-sm font-semibold text-text-primary">
        {display(value)}
      </p>
    </div>
  );
}

function Metric({ label, value, positive, danger, warning }) {
  const color = positive
    ? "text-success"
    : danger
    ? "text-danger"
    : warning
    ? "text-warning"
    : "text-text-primary";
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-primary">
        {display(value)}
      </p>
    </div>
  );
}
