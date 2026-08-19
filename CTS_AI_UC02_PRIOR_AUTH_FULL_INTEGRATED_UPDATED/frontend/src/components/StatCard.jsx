export default function StatCard({ label, value, accentClass = "text-text-primary", icon: Icon }) {
  return <div className="rounded-xl border border-border bg-surface p-5 shadow-card"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium text-text-secondary">{label}</p>{Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon size={16} /></div>}</div><p className={`mt-3 text-3xl font-bold ${accentClass}`}>{value}</p></div>;
}
