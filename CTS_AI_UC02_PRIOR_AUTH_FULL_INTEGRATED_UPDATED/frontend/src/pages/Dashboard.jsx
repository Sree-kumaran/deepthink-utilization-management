import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, FileWarning, RefreshCw } from "lucide-react";
import StatCard from "../components/StatCard";
import RequestTable from "../components/RequestTable";
import api from "../services/api";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, approved: 0, pended: 0, request_more_information: 0 });
  const [requests, setRequests] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [summary, list] = await Promise.all([api.dashboard.summary(), api.authorization.list()]);
      setStats(summary || { total: 0, approved: 0, pended: 0, request_more_information: 0 });
      setRequests(Array.isArray(list) ? list.slice(0, 5) : []);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><div className="text-center"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /><p className="text-sm text-text-secondary">Loading dashboard...</p></div></div>;

  if (error) return <div className="mx-auto max-w-3xl rounded-xl border border-danger/30 bg-danger/10 p-4 flex items-start gap-3"><AlertCircle className="mt-0.5 shrink-0 text-danger" size={20} /><div className="flex-1"><p className="text-sm font-semibold text-danger">Failed to load dashboard</p><p className="mt-1 text-sm text-danger/80">{error}</p><button onClick={fetchData} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-1.5 text-sm font-semibold text-danger"><RefreshCw size={14} /> Try again</button></div></div>;

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-7 flex items-end justify-between gap-4"><div><h1 className="text-[22px] font-bold text-text-primary">Dashboard</h1><p className="mt-1 text-sm text-text-secondary">Authorization overview and recent requests.</p></div><button onClick={fetchData} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-hover"><RefreshCw size={15} /> Refresh</button></div>
      <div className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Requests" value={stats.total} icon={FileWarning} />
        <StatCard label="Approved" value={stats.approved} accentClass="text-success" icon={CheckCircle2} />
        <StatCard label="Pending" value={stats.pended} accentClass="text-warning" icon={Clock3} />
        <StatCard label="More Info" value={stats.request_more_information} accentClass="text-danger" icon={AlertCircle} />
      </div>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold text-text-primary">Recent Authorization Requests</h2><span className="text-xs text-text-muted">Latest 5</span></div>
      {requests.length === 0 ? <div className="rounded-2xl border border-border bg-surface-secondary p-12 text-center"><p className="text-sm text-text-secondary">No authorization requests yet.</p></div> : <RequestTable requests={requests} />}
    </div>
  );
}
