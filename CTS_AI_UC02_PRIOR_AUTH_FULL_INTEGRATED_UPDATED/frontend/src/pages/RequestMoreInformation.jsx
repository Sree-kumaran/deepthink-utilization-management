import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, ArrowLeft, Send, FileQuestion } from "lucide-react";
import api from "../services/api";

export default function RequestMoreInformation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [authorization, setAuthorization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    information_required: "",
    deadline: "",
    contact_information: "",
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
      } catch (err) {
        console.error("Failed to fetch authorization:", err);
        setError(err.message || "Failed to load authorization data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.information_required.trim()) {
      setError("Please specify the information required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Update authorization with request for more information
      await api.authorization.create({
        ...authorization,
        status: "AWAITING_MORE_INFO",
        additional_info_request: formData,
      });

      setSuccessMessage("Request for more information sent successfully!");
      setTimeout(() => {
        navigate("/requests", { state: { message: "Information request sent" } });
      }, 2000);
    } catch (err) {
      console.error("Failed to submit request:", err);
      setError(err.message || "Failed to submit request. Please try again.");
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
            <p className="text-sm font-semibold text-danger">Error</p>
            <p className="text-sm text-danger/80 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium"
      >
        <ArrowLeft size={16} />
        Go Back
      </button>

      <div className="mb-7">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileQuestion size={21} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              Request More Information
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Specify additional information needed for authorization {authorization?.id}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">Error</p>
            <p className="text-sm text-danger/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-success/10 border border-success/30 rounded-lg">
          <p className="text-sm font-medium text-success">{successMessage}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface shadow-card p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Information Required *
            </label>
            <textarea
              value={formData.information_required}
              onChange={(e) =>
                setFormData({ ...formData, information_required: e.target.value })
              }
              placeholder="Specify what additional information is needed..."
              rows={6}
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-xs text-text-secondary mt-1">
              {formData.information_required.length}/1000 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Deadline for Submission
            </label>
            <input
              type="date"
              value={formData.deadline}
              onChange={(e) =>
                setFormData({ ...formData, deadline: e.target.value })
              }
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Contact Information
            </label>
            <input
              type="text"
              value={formData.contact_information}
              onChange={(e) =>
                setFormData({ ...formData, contact_information: e.target.value })
              }
              placeholder="Provider contact details (phone, email)"
              className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-text-primary border border-border rounded-lg hover:bg-input transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
