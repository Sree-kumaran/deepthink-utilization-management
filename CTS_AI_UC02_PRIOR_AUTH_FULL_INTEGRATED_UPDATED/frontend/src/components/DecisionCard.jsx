import { AlertCircle, CheckCircle2, Clock3, FileWarning } from "lucide-react";

const OUTCOME_STYLES = {
  APPROVE: { colorClass: "text-success", bgClass: "bg-success/10", icon: CheckCircle2, label: "APPROVE" },
  PEND_FOR_NURSE_REVIEW: { colorClass: "text-warning", bgClass: "bg-warning/10", icon: Clock3, label: "PEND FOR NURSE REVIEW" },
  REQUEST_MORE_INFORMATION: { colorClass: "text-danger", bgClass: "bg-danger/10", icon: FileWarning, label: "REQUEST MORE INFORMATION" },
};

function normalizeOutcome(value) {
  const text = String(value || "").toUpperCase();
  if (text.includes("APPROVE") || text === "ACCEPT") return "APPROVE";
  if (text.includes("NURSE") || text.includes("PEND")) return "PEND_FOR_NURSE_REVIEW";
  return "REQUEST_MORE_INFORMATION";
}

export default function DecisionCard({ decision, onTrace }) {
  const outcome = normalizeOutcome(decision?.outcome);
  const config = OUTCOME_STYLES[outcome];
  const Icon = config.icon;
  const confidence = decision?.confidence;
  const confidencePercent = decision?.confidencePercent;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="absolute left-0 right-0 top-0 h-1 bg-primary" />
      <div className="px-5 py-9 text-center sm:px-8 sm:py-12">
        <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${config.bgClass} ${config.colorClass}`}>
          <Icon size={42} strokeWidth={2.2} />
        </div>
        <p className={`mt-6 text-xs font-bold uppercase tracking-[0.2em] ${config.colorClass}`}>Final Recommendation</p>
        <h2 className={`mx-auto mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl ${config.colorClass}`}>{config.label}</h2>

        {confidence && (
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-secondary px-4 py-2">
            <span className="text-xs font-semibold text-text-secondary">Confidence:</span>
            <span className="text-xs font-bold text-text-primary">{confidence}</span>
          </div>
        )}

        {confidencePercent !== null && confidencePercent !== undefined && (
          <div className="mx-auto mt-8 max-w-xl text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary">Confidence</span>
              <span className="text-sm font-bold text-text-primary">{confidencePercent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, Number(confidencePercent)))}%` }} />
            </div>
          </div>
        )}

        <button type="button" onClick={onTrace} className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-surface-secondary">
          <AlertCircle size={17} />
          Why this decision?
        </button>
      </div>
    </section>
  );
}
