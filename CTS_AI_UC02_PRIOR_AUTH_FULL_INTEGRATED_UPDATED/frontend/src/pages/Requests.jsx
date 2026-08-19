import { useState, useEffect } from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import RequestTable from '../components/RequestTable';
import api from '../services/api';

const STATUS_DECISIONS = {
  APPROVED: ['APPROVE'],
  PENDING: ['PEND_FOR_NURSE_REVIEW'],
  MORE_INFO: ['REQUEST_MORE_INFORMATION'],
  DECLINED: ['DECLINE'],
};

export default function Requests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requests, setRequests] = useState([]);
  const [filteredRequests, setFilteredRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all authorizations
      const data = await api.authorization.list();
      setRequests(data);
      setFilteredRequests(data);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(err.message || 'Failed to load requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Filter requests based on status and search query
  useEffect(() => {
    let filtered = requests;

    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter((r) => {
        const allowedDecisions = STATUS_DECISIONS[statusFilter] || [];
        return allowedDecisions.length === 0 || allowedDecisions.includes(r.decision);
      });
    }

    // Filter by search query (patient name or ID)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((r) => {
        const patientName = r.patient?.patient_name?.toLowerCase() || '';
        const patientId = r.patient?.patient_id?.toLowerCase() || '';
        const requestId = r.id?.toLowerCase() || '';
        return (
          patientName.includes(query) ||
          patientId.includes(query) ||
          requestId.includes(query)
        );
      });
    }

    setFilteredRequests(filtered);
  }, [requests, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-text-secondary">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
        <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-danger">Failed to load requests</p>
          <p className="text-sm text-danger/80 mt-1">{error}</p>
          <button
            onClick={fetchRequests}
            className="mt-3 text-sm px-3 py-1.5 bg-danger/20 text-danger rounded hover:bg-danger/30 transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold mb-5 text-text-primary">
        Authorization Requests
      </h1>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Search */}
        <div className="lg:col-span-2">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              placeholder="Search by patient name, patient ID, or request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border bg-surface-secondary px-4 pl-10 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:ring-2 focus:ring-primary/25"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-11 w-full cursor-pointer rounded-xl border border-border bg-surface-secondary px-4 text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-primary/25"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending Review</option>
            <option value="MORE_INFO">More Information</option>
            <option value="DECLINED">Declined</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          Showing {filteredRequests.length} of {requests.length} requests
        </p>
        <button
          onClick={fetchRequests}
          className="text-primary hover:text-primary-hover text-sm font-medium inline-flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {filteredRequests.length === 0 ? (
        <div className="p-8 text-center bg-surface-secondary rounded-lg border border-border">
          <p className="text-text-secondary">
            {requests.length === 0
              ? 'No authorization requests yet.'
              : 'No requests match your filters.'}
          </p>
        </div>
      ) : (
        <RequestTable requests={filteredRequests} />
      )}
    </div>
  );
}