import { useEffect, useState } from "react";
import { Clock3, AlertCircle, RefreshCw, ChevronRight, ShieldCheck } from "lucide-react";
import api from "../services/api";

export default function AuditTrail() {
  const [requests, setRequests] = useState([]);
  const [requestId, setRequestId] = useState("");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState(null);

  const loadRequests = async () => {
    try { setLoading(true); setError(null); const data = await api.authorization.list(); const list = Array.isArray(data) ? data : []; setRequests(list); if (!requestId && list[0]?.id) setRequestId(list[0].id); } catch (err) { setError(err.message || "Failed to load audit trail."); } finally { setLoading(false); }
  };
  useEffect(() => { loadRequests(); }, []);

  const loadEvents = async (id = requestId) => {
    if (!id) return;
    try { setLoadingEvents(true); setError(null); const data = await api.audit.trail(id); setEvents(Array.isArray(data) ? data : data?.events || []); } catch (err) { setError(err.message || "Failed to load audit events."); } finally { setLoadingEvents(false); }
  };
  useEffect(() => { if (requestId) loadEvents(requestId); }, [requestId]);

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /><p className="text-sm text-text-secondary">Loading audit trail...</p></div></div>;

  return <div className="mx-auto w-full max-w-[1400px]">
    <div className="mb-7 flex items-end justify-between gap-4"><div className="flex items-start gap-3"><div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={20} /></div><div><h1 className="text-2xl font-bold text-text-primary">Audit Trail</h1><p className="mt-1 text-sm text-text-secondary">Review authorization workflow events for traceability.</p></div></div><button onClick={() => { loadRequests(); loadEvents(); }} className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><RefreshCw size={15} /> Refresh</button></div>
    {error && <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-4 flex items-start gap-3"><AlertCircle className="text-danger" size={19} /><p className="text-sm text-danger">{error}</p></div>}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"><div className="border-b border-border p-5"><h2 className="text-base font-bold text-text-primary">Authorization Requests</h2><p className="mt-1 text-xs text-text-secondary">Select a request to view its audit history.</p></div><div className="max-h-[620px] overflow-y-auto divide-y divide-border">{requests.map((request) => <button key={request.id} onClick={() => setRequestId(request.id)} className={`flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-surface-secondary ${requestId === request.id ? "bg-primary/5" : ""}`}><div className="min-w-0"><p className="text-sm font-semibold text-text-primary">{request.patient?.patient_name || "Unknown Patient"}</p><p className="mt-1 text-xs text-text-secondary">{request.id}</p></div><ChevronRight size={16} className="shrink-0 text-text-muted" /></button>)}</div></div>
      <div className="rounded-2xl border border-border bg-surface shadow-card"><div className="border-b border-border p-6"><p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Selected Request</p><h2 className="mt-1 text-lg font-bold text-text-primary">{requestId || "No request selected"}</h2></div>{loadingEvents ? <div className="p-8 text-center text-sm text-text-secondary">Loading events...</div> : events.length === 0 ? <div className="p-12 text-center"><Clock3 className="mx-auto h-9 w-9 text-text-muted" /><p className="mt-3 text-sm font-semibold text-text-primary">No audit events recorded</p><p className="mt-1 text-xs text-text-secondary">Events will appear here as the authorization moves through the workflow.</p></div> : <div className="divide-y divide-border">{events.map((event, index) => <div key={index} className="p-5"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Clock3 size={17} /></div><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-text-primary">{event.event_type || event.action || "Action"}</p><time className="text-xs text-text-muted">{event.created_at ? new Date(event.created_at).toLocaleString() : "—"}</time></div>{event.details && <p className="mt-2 text-sm leading-6 text-text-secondary">{typeof event.details === "string" ? event.details : JSON.stringify(event.details)}</p>}{event.payload && <p className="mt-2 text-xs leading-5 text-text-muted break-words">{typeof event.payload === "string" ? event.payload : JSON.stringify(event.payload)}</p>}</div></div></div>)}</div>}</div>
    </div>
  </div>;
}
