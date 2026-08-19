import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Loader2,
  RefreshCw,
  Stethoscope,
  UserRound,
  XCircle,
  Info,
} from "lucide-react";
import api from "../services/api";

const ACTIONS = [
  {
    id: "APPROVE",
    title: "APPROVE",
    description: "Approve the authorization request based on the clinical review.",
    icon: CheckCircle2,
  },
  {
    id: "DECLINE",
    title: "DECLINE",
    description: "Decline the authorization request based on the clinical review.",
    icon: XCircle,
  },
  {
    id: "PEND_FOR_NURSE_REVIEW",
    title: "PEND FOR FURTHER REVIEW",
    description: "Keep the request pending for additional clinical assessment.",
    icon: ClipboardCheck,
  },
  {
    id: "REQUEST_MORE_INFORMATION",
    title: "REQUEST MORE INFORMATION",
    description: "Request missing clinical or supporting information.",
    icon: FileText,
  },
];

function display(value, fallback = "Not available") {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
    return fallback;
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? display(value) : date.toLocaleString();
}

function InfoField({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-text-primary">
        {display(value)}
      </p>
    </div>
  );
}

function Evidence({ label, value }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-text-primary">{display(value)}</p>
    </div>
  );
}

function RuleRow({ rule }) {
  const result = String(rule.result || "").toUpperCase();
  const passed = result === "PASS" || result === "PASSED";
  const failed = result === "FAIL" || result === "FAILED";
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              passed
                ? "bg-success/10 text-success"
                : failed
                ? "bg-danger/10 text-danger"
                : "bg-warning/10 text-warning"
            }`}
          >
            {passed ? (
              <CheckCircle2 size={17} />
            ) : failed ? (
              <XCircle size={17} />
            ) : (
              <Clock3 size={17} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {display(rule.rule_name, rule.rule_id)}
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              {display(rule.reason)}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border px-3 py-1 text-[10px] font-bold tracking-wide text-text-primary">
          {display(rule.result, "REVIEW REQUIRED")}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            Condition / Expected
          </p>
          <p className="mt-1 text-xs text-text-primary">{display(rule.expected)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            Evidence / Actual
          </p>
          <p className="mt-1 text-xs text-text-primary">
            {display(rule.actual || rule.evidence)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted">
            Policy Reference
          </p>
          <p className="mt-1 text-xs text-text-primary">{display(rule.rule_id)}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          {label}
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-text-primary">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-text-secondary">Loading authorization review...</p>
      </div>
    </div>
  );
}

function ErrorBox({ message, onRetry, notFound = false }) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 flex items-start gap-3">
      <AlertCircle className="mt-0.5 shrink-0 text-danger" size={20} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-danger">
          {notFound ? "Authorization request not found." : "Unable to load nurse review"}
        </p>
        {!notFound && (
          <p className="mt-1 whitespace-pre-line text-sm text-danger/80">{message}</p>
        )}
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary"
        >
          <RefreshCw size={14} /> {notFound ? "Back to Review Queue" : "Try again"}
        </button>
      </div>
    </div>
  );
}

export default function NurseReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [auth, setAuth] = useState(null);
  const [review, setReview] = useState(null);
  const [trace, setTrace] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [policyVersion, setPolicyVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [notPendingMessage, setNotPendingMessage] = useState(null);
  const [selectedAction, setSelectedAction] = useState("");
  const [notes, setNotes] = useState("");
  const [conditionalReason, setConditionalReason] = useState("");
  const [validation, setValidation] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);

  const fetchQueue = useCallback(async () => {
    const data = await api.review.queue();
    const items = Array.isArray(data) ? data : [];
    setQueue(items);
    return items;
  }, []);

  const fetchDetail = useCallback(async (requestId, currentQueue) => {
    try {
      const authData = await api.authorization.get(requestId);
      setAuth(authData);
      setNotFound(false);

      if (authData?.status !== "PENDING_NURSE_REVIEW") {
        setNotPendingMessage(
          `This authorization is currently "${authData?.status || "DECIDED"}" (Decision: ${
            authData?.decision || "N/A"
          }) and is not waiting for clinical nurse review.`
        );
        return;
      }

      setNotPendingMessage(null);
      let currentReview =
        currentQueue.find((item) => item.request_id === requestId) || null;

      if (!currentReview) {
        try {
          currentReview = await api.review.getByRequest(requestId);
        } catch (reviewError) {
          if (reviewError?.status === 404) {
            currentReview = await api.review.create(requestId, {
              assigned_to: "Nurse Reviewer",
            });
          } else {
            throw reviewError;
          }
        }
      }
      setReview(currentReview);

      try {
        const decisionTrace = await api.authorization.trace(requestId);
        setTrace(decisionTrace);
        if (decisionTrace?.policy_id) {
          try {
            const policyData = await api.policy.get(decisionTrace.policy_id);
            setPolicy(policyData);
            if (decisionTrace.policy_version) {
              setPolicyVersion(
                await api.policy.getVersion(
                  decisionTrace.policy_id,
                  decisionTrace.policy_version
                )
              );
            }
          } catch {
            setPolicy(null);
            setPolicyVersion(null);
          }
        }
      } catch {
        setTrace(null);
        setPolicy(null);
        setPolicyVersion(null);
      }
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      throw err;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    setNotPendingMessage(null);
    try {
      const currentQueue = await fetchQueue();
      if (id) await fetchDetail(id, currentQueue);
      else {
        setAuth(null);
        setReview(null);
        setTrace(null);
        setPolicy(null);
        setPolicyVersion(null);
      }
    } catch (err) {
      if (err.status !== 404)
        setError(err.message || "Failed to load nurse review data.");
    } finally {
      setLoading(false);
    }
  }, [id, fetchQueue, fetchDetail]);

  useEffect(() => {
    load();
  }, [load]);

  const queueStats = useMemo(() => {
    const high = queue.filter(
      (item) =>
        String(item.priority || "").toUpperCase() === "HIGH" ||
        String(item.priority || "").toUpperCase() === "URGENT"
    ).length;
    return { pending: queue.length, high };
  }, [queue]);

  const validate = () => {
    const next = {};
    if (!selectedAction) next.decision = "Select a review decision.";
    if (!notes.trim()) next.notes = "Reviewer notes are required.";
    if (notes.length > 1000)
      next.notes = "Reviewer notes must be 1000 characters or fewer.";
    if (selectedAction && !conditionalReason.trim())
      next.conditionalReason = "This field is required for the selected decision.";
    if (conditionalReason.length > 1000)
      next.conditionalReason = "This field must be 1000 characters or fewer.";
    setValidation(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      const reviewId = review?.id;
      if (!reviewId) {
        throw new Error(
          "No open nurse review is available for this authorization request."
        );
      }
      const combinedNotes = `${notes.trim()}\n\n${
        selectedAction === "APPROVE"
          ? "Approval Reason"
          : selectedAction === "DECLINE"
          ? "Decline Reason"
          : selectedAction === "PEND_FOR_NURSE_REVIEW"
          ? "Reason for Further Review"
          : "Information Required"
      }: ${conditionalReason.trim()}`;
      const response = await api.review.complete(reviewId, {
        reviewer_decision: selectedAction,
        notes: combinedNotes,
      });
      setSubmittedReview(response);
      await fetchQueue();
    } catch (err) {
      setError(
        err.status === 409
          ? "This authorization changed before the review was submitted. Refresh the page and review its current status."
          : err.message || "Unable to submit the nurse review. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (!id)
    return (
      <ReviewQueue
        queue={queue}
        stats={queueStats}
        onRefresh={load}
        onSelect={(requestId) => navigate(`/nurse-review/${requestId}`)}
        error={error}
      />
    );
  if (notFound || !auth)
    return <ErrorBox message="" notFound onRetry={() => navigate("/requests")} />;
  if (submittedReview)
    return <SuccessState auth={auth} response={submittedReview} navigate={navigate} />;

  // Informative state if the authorization is not pending nurse review
  if (notPendingMessage) {
    return (
      <div className="mx-auto w-full max-w-[1000px] py-6">
        <button
          onClick={() => navigate("/nurse-review")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
        >
          <ArrowLeft size={17} /> Back to Review Queue
        </button>
        <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 shadow-card">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <Info size={22} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-text-primary">
                Review Not Required
              </h2>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {notPendingMessage}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/authorization/${auth.id}`)}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition"
                >
                  View Authorization Details
                </button>
                <button
                  onClick={() => navigate("/nurse-review")}
                  className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary transition"
                >
                  Return to Review Queue
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clinical = auth.clinical || {};
  const patient = auth.patient || {};
  const plan = auth.plan || {};
  const service = auth.service || {};
  const rules = trace?.rule_results || [];
  const status = auth.status || review?.status || "Not available";
  const priority = review?.priority || auth.priority || "Not available";
  const submittedDate =
    auth.created_at || auth.submitted_at || review?.created_at;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6">
        <button
          onClick={() => navigate("/nurse-review")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
        >
          <ArrowLeft size={17} /> Back to Review Queue
        </button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Stethoscope size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
                Nurse Review
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                Review authorization requests requiring clinical attention.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <InfoField label="Request ID" value={auth.id} />
            <InfoField label="Status" value={status} />
            <InfoField label="Priority" value={priority} />
            <InfoField label="Submitted" value={formatDate(submittedDate)} />
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-5">
          <ErrorBox message={error} onRetry={load} />
        </div>
      )}

      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm leading-6 text-text-secondary">
          Clinical review is required before final authorization when automated policy evaluation does not provide a definitive outcome.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  Authorization Request
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  Patient and authorization information
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              <InfoField label="Patient" value={patient.patient_name} />
              <InfoField label="Patient ID" value={patient.patient_id} />
              <InfoField label="Age" value={patient.age} />
              <InfoField
                label="Gender"
                value={patient.sex || patient.gender}
              />
              <InfoField
                label="Insurance"
                value={plan.plan_name || plan.insurance_plan}
              />
              <InfoField
                label="Requested Service"
                value={service.service_name}
              />
              <InfoField label="Diagnosis" value={clinical.diagnosis} />
              <InfoField
                label="Diagnosis Code"
                value={clinical.diagnosis_code || patient.diagnosis_code}
              />
              <InfoField label="Urgency" value={auth.urgency || service.urgency} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-text-primary">
                Clinical Evidence
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                Clinical evidence returned by the authorization API.
              </p>
            </div>
            <div className="divide-y divide-border">
              <Evidence label="Symptoms" value={clinical.symptoms} />
              <Evidence
                label="Duration"
                value={clinical.duration || clinical.symptom_duration_weeks}
              />
              <Evidence
                label="Previous Treatment"
                value={clinical.prior_treatment}
              />
              <Evidence
                label="Treatment Duration"
                value={clinical.prior_treatment_duration_weeks}
              />
              <Evidence
                label="Treatment Outcome"
                value={clinical.treatment_outcome}
              />
              <Evidence
                label="Current Medication"
                value={clinical.current_medications || patient.medications}
              />
              <Evidence
                label="Clinical Indication"
                value={clinical.indication}
              />
              <Evidence
                label="Clinical Findings"
                value={clinical.clinical_findings}
              />
              <Evidence
                label="Clinical Notes"
                value={clinical.clinical_notes}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-5">
              <h2 className="text-base font-bold text-text-primary">
                Policy Evaluation
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                Results from the existing decision trace endpoint.
              </p>
            </div>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <InfoField label="Policy" value={policy?.name || trace?.policy_id} />
              <InfoField
                label="Policy Version"
                value={policyVersion?.version || trace?.policy_version}
              />
              <InfoField
                label="Rules Evaluated"
                value={trace?.evaluated_rules}
              />
              <InfoField label="Passed" value={trace?.passed_rules} />
              <InfoField label="Failed" value={trace?.failed_rules} />
              <InfoField label="Missing" value={trace?.missing_rules} />
            </div>
            {rules.length ? (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <RuleRow key={rule.rule_id} rule={rule} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-surface-secondary p-4 text-sm text-text-secondary">
                No policy rule details are available from the backend for this request.
              </p>
            )}
          </section>

          <form onSubmit={submit} noValidate className="space-y-6">
            <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
              <div className="mb-5">
                <h2 className="text-base font-bold text-text-primary">
                  Review Decision
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  The nurse reviewer makes the final clinical review action.
                </p>
              </div>
              <div className="grid gap-3">
                {ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const selected = selectedAction === action.id;
                  return (
                    <label
                      key={action.id}
                      className={`cursor-pointer rounded-xl border-2 p-4 transition focus-within:ring-2 focus-within:ring-primary/30 ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface-secondary hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="decision"
                          value={action.id}
                          checked={selected}
                          onChange={() => {
                            setSelectedAction(action.id);
                            setConditionalReason("");
                            setValidation((v) => ({
                              ...v,
                              decision: undefined,
                              conditionalReason: undefined,
                            }));
                          }}
                          className="mt-1 h-4 w-4 accent-primary"
                        />
                        <Icon
                          size={18}
                          className="mt-0.5 shrink-0 text-primary"
                        />
                        <div>
                          <p className="text-sm font-bold text-text-primary">
                            {action.title}
                          </p>
                          <p className="mt-1 text-xs text-text-secondary">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {validation.decision && (
                <p
                  className="mt-3 text-sm font-medium text-danger"
                  role="alert"
                >
                  {validation.decision}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
              <label
                htmlFor="reviewer-notes"
                className="text-base font-bold text-text-primary"
              >
                Reviewer Notes <span className="text-danger">*</span>
              </label>
              <p className="mt-1 text-xs text-text-secondary">
                Clinical review notes, rationale, additional findings, or recommendation.
              </p>
              <textarea
                id="reviewer-notes"
                value={notes}
                maxLength={1000}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setValidation((v) => ({ ...v, notes: undefined }));
                }}
                rows={5}
                placeholder="Enter your clinical review notes, rationale, additional findings, or recommendation..."
                aria-invalid={Boolean(validation.notes)}
                className="mt-3 w-full resize-y rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-danger" role="alert">
                  {validation.notes || ""}
                </p>
                <span className="ml-auto shrink-0 text-xs text-text-muted">
                  {notes.length} / 1000
                </span>
              </div>
            </section>

            {selectedAction && (
              <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
                <label
                  htmlFor="conditional-reason"
                  className="text-base font-bold text-text-primary"
                >
                  {selectedAction === "APPROVE"
                    ? "Approval Reason"
                    : selectedAction === "PEND_FOR_NURSE_REVIEW"
                    ? "Reason for Further Review"
                    : selectedAction === "DECLINE"
                    ? "Decline Reason"
                    : "Information Required"}{" "}
                  <span className="text-danger">*</span>
                </label>
                <textarea
                  id="conditional-reason"
                  value={conditionalReason}
                  maxLength={1000}
                  onChange={(e) => {
                    setConditionalReason(e.target.value);
                    setValidation((v) => ({
                      ...v,
                      conditionalReason: undefined,
                    }));
                  }}
                  rows={4}
                  placeholder="Enter the required supporting information..."
                  aria-invalid={Boolean(validation.conditionalReason)}
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-danger" role="alert">
                    {validation.conditionalReason || ""}
                  </p>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">
                    {conditionalReason.length} / 1000
                  </span>
                </div>
              </section>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigate("/nurse-review")}
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary hover:bg-surface-secondary disabled:opacity-60"
              >
                <ArrowLeft size={17} /> Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={17} className="animate-spin" /> Submitting Review...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={17} /> Submit Review
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <aside className="h-fit space-y-4 xl:sticky xl:top-20">
          <section className="rounded-2xl border border-primary/20 bg-surface shadow-card overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    AI Recommendation
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-text-primary">
                    Automated Review Suggestion
                  </h2>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs leading-5 text-text-secondary">
                  AI output is advisory only. It is not the final clinical decision.
                </p>
              </div>
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Recommendation
                </p>
                <p className="mt-1 text-lg font-bold text-text-primary">
                  {display(auth.decision)}
                </p>
              </div>
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Confidence
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {display(
                    auth.extraction_confidence !== undefined &&
                      auth.extraction_confidence !== null
                      ? `${Math.round(auth.extraction_confidence * 100)}%`
                      : null
                  )}
                </p>
              </div>
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Explanation
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-text-secondary">
                  {display(trace?.explanation?.join("\n"))}
                </p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Review Status
            </p>
            <p className="mt-1 text-lg font-bold text-text-primary">
              {display(review?.status || auth.status)}
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  Assigned To
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {display(review?.assigned_to)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-text-muted">
                  Created
                </p>
                <p className="mt-1 text-sm font-semibold text-text-primary">
                  {formatDate(review?.created_at)}
                </p>
              </div>
            </div>
          </section>
          <button
            type="button"
            onClick={() => navigate(`/decision-trace/${auth.id}`)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-surface px-5 text-sm font-semibold text-primary hover:bg-primary/5"
          >
            View Decision Tree
          </button>
        </aside>
      </div>
    </div>
  );
}

function ReviewQueue({ queue, stats, onRefresh, onSelect, error }) {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Stethoscope size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
              Nurse Review
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Review authorization requests requiring clinical attention.
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>
      {error && (
        <div className="mb-5">
          <ErrorBox message={error} onRetry={onRefresh} />
        </div>
      )}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pending Reviews"
          value={stats.pending}
          icon={ClipboardCheck}
        />
        <Stat
          label="High Priority"
          value={stats.high || "Not available"}
          icon={AlertCircle}
        />
        <Stat label="Due Today" value="Not available" icon={FileText} />
        <Stat
          label="Completed Today"
          value="Not available"
          icon={CheckCircle2}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-bold text-text-primary">Review Queue</h2>
          <p className="mt-1 text-xs text-text-secondary">
            Open requests waiting for clinical review.
          </p>
        </div>
        {queue.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm font-semibold text-text-primary">
              No pending nurse reviews
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {queue.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item.request_id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-surface-secondary"
              >
                <div>
                  <p className="text-sm font-bold text-text-primary">
                    {display(item.request_id)}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Assigned to {display(item.assigned_to)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-primary">
                  {display(item.status)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessState({ auth, response, navigate }) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center">
      <div className="w-full rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={34} />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-text-primary">
          Review submitted successfully.
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Request <strong className="text-text-primary">{auth.id}</strong> is now{" "}
          <strong className="text-text-primary">{display(response.status)}</strong>.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => navigate("/nurse-review")}
            className="rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold text-text-primary hover:bg-surface-secondary"
          >
            Back to Review Queue
          </button>
          <button
            onClick={() => navigate(`/authorization/${auth.id}`)}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover"
          >
            View Authorization
          </button>
        </div>
      </div>
    </div>
  );
}
