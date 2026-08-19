import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileWarning,
} from 'lucide-react';
import api from '../services/api';

const decisionStyles = {
  APPROVE: {
    color: 'success',
    label: 'Approved',
    icon: CheckCircle2,
  },
  DECLINE: {
    color: 'danger',
    label: 'Declined',
    icon: FileWarning,
  },
  PEND_FOR_NURSE_REVIEW: {
    color: 'warning',
    label: 'Pending Nurse Review',
    icon: Clock,
  },
  REQUEST_MORE_INFORMATION: {
    color: 'danger',
    label: 'More Information Needed',
    icon: FileWarning,
  },
};

export default function AuthorizationDetail() {
  const { id } = useParams();
  const { state: navState } = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [auth, setAuth] = useState(null);
  const [decision, setDecision] = useState(null);
  const [nurseReview, setNurseReview] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const authData = await api.authorization.get(id);
      setAuth(authData);

      if (authData?.status === 'PENDING_NURSE_REVIEW') {
        try {
          setNurseReview(await api.review.getByRequest(id));
        } catch (reviewError) {
          if (reviewError?.status === 404) setNurseReview(null);
          else throw reviewError;
        }
      } else {
        setNurseReview(null);
      }

      if (authData?.decision) {
        try {
          const traceData = await api.authorization.trace(id);
          setDecision(traceData);
        } catch (err) {
          console.warn('Could not fetch decision trace:', err?.message || err);
          setDecision(null);
        }
      } else {
        setDecision(null);
      }
    } catch (err) {
      console.error('Failed to load authorization:', err);
      setError(err?.message || 'Failed to load authorization. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const decisionValue = auth?.decision || '';
  const statusValue = auth?.status || '';

  const isPendingNurseReview =
    statusValue === 'PENDING_NURSE_REVIEW' ||
    decisionValue === 'PEND_FOR_NURSE_REVIEW';

  const isAwaitingMoreInformation =
    decisionValue === 'REQUEST_MORE_INFORMATION' ||
    statusValue === 'AWAITING_MORE_INFORMATION' ||
    statusValue === 'REQUEST_MORE_INFORMATION';

  const isApproved =
    decisionValue === 'APPROVE' || statusValue === 'APPROVED' || statusValue === 'DECIDED';

  const getDecisionInfo = (value) => {
    return decisionStyles[value] || decisionStyles.REQUEST_MORE_INFORMATION;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <p className="text-text-secondary">Loading authorization...</p>
        </div>
      </div>
    );
  }

  if (error || !auth) {
    return (
      <div className="mb-6">
        <div className="p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">Failed to load authorization</p>
            <p className="text-sm text-danger/80 mt-1">{error || 'Authorization not found'}</p>
            <button
              onClick={fetchData}
              className="mt-3 text-sm px-3 py-1.5 bg-danger/20 text-danger rounded hover:bg-danger/30 transition-colors inline-flex items-center gap-2"
            >
              <RefreshCw size={14} /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const decisionInfo = getDecisionInfo(auth.decision);
  const DecisionIcon = decisionInfo.icon;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-primary hover:text-primary-hover text-sm font-medium flex items-center gap-1 mb-4"
        >
          ← Back to Dashboard
        </button>

        {navState?.message && (
          <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-sm text-primary">
            {navState.message}
          </div>
        )}

        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary mb-1">
                Authorization Request
              </h1>
              <p className="text-sm text-text-secondary">
                ID: {auth.id ? `${auth.id.substring(0, 12)}...` : 'N/A'}
              </p>
            </div>

            <div className="text-right">
              <div
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-${decisionInfo.color}/10 text-${decisionInfo.color}`}
              >
                <DecisionIcon size={18} />
                <span className="font-semibold text-sm">{decisionInfo.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isAwaitingMoreInformation && (
        <div className="mb-6 p-4 rounded-lg border border-warning/30 bg-warning/10 flex items-start gap-3">
          <FileWarning className="text-warning mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Additional Information Required
            </p>
            <p className="text-sm text-text-secondary mt-1">
              This authorization is waiting for additional clinical or supporting information.
            </p>
          </div>
        </div>
      )}

      {isPendingNurseReview && (
        <div className="mb-6 p-4 rounded-lg border border-warning/30 bg-warning/10 flex items-start gap-3">
          <Clock className="text-warning mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Nurse Review Required
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Automated policy evaluation could not provide a definitive authorization outcome. This request is pending clinical nurse review.
            </p>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="mb-6 p-4 rounded-lg border border-success/30 bg-success/10 flex items-start gap-3">
          <CheckCircle2 className="text-success mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Authorization Evaluated
            </p>
            <p className="text-sm text-text-secondary mt-1">
              Final decision: <strong>{auth.decision || 'Approved'}</strong>.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Patient Information</h2>
          <div className="space-y-3">
            <InfoRow label="Patient Name" value={auth.patient?.patient_name || auth.patient_name || 'N/A'} />
            <InfoRow label="Patient ID" value={auth.patient?.patient_id || auth.patient_id || 'N/A'} />
            <InfoRow label="Date of Birth" value={auth.patient?.date_of_birth || auth.date_of_birth || 'N/A'} />
            <InfoRow label="Gender" value={auth.patient?.gender || auth.patient?.sex || auth.gender || 'N/A'} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Insurance</h2>
          <div className="space-y-3">
            <InfoRow label="Plan" value={auth.plan?.plan_name || auth.plan?.insurance_plan || auth.insurance_plan || 'N/A'} />
            <InfoRow label="Member ID" value={auth.plan?.member_id || auth.member_id || 'N/A'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Service Information</h2>
          <div className="space-y-3">
            <InfoRow label="Service" value={auth.service?.service_name || auth.service_name || 'N/A'} />
            <InfoRow label="Category" value={auth.service?.category || auth.service?.service_category || auth.service_category || 'N/A'} />
            <InfoRow label="Provider" value={auth.provider?.name || auth.provider?.organization || auth.provider?.provider_id || auth.provider_name || 'N/A'} />
            <InfoRow label="Requested Date" value={auth.service?.requested_date || auth.requested_date || 'N/A'} />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Status</h2>
          <div className="space-y-3">
            <InfoRow label="Status" value={auth.status || 'RECEIVED'} />
            <InfoRow label="Decision" value={auth.decision || 'N/A'} />
            <InfoRow label="Urgency" value={auth.urgency_level || auth.urgency || 'Routine'} />
            <InfoRow label="Created" value={auth.created_at ? new Date(auth.created_at).toLocaleDateString() : 'N/A'} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-6 shadow-card mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Clinical Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoRow label="Diagnosis" value={auth.clinical?.diagnosis || auth.diagnosis || 'N/A'} />
          <InfoRow label="Diagnosis Code" value={auth.clinical?.diagnosis_code || auth.patient?.diagnosis_code || auth.diagnosis_code || 'N/A'} />
          <InfoRow label="Symptoms" value={auth.clinical?.symptoms || auth.symptoms || 'N/A'} />
          <InfoRow label="Current Medications" value={auth.clinical?.current_medications || auth.patient?.medications || auth.medications || 'N/A'} />
        </div>

        {auth.clinical?.clinical_notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="text-sm font-semibold text-text-secondary mb-2">Clinical Notes</h3>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{auth.clinical.clinical_notes}</p>
          </div>
        )}
      </div>

      {decision && (
        <div className="rounded-lg border border-border bg-surface p-6 shadow-card mb-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Decision Trace</h2>
          <div className="space-y-3">
            {decision.results && decision.results.length > 0 ? (
              <div className="space-y-2">
                {decision.results.map((result, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-surface-secondary border border-border">
                    <p className="text-sm font-semibold text-text-primary">{result.rule}</p>
                    <p className="text-xs text-text-secondary mt-1">Result: {result.result ? 'PASS' : 'FAIL'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No trace details available yet.</p>
            )}
          </div>

          <button
            onClick={() =>
              navigate(`/decision-trace/${auth.id}`, {
                state: { decision, auth },
              })
            }
            className="mt-4 text-primary hover:text-primary-hover text-sm font-medium inline-flex items-center gap-1"
          >
            View Full Trace
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        {isPendingNurseReview && (
          <button
            onClick={() =>
              navigate(`/nurse-review/${auth.id}`, {
                state: { auth },
              })
            }
            className="px-6 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
          >
            Start Nurse Review
          </button>
        )}

        {isAwaitingMoreInformation && (
          <button
            onClick={() =>
              navigate('/request-information', {
                state: { authId: auth.id, auth },
              })
            }
            className="px-6 py-2 bg-warning text-white font-semibold rounded-lg hover:bg-warning/80 transition-colors"
          >
            Provide More Information
          </button>
        )}

        <button
          onClick={fetchData}
          className="px-6 py-2 border border-border text-text-primary font-semibold rounded-lg hover:bg-surface-secondary transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <span className="text-sm text-text-primary font-semibold text-right break-words">{value}</span>
    </div>
  );
}