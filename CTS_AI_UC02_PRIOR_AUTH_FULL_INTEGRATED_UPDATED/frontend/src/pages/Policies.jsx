import { useEffect, useState } from "react";
import { AlertCircle, Archive, CheckCircle2, ChevronRight, FilePlus2, Loader2, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import api from "../services/api";

const EMPTY_POLICY = { id: "", name: "", description: "", version: "v1.0", effective_from: "", raw_content: "", source: "" };
const EMPTY_VERSION = { version: "", effective_from: "", effective_to: "", raw_content: "", source: "" };

function errorText(error) { return error?.message || "Something went wrong while updating the policy."; }
function sourceReferences(source) { return source?.trim() ? [{ source: source.trim(), type: "insurance_company_policy" }] : []; }

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
  const [policyForm, setPolicyForm] = useState(EMPTY_POLICY);
  const [versionForm, setVersionForm] = useState(EMPTY_VERSION);

  const load = async (keepId = null) => {
    try {
      setLoading(true); setError(null);
      const data = await api.policy.list();
      const list = Array.isArray(data) ? data : [];
      setPolicies(list);
      const next = list.find((item) => item.id === keepId) || list.find((item) => item.id === selected?.id) || list[0] || null;
      setSelected(next);
      if (next) await loadVersions(next);
      else setVersions([]);
    } catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  };

  const loadVersions = async (policy) => {
    if (!policy) return;
    try {
      setLoadingVersions(true); setError(null);
      const data = await api.policy.listVersions(policy.id);
      setVersions(Array.isArray(data) ? data : []);
      const active = (Array.isArray(data) ? data : []).find((item) => item.version === policy.active_version) || data?.[0] || null;
      setSelectedVersion(active);
    } catch (err) { setError(errorText(err)); }
    finally { setLoadingVersions(false); }
  };

  // load() intentionally owns the initial policy bootstrap; it is also exposed to refresh buttons.
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  const choose = async (policy) => { setSelected(policy); setSelectedVersion(null); await loadVersions(policy); };

  const createPolicy = async (event) => {
    event.preventDefault();
    if (!policyForm.id.trim() || !policyForm.name.trim() || !policyForm.version.trim() || !policyForm.raw_content.trim()) {
      setError("Policy ID, name, version, and policy content are required."); return;
    }
    try {
      setSaving(true); setError(null); setNotice(null);
      const created = await api.policy.create({
        id: policyForm.id.trim(), name: policyForm.name.trim(), description: policyForm.description.trim() || null,
        version: policyForm.version.trim(), effective_from: policyForm.effective_from || null,
        rules: [], source_references: sourceReferences(policyForm.source), raw_content: policyForm.raw_content.trim(),
      });
      setNotice(`Policy ${created.name || created.id} was saved and indexed into the policy RAG store.`);
      setPolicyForm(EMPTY_POLICY); setShowCreate(false); await load(created.id);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  const createVersion = async (event) => {
    event.preventDefault();
    if (!selected) return;
    if (!versionForm.version.trim() || !versionForm.raw_content.trim()) { setError("Version and policy content are required."); return; }
    try {
      setSaving(true); setError(null); setNotice(null);
      await api.policy.createVersion(selected.id, {
        version: versionForm.version.trim(), effective_from: versionForm.effective_from || null, effective_to: versionForm.effective_to || null,
        status: "DRAFT", rules: [], source_references: sourceReferences(versionForm.source), raw_content: versionForm.raw_content.trim(),
      });
      setNotice(`Version ${versionForm.version.trim()} was saved permanently as a draft. Activate it when ready.`);
      setVersionForm(EMPTY_VERSION); setShowVersion(false); await loadVersions(selected);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  const activate = async (version) => {
    if (!selected) return;
    try {
      setSaving(true); setError(null); setNotice(null);
      await api.policy.activateVersion(selected.id, version.version);
      setNotice(`Version ${version.version} is now active and has been indexed for RAG retrieval.`);
      await load(selected.id);
    } catch (err) { setError(errorText(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" /><p className="text-sm text-text-secondary">Loading policy configuration...</p></div></div>;

  return <div className="mx-auto w-full max-w-[1500px]">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-3"><div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Archive size={21} /></div><div><h1 className="text-2xl font-bold text-text-primary">Policy Rules</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-text-secondary">Insurance policy administrators can add new policies, create permanent versions, and activate the version that RAG uses for authorization evaluation.</p></div></div><div className="flex flex-wrap gap-2"><button onClick={() => load(selected?.id)} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary"><RefreshCw size={15} /> Refresh</button><button onClick={() => { setError(null); setNotice(null); setShowCreate(true); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"><Plus size={16} /> Add Policy</button></div></div>
    {error && <div className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4"><AlertCircle className="mt-0.5 shrink-0 text-danger" size={19} /><p className="whitespace-pre-line text-sm text-danger">{error}</p></div>}
    {notice && <div className="mb-5 flex items-start gap-3 rounded-xl border border-success/20 bg-success/10 p-4"><CheckCircle2 className="mt-0.5 shrink-0 text-success" size={19} /><p className="text-sm text-success">{notice}</p></div>}

    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} /><div><p className="text-sm font-bold text-text-primary">RAG policy lifecycle</p><p className="mt-1 text-xs leading-5 text-text-secondary">Saving an active policy or activating a version persists the content in PostgreSQL and indexes its text into the existing Qdrant policy collection using the existing Gemini embedding model. Failed indexing prevents activation.</p></div></div></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"><div className="border-b border-border p-5"><h2 className="text-base font-bold text-text-primary">Configured Policies</h2><p className="mt-1 text-xs text-text-secondary">{policies.length} persistent policies</p></div><div className="divide-y divide-border">{policies.length ? policies.map((policy) => <button key={policy.id} onClick={() => choose(policy)} className={`flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-surface-secondary ${selected?.id === policy.id ? "bg-primary/5" : ""}`}><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">{policy.name || policy.id}</p><p className="mt-1 truncate text-xs text-text-secondary">{policy.id} · Active {policy.active_version || "—"}</p></div><ChevronRight size={16} className="shrink-0 text-text-muted" /></button>) : <div className="p-8 text-center text-sm text-text-secondary">No policies configured.</div>}</div></div>

      <div className="rounded-2xl border border-border bg-surface shadow-card"><div className="border-b border-border p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-bold text-text-primary">{selected?.name || "Policy Details"}</h2><p className="mt-1 text-sm text-text-secondary">Policy ID: {selected?.id || "—"}</p></div>{selected && <button onClick={() => { setVersionForm(EMPTY_VERSION); setError(null); setShowVersion(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover"><FilePlus2 size={16} /> New Version</button>}</div></div>
        <div className="p-6">{loadingVersions ? <div className="flex items-center gap-2 text-sm text-text-secondary"><Loader2 size={16} className="animate-spin" /> Loading versions...</div> : versions.length ? <div className="space-y-4">{versions.map((version) => <VersionCard key={version.id || version.version} version={version} active={version.version === selected?.active_version} disabled={saving} onActivate={() => activate(version)} onSelect={() => setSelectedVersion(version)} selected={selectedVersion?.version === version.version} />)}</div> : <p className="text-sm text-text-secondary">No versions available.</p>}</div>
      </div>
    </div>

    {showCreate && <Modal title="Add New Insurance Policy" onClose={() => !saving && setShowCreate(false)}><form onSubmit={createPolicy} className="space-y-4"><Field label="Policy ID" value={policyForm.id} onChange={(value) => setPolicyForm({ ...policyForm, id: value })} placeholder="AETNA-COLON-002" required /><Field label="Policy Name" value={policyForm.name} onChange={(value) => setPolicyForm({ ...policyForm, name: value })} placeholder="Aetna - Colonoscopy" required /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Initial Version" value={policyForm.version} onChange={(value) => setPolicyForm({ ...policyForm, version: value })} placeholder="v1.0" required /><Field label="Effective From" type="date" value={policyForm.effective_from} onChange={(value) => setPolicyForm({ ...policyForm, effective_from: value })} /></div><Field label="Description" value={policyForm.description} onChange={(value) => setPolicyForm({ ...policyForm, description: value })} placeholder="What this policy covers" /><Field label="Source / Reference" value={policyForm.source} onChange={(value) => setPolicyForm({ ...policyForm, source: value })} placeholder="Payer policy reference" /><TextArea label="Policy Content" value={policyForm.raw_content} onChange={(value) => setPolicyForm({ ...policyForm, raw_content: value })} placeholder="Paste the authoritative policy text here..." required /><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setShowCreate(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary">Cancel</button><button disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving + indexing..." : "Save Policy"}</button></div></form></Modal>}
    {showVersion && <Modal title={`Create New Version — ${selected?.name || "Policy"}`} onClose={() => !saving && setShowVersion(false)}><form onSubmit={createVersion} className="space-y-4"><Field label="Version" value={versionForm.version} onChange={(value) => setVersionForm({ ...versionForm, version: value })} placeholder="v2.0" required /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Effective From" type="date" value={versionForm.effective_from} onChange={(value) => setVersionForm({ ...versionForm, effective_from: value })} /><Field label="Effective To" type="date" value={versionForm.effective_to} onChange={(value) => setVersionForm({ ...versionForm, effective_to: value })} /></div><Field label="Source / Reference" value={versionForm.source} onChange={(value) => setVersionForm({ ...versionForm, source: value })} placeholder="Payer policy reference" /><TextArea label="Updated Policy Content" value={versionForm.raw_content} onChange={(value) => setVersionForm({ ...versionForm, raw_content: value })} placeholder="Paste the complete updated policy text..." required /><p className="text-xs leading-5 text-text-secondary">The new version is stored as a draft. Use <strong>Activate</strong> after review to make it the active RAG policy.</p><div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setShowVersion(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-secondary">Cancel</button><button disabled={saving} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving..." : "Save Draft"}</button></div></form></Modal>}
  </div>;
}

function VersionCard({ version, active, disabled, onActivate, onSelect, selected }) { return <div className={`rounded-xl border p-4 transition ${selected ? "border-primary/40 bg-primary/5" : "border-border bg-surface-secondary"}`}><button type="button" onClick={onSelect} className="w-full text-left"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-bold text-text-primary">Version {version.version}</p><p className="mt-1 text-xs text-text-secondary">Status: {version.status} · {version.raw_content ? `${version.raw_content.length.toLocaleString()} characters` : "No content"}</p></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-success/10 text-success" : "bg-surface border border-border text-text-secondary"}`}>{active ? <><ShieldCheck size={13} /> ACTIVE</> : version.status}</span></div></button>{!active && version.status !== "ACTIVE" && <button type="button" disabled={disabled} onClick={onActivate} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-surface px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">Activate + Index for RAG</button>}</div>; }
function Field({ label, value, onChange, type = "text", placeholder, required }) { return <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}{required && <span className="text-danger"> *</span>}</span><input required={required} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>; }
function TextArea({ label, value, onChange, placeholder, required }) { return <label className="block"><span className="text-xs font-bold uppercase tracking-wider text-text-muted">{label}{required && <span className="text-danger"> *</span>}</span><textarea required={required} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} rows={9} className="mt-2 w-full resize-y rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm leading-6 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></label>; }
function Modal({ title, onClose, children }) { return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-5 py-4"><div><h2 className="text-lg font-bold text-text-primary">{title}</h2><p className="mt-1 text-xs text-text-secondary">Persistent policy configuration</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-text-secondary hover:bg-surface-secondary hover:text-text-primary"><X size={18} /></button></div><div className="p-5 sm:p-6">{children}</div></div></div>; }
