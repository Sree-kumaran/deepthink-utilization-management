import { Check } from "lucide-react";

export default function DecisionWorkflow({ current = "decision", onNavigate }) {
  const steps = [
    { id: "request", number: "1", label: "Clinical Request" },
    { id: "extraction", number: "2", label: "AI Extraction" },
    { id: "policy", number: "3", label: "Policy Evaluation" },
    { id: "rules", number: "4", label: "Rule Results" },
    { id: "decision", number: "5", label: "Final Decision" },
    { id: "review", number: "6", label: "Nurse Review" },
  ];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === current));

  return (
    <section aria-label="Authorization decision workflow" className="mb-7 overflow-x-auto rounded-2xl border border-border bg-surface px-5 py-4 shadow-card">
      <div className="flex min-w-[760px] items-center gap-0">
        {steps.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === currentIndex;
          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                disabled={!onNavigate || index > currentIndex}
                onClick={() => onNavigate?.(step.id)}
                className={`flex min-w-0 items-center gap-2 text-left ${onNavigate && index <= currentIndex ? "cursor-pointer" : "cursor-default"}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${complete || active ? "border-primary bg-primary text-white" : "border-border bg-surface-secondary text-text-muted"} ${active ? "ring-4 ring-primary/10" : ""}`}>
                  {complete ? <Check size={15} strokeWidth={3} /> : step.number}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-xs font-semibold ${active ? "text-primary" : "text-text-primary"}`}>{step.label}</span>
                  <span className="mt-0.5 block text-[10px] text-text-muted">{active ? "Current step" : complete ? "Complete" : "Upcoming"}</span>
                </span>
              </button>
              {index < steps.length - 1 && <div className={`mx-3 h-px flex-1 ${index < currentIndex ? "bg-primary/60" : "bg-border"}`} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
