import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function getStatus(request) {
  if (request.decision === "APPROVE") return { label: "Approved", className: "bg-success/10 text-success" };
  if (request.decision === "PEND_FOR_NURSE_REVIEW") return { label: "Pending", className: "bg-warning/10 text-warning" };
  if (request.decision === "REQUEST_MORE_INFORMATION") return { label: "More Info", className: "bg-danger/10 text-danger" };
  return { label: request.status || "Received", className: "bg-primary/10 text-primary" };
}

function patientName(request) { return request.patient?.patient_name || "Unknown"; }
function serviceName(request) { return request.service?.service_name || "N/A"; }

function explanationItems(trace) {
  if (!trace) return [];
  const items = [];
  if (trace.llm_explanation) {
    items.push(`AI Explanation: ${trace.llm_explanation}`);
  } else if (trace.ai_assessment?.llm_explanation) {
    items.push(`AI Explanation: ${trace.ai_assessment.llm_explanation}`);
  } else if (typeof trace.explanation === "string") {
    items.push(trace.explanation);
  }

  if (Array.isArray(trace.explanation) && trace.explanation.length) {
    for (const exp of trace.explanation) {
      if (!items.includes(exp)) items.push(exp);
    }
  } else if (Array.isArray(trace.reasons) && trace.reasons.length) {
    for (const r of trace.reasons) {
      if (!items.includes(r)) items.push(r);
    }
  }
  return items;
}

export default function RequestTable({ requests = [] }) {
  const navigate = useNavigate();
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [loadingExplanation, setLoadingExplanation] = useState({});
  const [explanationErrors, setExplanationErrors] = useState({});

  if (!requests.length) return null;

  const handleExplain = async (request) => {
    const requestId = request.id;

    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }

    setExpandedRequestId(requestId);

    if (explanations[requestId]) return;

    setLoadingExplanation((current) => ({ ...current, [requestId]: true }));
    setExplanationErrors((current) => ({ ...current, [requestId]: null }));

    try {
      let data;
      try {
        data = await api.authorization.explain(requestId);
      } catch {
        data = await api.authorization.trace(requestId);
      }
      setExplanations((current) => ({ ...current, [requestId]: data }));
    } catch (err) {
      setExplanationErrors((current) => ({
        ...current,
        [requestId]: err?.message || "Could not load the decision explanation.",
      }));
    } finally {
      setLoadingExplanation((current) => ({ ...current, [requestId]: false }));
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-card">
      <table className="w-full min-w-[860px] border-collapse">
        <thead>
          <tr className="border-b border-border">
            {["Request ID", "Patient", "Service", "Status", "Decision"].map((head) => (
              <th key={head} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const status = getStatus(request);
            const isExpanded = expandedRequestId === request.id;
            const trace = explanations[request.id];
            const items = explanationItems(trace);

            return (
              <Fragment key={request.id}>
                <tr
                  key={request.id}
                  onClick={() => navigate(`/authorization/${request.id}`)}
                  className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-secondary transition"
                >
                  <td className="px-4 py-4 text-sm font-semibold text-text-primary">{String(request.id).slice(0, 8)}...</td>
                  <td className="px-4 py-4 text-sm text-text-primary">{patientName(request)}</td>
                  <td className="px-4 py-4 text-sm text-text-secondary">{serviceName(request)}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => navigate(`/decision/${request.id}`)}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover transition"
                      >
                        Decision
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExplain(request)}
                        aria-expanded={isExpanded}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-secondary transition"
                      >
                        {isExpanded ? "Hide Explain" : "Explain"}
                      </button>
                    </div>
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${request.id}-explanation`} className="border-b border-border">
                    <td colSpan={5} className="px-4 pb-4">
                      <div className="rounded-xl border border-primary/20 bg-surface-secondary p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Why This Decision?</p>

                        {loadingExplanation[request.id] && (
                          <p className="mt-2 text-sm text-text-secondary">Loading decision explanation...</p>
                        )}

                        {explanationErrors[request.id] && (
                          <p className="mt-2 text-sm text-danger">{explanationErrors[request.id]}</p>
                        )}

                        {!loadingExplanation[request.id] && !explanationErrors[request.id] && (
                          items.length ? (
                            <ul className="mt-3 space-y-2">
                              {items.map((item, index) => (
                                <li key={`${request.id}-explanation-${index}`} className="text-sm leading-6 text-text-secondary">
                                  {typeof item === "string" ? item : item?.reason || item?.explanation || JSON.stringify(item)}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-text-secondary">No explanation was returned for this decision.</p>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
