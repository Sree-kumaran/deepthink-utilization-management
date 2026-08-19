import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import api from "../services/api";

export default function PostSubmissionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [authorization, setAuthorization] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    final_review_notes: "",
    recommended_action: "APPROVE",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("No authorization ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const authData = await api.authorization.get(id);
        setAuthorization(authData);

        try {
          const reviewQueue = await api.review.queue();
          const matchingReviews = reviewQueue.filter((r) => r.request_id === id);
          setReviews(matchingReviews);
        } catch (err) {
          console.log("Could not fetch reviews:", err);
        }
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError(err.message || "Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.final_review_notes.trim()) {
      setError("Please provide final review notes");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Find open review if any
      const openReview = reviews[0] || (await api.review.getByRequest(id));
      if (openReview?.id) {
        await api.review.complete(openReview.id, {
          reviewer_decision: formData.recommended_action,
          notes: formData.final_review_notes,
        });
      }

      setSuccessMessage("Final review submitted successfully!");
      setTimeout(() => {
        navigate("/requests", { state: { message: "Final review submitted" } });
      }, 1500);
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError(err.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-text-secondary">Loading authorization...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !authorization) {
    return (
      <div className="mx-auto w-full max-w-[1500px] p-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Go Back
        </button>
        <div className="p-6 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
          <div>
            <p className="text-sm font-semibold text-danger">Failed to load authorization</p>
            <p className="text-sm text-danger/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
      >
        <ArrowLeft size={16} />
        Go Back
      </button>

      {successMessage && (
        <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="text-success" size={20} />
          <p className="text-sm font-medium text-success">{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Post-Submission Review</h1>
        <p className="text-sm text-text-secondary mt-1">
          Final review for authorization {authorization?.id}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-xl border border-border p-6 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Patient Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-text-secondary">Patient Name</p>
                <p className="font-semibold text-text-primary mt-1">
                  {authorization?.patient?.patient_name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Patient ID</p>
                <p className="font-semibold text-text-primary mt-1">
                  {authorization?.patient?.patient_id || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Requested Service</p>
                <p className="font-semibold text-text-primary mt-1">
                  {authorization?.service?.service_name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-text-secondary">Status</p>
                <p className="font-semibold text-text-primary mt-1">
                  {authorization?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-surface rounded-xl border border-border p-6 shadow-card space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">Review Details</h2>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Final Review Notes *
              </label>
              <textarea
                value={formData.final_review_notes}
                onChange={(e) => setFormData({ ...formData, final_review_notes: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
                placeholder="Enter final review notes..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Action
              </label>
              <select
                value={formData.recommended_action}
                onChange={(e) => setFormData({ ...formData, recommended_action: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface-secondary px-4 py-2.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="APPROVE">Approve</option>
                <option value="DECLINE">Decline</option>
                <option value="PEND_FOR_NURSE_REVIEW">Pend for Nurse Review</option>
                <option value="REQUEST_MORE_INFORMATION">Request More Information</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Final Review"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}