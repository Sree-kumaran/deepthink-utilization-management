import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Info,
  Paperclip,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| MOCK REQUEST DATA
|--------------------------------------------------------------------------
| Keep this separate from the UI so it can later be replaced with API data.
*/
const providerResponse = {
  requestId: "PA-10025",
  patient: "John Smith",
  patientId: "P10025",
  diagnosis: "Chronic Knee Pain",
  requestedService: "MRI — Knee",
  insurance: "HealthPlus PPO",
  policy: "Knee MRI Policy",
  policyVersion: "v2.1",
  status: "Awaiting Provider Information",
  responseDue: "20 Aug 2026",
  priority: "High",
};

/*
|--------------------------------------------------------------------------
| REQUESTED DOCUMENTS
|--------------------------------------------------------------------------
*/
const requestedDocuments = [
  {
    id: 1,
    name: "Recent Imaging Results",
    reason: "Required to evaluate current clinical status",
    priority: "High",
    required: true,
  },
  {
    id: 2,
    name: "Physical Therapy Treatment Records",
    reason: "Required to verify conservative treatment",
    priority: "High",
    required: true,
  },
  {
    id: 3,
    name: "Latest Clinical Progress Notes",
    reason: "Required to verify current clinical indication",
    priority: "Medium",
    required: true,
  },
];

/*
|--------------------------------------------------------------------------
| STATUS HELPERS
|--------------------------------------------------------------------------
*/
function StatusBadge({ status }) {
  const styles = {
    "NOT SUBMITTED":
      "border-border bg-surface-secondary text-text-secondary",

    UPLOADED:
      "border-success/20 bg-success/10 text-success",

    REQUIRED:
      "border-warning/20 bg-warning/10 text-warning",

    OPTIONAL:
      "border-primary/20 bg-primary/10 text-primary",
  };

  const icons = {
    "NOT SUBMITTED": "○",
    UPLOADED: "✓",
    REQUIRED: "!",
    OPTIONAL: "○",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        styles[status] || styles["NOT SUBMITTED"]
      }`}
    >
      <span aria-hidden="true">{icons[status] || "○"}</span>
      {status}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| PRIORITY BADGE
|--------------------------------------------------------------------------
*/
function PriorityBadge({ priority }) {
  const isHigh = priority === "High";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${
        isHigh
          ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
          : "border-warning/20 bg-warning/10 text-warning"
      }`}
    >
      {priority}
    </span>
  );
}

