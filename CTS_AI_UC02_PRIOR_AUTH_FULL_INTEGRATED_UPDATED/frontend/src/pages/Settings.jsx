import { useEffect, useMemo, useState } from "react";
import { Bell, Check, LockKeyhole, Moon, RotateCcw, Save, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useRole } from "../context/RoleContext";

const DEFAULTS = {
  emailNotifications: true,
  confidenceScore: true,
  supportingEvidence: true,
  humanReview: true,
  auditLogging: true,
  sessionTimeout: "30",
  priority: "Medium",
  requestsPerPage: "25",
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem("pa-settings") || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary" : "bg-border"}`}>
      <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

function SettingRow({ title, description, children }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="mt-1 text-xs leading-5 text-text-secondary">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { role } = useRole();
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
  }, [settings]);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const save = () => {
    localStorage.setItem("pa-settings", JSON.stringify(settings));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };
  const reset = () => {
    setSettings(DEFAULTS);
    localStorage.setItem("pa-settings", JSON.stringify(DEFAULTS));
    setSaved(true);
  };

  const roleLabel = useMemo(() => (role === "provider" ? "Provider" : "Insurer"), [role]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-7">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound size={20} /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Settings</h1>
            <p className="mt-1 text-sm text-text-secondary">Manage appearance, notifications, security, and authorization preferences.</p>
          </div>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 flex items-center gap-3"><Moon size={19} className="text-primary" /><div><h2 className="text-base font-bold text-text-primary">Appearance</h2><p className="text-xs text-text-secondary">Choose how the application looks.</p></div></div>
        <div className="grid grid-cols-2 gap-3">
          {["light", "dark"].map((value) => (
            <button key={value} onClick={() => setTheme(value)} className={`flex items-center justify-between rounded-xl border-2 p-4 text-left transition ${theme === value ? "border-primary bg-primary/5" : "border-border bg-surface-secondary hover:border-primary/40"}`}>
              <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-text-primary">{value === "light" ? <Sun size={17} /> : <Moon size={17} />}</span><span className="text-sm font-semibold text-text-primary capitalize">{value}</span></span>
              {theme === value && <Check size={17} className="text-primary" />}
            </button>
          ))}
        </div>
      </section>

      <section id="notifications" className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-2 flex items-center gap-3"><Bell size={19} className="text-primary" /><div><h2 className="text-base font-bold text-text-primary">Notifications</h2><p className="text-xs text-text-secondary">Control review and authorization information shown or delivered to you.</p></div></div>
        <SettingRow title="Email notifications" description="Receive authorization and workflow notifications by email."><Toggle checked={settings.emailNotifications} onChange={(v) => update("emailNotifications", v)} /></SettingRow>
        <SettingRow title="Show confidence score" description="Display extraction confidence in clinical review screens."><Toggle checked={settings.confidenceScore} onChange={(v) => update("confidenceScore", v)} /></SettingRow>
        <SettingRow title="Show supporting evidence" description="Display policy evidence alongside AI-assisted recommendations."><Toggle checked={settings.supportingEvidence} onChange={(v) => update("supportingEvidence", v)} /></SettingRow>
        <SettingRow title="Require human review" description="Keep clinical decisions behind an authorized human reviewer."><Toggle checked={settings.humanReview} onChange={(v) => update("humanReview", v)} /></SettingRow>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-2 flex items-center gap-3"><ClipboardIcon /><div><h2 className="text-base font-bold text-text-primary">Authorization Preferences</h2><p className="text-xs text-text-secondary">Configure default authorization workflow preferences for the {roleLabel.toLowerCase()} role.</p></div></div>
        <SettingRow title="Default priority" description="Priority assigned to new authorization workflows."><select value={settings.priority} onChange={(e) => update("priority", e.target.value)} className="min-w-36 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/25"><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select></SettingRow>
        <SettingRow title="Requests per page" description="Number of authorization requests displayed in list views."><select value={settings.requestsPerPage} onChange={(e) => update("requestsPerPage", e.target.value)} className="min-w-36 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/25"><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></SettingRow>
      </section>

      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-2 flex items-center gap-3"><LockKeyhole size={19} className="text-primary" /><div><h2 className="text-base font-bold text-text-primary">Security &amp; Audit</h2><p className="text-xs text-text-secondary">Manage security and authorization audit preferences.</p></div></div>
        <SettingRow title="Audit logging" description="Record authorization workflow actions for traceability."><Toggle checked={settings.auditLogging} onChange={(v) => update("auditLogging", v)} /></SettingRow>
        <SettingRow title="Session timeout" description="Automatically expire inactive application sessions."><select value={settings.sessionTimeout} onChange={(e) => update("sessionTimeout", e.target.value)} className="min-w-36 rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/25"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="120">2 hours</option></select></SettingRow>
        <SettingRow title="Login activity" description="View your recent login history and active sessions."><button className="rounded-lg border border-border bg-surface-secondary px-4 py-2 text-sm font-semibold text-text-primary hover:bg-bg">View Activity →</button></SettingRow>
      </section>

      <section className="mb-6 rounded-2xl border border-success/30 bg-success/5 p-5 shadow-card sm:p-6">
        <div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><ShieldCheck size={19} /></div><div><h2 className="text-base font-bold text-text-primary">Clinical Decision Safety</h2><p className="mt-2 text-sm text-text-secondary">✓ AI recommendations never automatically approve or deny authorization requests.</p><p className="mt-2 text-sm text-text-secondary">✓ Final authorization decisions require review by an authorized clinical reviewer.</p><p className="mt-3 text-sm font-bold text-success">Human Review Protection Enabled</p></div></div>
      </section>

      <div className="flex flex-col-reverse gap-3 pb-8 sm:flex-row sm:justify-end">
        <button onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary hover:bg-surface-secondary"><RotateCcw size={16} /> Reset to Defaults</button>
        <button onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-hover"><Save size={16} /> {saved ? "Saved" : "Save Changes"}</button>
      </div>
    </div>
  );
}

function ClipboardIcon() {
  return <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><span className="text-lg">▣</span></span>;
}