/*
|--------------------------------------------------------------------------
| DOCUMENT UPLOAD CARD
|--------------------------------------------------------------------------
*/
function DocumentUploadCard({
  document,
  uploadedFile,
  onFileChange,
  onRemove,
  onPreview,
  error,
}) {
  const inputRef = useRef(null);

  const handleBrowse = () => {
    inputRef.current?.click();
  };

  return (
    <article
      className={`rounded-2xl border bg-surface p-5 shadow-card transition ${
        error
          ? "border-rose-500/50"
          : uploadedFile
          ? "border-success/30"
          : "border-border"
      }`}
    >
      {/* DOCUMENT HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText size={19} />
          </div>

          <div>
            <h3 className="text-sm font-bold text-text-primary">
              {document.name}
            </h3>

            <p className="mt-1 text-xs leading-5 text-text-secondary">
              {document.reason}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <PriorityBadge priority={document.priority} />

              {document.required && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  Required
                </span>
              )}
            </div>
          </div>
        </div>

        <StatusBadge
          status={uploadedFile ? "UPLOADED" : document.required ? "REQUIRED" : "NOT SUBMITTED"}
        />
      </div>

      {/* UPLOAD AREA */}
      {!uploadedFile ? (
        <div className="mt-5">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                onFileChange(document.id, file);
              }

              event.target.value = "";
            }}
            aria-label={`Upload ${document.name}`}
          />

          <button
            type="button"
            onClick={handleBrowse}
            className="flex min-h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-secondary px-5 py-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03] focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload size={19} />
            </span>

            <span className="mt-3 text-sm font-semibold text-text-primary">
              Upload Document
            </span>

            <span className="mt-1 text-xs text-text-secondary">
              PDF, JPG, PNG
            </span>

            <span className="mt-1 text-[11px] text-text-muted">
              Maximum size: 10 MB
            </span>
          </button>

          {error && (
            <p
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-500"
              role="alert"
            >
              <X size={14} />
              {error}
            </p>
          )}
        </div>
      ) : (
        /* UPLOADED FILE */
        <div className="mt-5 rounded-xl border border-success/20 bg-success/[0.04] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                <Paperclip size={18} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">
                  {uploadedFile.name}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span>{formatFileSize(uploadedFile.size)}</span>
                  <span>•</span>
                  <span>{getFileExtension(uploadedFile.name)}</span>
                </div>

                <p className="mt-1 text-xs font-medium text-success">
                  Uploaded successfully
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onPreview(document.id)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <Eye size={14} />
                Preview
              </button>

              <button
                type="button"
                onClick={() => onRemove(document.id)}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 text-xs font-semibold text-rose-500 transition hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              >
                <X size={14} />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

/*
|--------------------------------------------------------------------------
| MAIN PAGE
|--------------------------------------------------------------------------
*/
export default function ProviderResponse() {
  const navigate = useNavigate();

  const [uploadedFiles, setUploadedFiles] = useState({});
  const [fileErrors, setFileErrors] = useState({});
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [previewDocument, setPreviewDocument] = useState(null);

  /*
  |--------------------------------------------------------------------------
  | DYNAMIC COUNTS
  |--------------------------------------------------------------------------
  */
  const documentsUploaded = useMemo(
    () => Object.keys(uploadedFiles).length,
    [uploadedFiles]
  );

  const documentsRemaining =
    requestedDocuments.length - documentsUploaded;

  /*
  |--------------------------------------------------------------------------
  | FILE VALIDATION
  |--------------------------------------------------------------------------
  */
  const validateFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];

    const extension = getFileExtension(file.name).toLowerCase();

    const validType =
      allowedTypes.includes(file.type) ||
      allowedExtensions.includes(extension);

    if (!validType) {
      return "Unsupported file type.";
    }

    if (file.size > 10 * 1024 * 1024) {
      return "File size must be less than 10 MB.";
    }

    return "";
  };

  /*
  |--------------------------------------------------------------------------
  | FILE SELECT
  |--------------------------------------------------------------------------
  */
  const handleFileChange = (documentId, file) => {
    const error = validateFile(file);

    if (error) {
      setFileErrors((previous) => ({
        ...previous,
        [documentId]: error,
      }));

      return;
    }

    setFileErrors((previous) => {
      const next = { ...previous };
      delete next[documentId];
      return next;
    });

    setUploadedFiles((previous) => ({
      ...previous,
      [documentId]: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    }));
  };

  /*
  |--------------------------------------------------------------------------
  | REMOVE FILE
  |--------------------------------------------------------------------------
  */
  const handleRemoveFile = (documentId) => {
    setUploadedFiles((previous) => {
      const next = { ...previous };
      delete next[documentId];
      return next;
    });

    setFileErrors((previous) => {
      const next = { ...previous };
      delete next[documentId];
      return next;
    });
  };

  /*
  |--------------------------------------------------------------------------
  | PREVIEW
  |--------------------------------------------------------------------------
  */
  const handlePreview = (documentId) => {
    const document = requestedDocuments.find(
      (item) => item.id === documentId
    );

    const file = uploadedFiles[documentId];

    if (document && file) {
      setPreviewDocument({
        document,
        file,
      });
    }
  };

  /*
  |--------------------------------------------------------------------------
  | SUBMIT
  |--------------------------------------------------------------------------
  */
  const handleSubmit = () => {
    setSubmitError("");

    if (documentsRemaining > 0) {
      setSubmitError(
        "Please upload all required documents before submitting."
      );

      return;
    }

    setIsSubmitting(true);

    // Mock frontend submission.
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1400);
  };

  /*
  |--------------------------------------------------------------------------
  | SUCCESS STATE
  |--------------------------------------------------------------------------
  */
  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-[1100px]">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => navigate("/requests")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <ArrowLeft size={16} />
            Back to Requests
          </button>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 size={34} />
            </div>

            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
              Submission Complete
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              Response Submitted
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-text-secondary">
              Your documentation has been successfully submitted
              and the authorization request has been returned for
              review.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
              <SuccessInfo
                label="Request ID"
                value={providerResponse.requestId}
              />

              <SuccessInfo
                label="Documents Submitted"
                value={documentsUploaded}
              />

              <SuccessInfo
                label="Submitted"
                value="13 Aug 2026"
              />

              <SuccessInfo
                label="Status"
                value="Pending Clinical Review"
                success
              />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => navigate("/requests")}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto"
              >
                View Request
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => navigate("/requests")}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-auto"
              >
                Back to Requests
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | FORM PAGE
  |--------------------------------------------------------------------------
  */
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      {/* PAGE HEADER */}
      <header className="mb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                Provider Response
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                Submit the additional documentation requested for
                this authorization.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <StatusBadge status="REQUIRED" />

            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-500">
              <span aria-hidden="true">!</span>
              High Priority
            </span>
          </div>
        </div>
      </header>

      {/* REQUEST INFORMATION */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
          <TopInfo
            label="Request ID"
            value={providerResponse.requestId}
          />

          <TopInfo
            label="Patient"
            value={providerResponse.patient}
          />

          <TopInfo
            label="Requested Service"
            value={providerResponse.requestedService}
          />

          <TopInfo
            label="Status"
            value={providerResponse.status}
          />

          <TopInfo
            label="Response Due"
            value={providerResponse.responseDue}
          />
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-bold text-text-primary">
            Authorization Workflow
          </h2>

          <p className="mt-1 text-xs text-text-secondary">
            Current request processing stage.
          </p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <WorkflowStep
            number="1"
            label="Authorization Request"
            completed
          />

          <WorkflowLine completed />

          <WorkflowStep
            number="2"
            label="Policy Evaluation"
            completed
          />

          <WorkflowLine completed />

          <WorkflowStep
            number="3"
            label="Information Requested"
            completed
          />

          <WorkflowLine completed />

          <WorkflowStep
            number="4"
            label="Provider Response"
            active
          />

          <WorkflowLine />

          <WorkflowStep
            number="5"
            label="Review"
          />
        </div>
      </section>

      {/* MAIN TWO COLUMN */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        {/* LEFT COLUMN */}
        <main className="min-w-0">
          {/* INFORMATION REQUESTED */}
          <section className="mb-6 rounded-2xl border border-primary/20 bg-surface shadow-card">
            <div className="border-b border-primary/10 bg-primary/[0.04] px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Info size={18} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Information Requested
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Additional clinical documentation is required
                    before this authorization request can be
                    completed.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="space-y-3">
                {requestedDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="rounded-xl border border-border bg-surface-secondary p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-text-primary">
                          {document.name}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-text-secondary">
                          {document.reason}.
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <PriorityBadge
                          priority={document.priority}
                        />

                        <StatusBadge status="REQUIRED" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* DOCUMENT SUBMISSION */}
          <section className="mb-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-text-primary">
                Submit Documents
              </h2>

              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Upload each required document. Accepted formats
                are PDF, JPG, and PNG up to 10 MB.
              </p>
            </div>

            <div className="space-y-4">
              {requestedDocuments.map((document) => (
                <DocumentUploadCard
                  key={document.id}
                  document={document}
                  uploadedFile={uploadedFiles[document.id]}
                  onFileChange={handleFileChange}
                  onRemove={handleRemoveFile}
                  onPreview={handlePreview}
                  error={fileErrors[document.id]}
                />
              ))}
            </div>
          </section>

          {/* ADDITIONAL COMMENTS */}
          <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-text-primary">
                Additional Comments
              </h2>

              <p className="mt-1 text-xs text-text-secondary">
                Provide any additional information that may help
                the clinical reviewer.
              </p>
            </div>

            <label
              htmlFor="provider-comments"
              className="sr-only"
            >
              Additional Comments
            </label>

            <textarea
              id="provider-comments"
              value={comments}
              onChange={(event) => {
                if (event.target.value.length <= 1000) {
                  setComments(event.target.value);
                }
              }}
              maxLength={1000}
              rows={6}
              placeholder="Add any additional information for the clinical reviewer..."
              className="w-full resize-y rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm leading-6 text-text-primary outline-none placeholder:text-text-muted transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <div className="mt-2 flex justify-end">
              <span className="text-xs text-text-muted">
                {comments.length} / 1000
              </span>
            </div>
          </section>

          {/* SUBMISSION SUMMARY */}
          <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-5">
              <h2 className="text-base font-bold text-text-primary">
                Submission Summary
              </h2>

              <p className="mt-1 text-xs text-text-secondary">
                Review the documentation before submitting.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryMetric
                label="Requested Documents"
                value={requestedDocuments.length}
              />

              <SummaryMetric
                label="Documents Uploaded"
                value={documentsUploaded}
                success={documentsUploaded > 0}
              />

              <SummaryMetric
                label="Documents Remaining"
                value={documentsRemaining}
                warning={documentsRemaining > 0}
              />
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-secondary px-4 py-3">
              {comments.trim() ? (
                <CheckCircle2
                  size={16}
                  className="shrink-0 text-success"
                />
              ) : (
                <Info
                  size={16}
                  className="shrink-0 text-text-muted"
                />
              )}

              <span className="text-xs text-text-secondary">
                Additional Comments:
              </span>

              <strong className="text-xs text-text-primary">
                {comments.trim() ? "Provided" : "Not Provided"}
              </strong>
            </div>
          </section>

          {/* VALIDATION MESSAGE */}
          {submitError && (
            <div
              className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3"
              role="alert"
            >
              <X
                size={18}
                className="mt-0.5 shrink-0 text-rose-500"
              />

              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Submission cannot be completed
                </p>

                <p className="mt-1 text-xs leading-5 text-rose-500">
                  {submitError}
                </p>
              </div>
            </div>
          )}

          {/* SUBMIT ACTIONS */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Ready to submit?
                </p>

                <p className="mt-1 text-xs text-text-secondary">
                  All required documentation must be uploaded.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => navigate("/requests")}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary transition hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {isSubmitting ? (
                    <>
                      <Spinner />
                      Submitting Response...
                    </>
                  ) : (
                    <>
                      Submit Response
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* RIGHT COLUMN */}
        <aside className="min-w-0">
          {/* REQUEST SUMMARY */}
          <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  Authorization Request
                </h2>

                <p className="mt-0.5 text-xs text-text-secondary">
                  Request details
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <SideInfo
                label="Patient"
                value={providerResponse.patient}
              />

              <SideInfo
                label="Patient ID"
                value={providerResponse.patientId}
              />

              <SideInfo
                label="Diagnosis"
                value={providerResponse.diagnosis}
              />

              <SideInfo
                label="Requested Service"
                value={providerResponse.requestedService}
              />

              <SideInfo
                label="Insurance"
                value={providerResponse.insurance}
              />

              <SideInfo
                label="Policy"
                value={providerResponse.policy}
              />

              <SideInfo
                label="Policy Version"
                value={providerResponse.policyVersion}
              />

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Status
                </span>

                <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[10px] font-bold text-warning">
                  <Clock3 size={12} />
                  Awaiting Provider Information
                </span>
              </div>

              <SideInfo
                label="Response Due"
                value={providerResponse.responseDue}
              />
            </div>
          </section>

          {/* INFORMATION TRACE */}
          <section className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-text-primary">
                Why was this requested?
              </h2>

              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Documentation requested because these policy
                criteria could not be fully verified.
              </p>
            </div>

            <div className="space-y-4">
              <CriteriaItem
                title="Conservative treatment documentation"
                evidence="Physical therapy treatment records"
              />

              <CriteriaItem
                title="Clinical indication"
                evidence="Latest clinical progress notes"
              />
            </div>

            <button
              type="button"
              onClick={() => navigate("/decision-trace")}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-secondary px-4 text-xs font-semibold text-text-primary transition hover:border-primary/40 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              View Decision Trace
              <ArrowRight size={15} />
            </button>
          </section>

          {/* RESPONSE DEADLINE */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock3 size={17} />
              </div>

              <div>
                <h2 className="text-sm font-bold text-text-primary">
                  Response Deadline
                </h2>

                <p className="mt-1 text-xs leading-5 text-text-secondary">
                  Documentation should be submitted by the date
                  below.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-surface-secondary p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Response Due
              </p>

              <p className="mt-1 text-base font-bold text-text-primary">
                {providerResponse.responseDue}
              </p>

              <p className="mt-1 text-xs text-warning">
                Provider response pending
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* PREVIEW MODAL */}
      {previewDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-preview-title"
          onClick={() => setPreviewDocument(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Document Preview
                </p>

                <h2
                  id="document-preview-title"
                  className="mt-1 text-lg font-bold text-text-primary"
                >
                  {previewDocument.file.name}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setPreviewDocument(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                aria-label="Close preview"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-surface-secondary p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText size={20} />
                </div>

                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {previewDocument.document.name}
                  </p>

                  <p className="mt-1 text-xs text-text-secondary">
                    {formatFileSize(previewDocument.file.size)} •{" "}
                    {getFileExtension(previewDocument.file.name).toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-primary/10 bg-primary/[0.04] px-4 py-3">
                <p className="text-xs leading-5 text-text-secondary">
                  This is a frontend mock preview. The actual
                  document viewer will be connected when backend
                  document storage is implemented.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPreviewDocument(null)}
              className="mt-5 min-h-10 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| SMALL REUSABLE UI COMPONENTS
|--------------------------------------------------------------------------
*/

function TopInfo({ label, value }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>

      <p className="mt-1.5 text-sm font-semibold leading-5 text-text-primary">
        {value}
      </p>
    </div>
  );
}

function SideInfo({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>

      <p className="mt-1 text-sm font-semibold leading-5 text-text-primary">
        {value}
      </p>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  success = false,
  warning = false,
}) {
  let valueClass = "text-text-primary";

  if (success) {
    valueClass = "text-success";
  }

  if (warning) {
    valueClass = "text-warning";
  }

  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>

      <p className={`mt-2 text-2xl font-bold ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

function SuccessInfo({ label, value, success = false }) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>

      <p
        className={`mt-1.5 text-sm font-bold ${
          success ? "text-success" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CriteriaItem({ title, evidence }) {
  return (
    <div className="rounded-xl border border-warning/20 bg-warning/[0.04] p-4">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/10 text-xs font-bold text-warning"
          aria-hidden="true"
        >
          !
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">
            {title}
          </p>

          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Missing Evidence
          </p>

          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {evidence}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  completed = false,
  active = false,
}) {
  return (
    <div className="flex items-center gap-3 md:min-w-0 md:flex-1">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active
            ? "bg-primary text-white ring-4 ring-primary/10"
            : completed
            ? "bg-success/10 text-success"
            : "bg-surface-secondary text-text-muted"
        }`}
        aria-label={
          completed
            ? `${label} completed`
            : active
            ? `${label} current step`
            : label
        }
      >
        {completed ? <Check size={16} /> : number}
      </div>

      <span
        className={`text-xs font-semibold ${
          active
            ? "text-primary"
            : completed
            ? "text-text-primary"
            : "text-text-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function WorkflowLine({ completed = false }) {
  return (
    <div
      className={`hidden h-px flex-1 md:block ${
        completed ? "bg-success/40" : "bg-border"
      }`}
      aria-hidden="true"
    />
  );
}

function Spinner() {
  return (
    <span
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
      aria-hidden="true"
    />
  );
}

/*
|--------------------------------------------------------------------------
| FILE HELPERS
|--------------------------------------------------------------------------
*/

function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 1
  )} ${units[index]}`;
}

function getFileExtension(fileName) {
  return fileName.split(".").pop() || "";
}