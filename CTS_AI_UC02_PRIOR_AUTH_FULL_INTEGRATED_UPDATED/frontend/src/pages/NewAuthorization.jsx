import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  Save,
  UserRound,
  AlertCircle,
  Upload,
  X,
  FileSpreadsheet,
} from "lucide-react";
import api from "../services/api";
import { choosePolicy } from "../utils/policySelection";

const initialForm = {
  patientId: "",
  patientName: "",
  dateOfBirth: "",
  deathDate: "",
  age: "",
  gender: "",
  insurancePlan: "",
  memberId: "",
  primaryDiagnosis: "",
  diagnosisCode: "",
  symptoms: "",
  symptomDuration: "",
  previousTreatment: "",
  treatmentDuration: "",
  currentMedications: "",
  clinicalIndication: "",
  details: "",
  requestedService: "",
  serviceCategory: "",
  provider: "",
  facility: "",
  urgency: "Routine",
  requestedDate: "",
  clinicalNotes: "",
};

const MAX_CLINICAL_NOTES = 2000;
const MAX_CSV_SIZE = 5 * 1024 * 1024;

const requiredFields = {
  patientId: "Patient ID",
  patientName: "Patient Name",
  primaryDiagnosis: "Diagnosis",
  requestedService: "Requested Service",
  insurancePlan: "Insurance Plan",
};

function NewAuthorization() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef(null);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });

    setSaved(false);
    setApiError(null);
  };

  const validate = () => {
    const nextErrors = {};

    Object.entries(requiredFields).forEach(([field, label]) => {
      if (!String(form[field] || "").trim()) {
        nextErrors[field] = `${label} is required.`;
      }
    });

    if (!form.clinicalNotes.trim() && csvData.length === 0) {
      nextErrors.clinicalDocumentation = "Please provide clinical documentation or upload a CSV file.";
    }
    if (form.clinicalNotes.length > MAX_CLINICAL_NOTES) {
      nextErrors.clinicalNotes = `Clinical notes must be ${MAX_CLINICAL_NOTES} characters or fewer.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const characterCount = form.clinicalNotes.length;

  const summary = useMemo(
    () => ({
      patient: form.patientName || "Not provided",
      diagnosis: form.primaryDiagnosis || "Not provided",
      requestedService: form.requestedService || "Not provided",
      insurance: form.insurancePlan || "Not provided",
      urgency: form.urgency || "Routine",
    }),
    [form]
  );

  const parseCsv = (text) => {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && next === "\\n") i += 1;
        row.push(cell);
        if (row.some((item) => item.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    if (cell.length || row.length) {
      row.push(cell);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
    }

    if (!rows.length) return [];
    const headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
    return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  };

  const handleCsvFile = async (file) => {
    setCsvError("");
    setErrors((current) => {
      const next = { ...current };
      delete next.clinicalDocumentation;
      return next;
    });

    if (!file) return;
    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
    if (!isCsv) {
      setCsvError("Please choose a CSV file.");
      return;
    }
    if (file.size > MAX_CSV_SIZE) {
      setCsvError("CSV file must be 5 MB or smaller.");
      return;
    }

    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length) {
        setCsvError("The selected CSV does not contain any data rows.");
        return;
      }
      setCsvFile(file);
      setCsvData(parsed);
      setSaved(false);
      setApiError(null);
    } catch {
      setCsvError("Unable to read this CSV file. Please choose another file.");
    }
  };

  const removeCsv = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCsvDrop = (event) => {
    event.preventDefault();
    handleCsvFile(event.dataTransfer.files?.[0]);
  };

  const handleSaveDraft = () => {
    setSaved(true);
  };

  const handleEvaluate = async () => {
    if (!validate()) {
      setTimeout(() => {
        document
          .querySelector("[aria-invalid='true']")
          ?.focus();
      }, 0);
      return;
    }

    setIsEvaluating(true);
    setApiError(null);

    try {
      // Build payload matching backend schema
      const splitList = (value) => String(value || "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);

      // Payload mirrors the backend AuthorizationCreate schema exactly.
      const payload = {
        patient: {
          patient_id: form.patientId,
          patient_name: form.patientName,
          age: form.age ? Number(form.age) : null,
          sex: form.gender || null,
          diagnoses: splitList(form.primaryDiagnosis),
          medications: splitList(form.currentMedications),
          history: splitList(form.previousTreatment),
          date_of_birth: form.dateOfBirth || null,
          death_date: form.deathDate || null,
          gender: form.gender || null,
          diagnosis_code: form.diagnosisCode || null,
          details: form.details || null,
        },
        provider: {
          provider_id: form.provider || null,
          name: form.provider || null,
          organization: form.facility || null,
        },
        plan: {
          plan_id: form.memberId || form.insurancePlan || null,
          plan_name: form.insurancePlan || null,
          member_id: form.memberId || null,
        },
        service: {
          service_name: form.requestedService,
          category: form.serviceCategory || null,
          requested_date: form.requestedDate || null,
          site_of_service: form.facility || null,
        },
        documents: csvData.map((row, index) => ({
          type: "clinical_csv_row",
          row_number: index + 1,
          data: row,
        })),
        clinical: {
          diagnosis: form.primaryDiagnosis || null,
          indication: form.clinicalIndication || null,
          symptoms: splitList(form.symptoms),
          clinical_findings: splitList(form.clinicalNotes),
          prior_treatment: splitList(form.previousTreatment),
          prior_tests: [],
          symptom_duration_weeks: form.symptomDuration ? Number(form.symptomDuration) : null,
          prior_treatment_duration_weeks: form.treatmentDuration ? Number(form.treatmentDuration) : null,
          duration: form.symptomDuration || null,
          diagnosis_code: form.diagnosisCode || null,
          current_medications: splitList(form.currentMedications),
          clinical_notes: form.clinicalNotes || null,
          details: form.details || null,
          severity: form.urgency === "Urgent" ? "high" : "moderate",
          red_flag_symptoms: /red flag|neurological deficit|motor deficit|cauda equina|severe instability|acute weakness/i.test(
            `${form.symptoms} ${form.clinicalNotes}`
          ),
        },
        conflicting_information: [],
      };

      const response = await api.authorization.create(payload);

      // Creation and evaluation are separate backend operations. Evaluate against the active policy.
      let evaluationMessage = "Authorization created successfully.";
      try {
        const policies = await api.policy.list();
        const activePolicy = choosePolicy(policies, { payer: form.insurancePlan, service: form.requestedService });
        if (activePolicy) {
          await api.authorization.evaluate(response.id, activePolicy.id, activePolicy.active_version);

          // Nurse review records are created atomically by the backend when evaluation
          // produces PEND_FOR_NURSE_REVIEW. Do not create or swallow review errors here.

          evaluationMessage = "Authorization created and evaluated successfully.";
        } else {
          evaluationMessage = "Authorization created. No active policy was available for evaluation.";
        }
      } catch (evaluationError) {
        console.warn("Authorization was created but evaluation could not be completed:", evaluationError);
        evaluationMessage = "Authorization created, but policy evaluation is still pending.";
      }

      navigate(`/extraction-result/${response.id}`, {
        state: {
          request: { ...form, clinicalPrompt: form.clinicalNotes, csvData, csvFileName: csvFile?.name || "" },
          authorization: response,
          message: evaluationMessage,
        },
      });
    } catch (err) {
      console.error("Failed to create authorization:", err);
      setApiError(
        err.message || "Failed to create authorization. Please try again."
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      <div className="mb-7">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardCheck size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              New Authorization
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Submit a clinical request for AI-powered prior authorization
              evaluation.
            </p>
          </div>
        </div>
      </div>

      {apiError && (
        <div className="mb-6 p-4 bg-danger/10 border border-danger/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="text-danger mt-0.5 flex-shrink-0" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-danger">
              Failed to create authorization
            </p>
            <p className="text-sm text-danger/80 mt-1">{apiError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleEvaluate();
          }}
          className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
        >
          <section className="border-b border-border p-5 sm:p-6">
            <SectionHeader
              number="01"
              title="Patient Information"
              description="Enter the member's demographic and insurance information."
              icon={UserRound}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Patient ID"
                required
                value={form.patientId}
                error={errors.patientId}
                onChange={(value) => updateField("patientId", value)}
                placeholder="e.g. PT-10482"
              />

              <Field
                label="Patient Name"
                required
                value={form.patientName}
                error={errors.patientName}
                onChange={(value) => updateField("patientName", value)}
                placeholder="Enter patient name"
              />

              <Field
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(value) => updateField("dateOfBirth", value)}
              />

              <Field
                label="Age"
                type="number"
                min="0"
                max="120"
                value={form.age}
                onChange={(value) => updateField("age", value)}
                placeholder="Age"
              />

              <Field
                label="Death Date"
                type="date"
                value={form.deathDate}
                onChange={(value) => updateField("deathDate", value)}
                placeholder="Leave empty for nurse-review test"
              />

              <SelectField
                label="Gender"
                value={form.gender}
                onChange={(value) => updateField("gender", value)}
                options={["Male", "Female", "Non-binary", "Prefer not to say"]}
                placeholder="Select gender"
              />

              <Field
                label="Insurance Plan"
                required
                value={form.insurancePlan}
                error={errors.insurancePlan}
                onChange={(value) => updateField("insurancePlan", value)}
                placeholder="Enter insurance plan"
              />

              <Field
                label="Member ID"
                value={form.memberId}
                onChange={(value) => updateField("memberId", value)}
                placeholder="Enter member ID"
              />
            </div>
          </section>

          <section className="border-b border-border p-5 sm:p-6">
            <SectionHeader
              number="02"
              title="Clinical Information"
              description="Provide the clinical details supporting the authorization request."
              icon={FileText}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Primary Diagnosis"
                required
                value={form.primaryDiagnosis}
                error={errors.primaryDiagnosis}
                onChange={(value) => updateField("primaryDiagnosis", value)}
                placeholder="Enter primary diagnosis"
              />

              <Field
                label="Diagnosis Code"
                value={form.diagnosisCode}
                onChange={(value) => updateField("diagnosisCode", value)}
                placeholder="e.g. M54.5"
              />

              <Field
                label="Symptoms"
                value={form.symptoms}
                onChange={(value) => updateField("symptoms", value)}
                placeholder="Describe relevant symptoms"
              />

              <Field
                label="Symptom Duration"
                value={form.symptomDuration}
                onChange={(value) => updateField("symptomDuration", value)}
                placeholder="e.g. 6 weeks"
              />

              <Field
                label="Previous Treatment"
                value={form.previousTreatment}
                onChange={(value) => updateField("previousTreatment", value)}
                placeholder="Previous treatment or therapy"
              />

              <Field
                label="Treatment Duration"
                value={form.treatmentDuration}
                onChange={(value) => updateField("treatmentDuration", value)}
                placeholder="e.g. 8 weeks"
              />

              <Field
                label="Current Medications"
                value={form.currentMedications}
                onChange={(value) => updateField("currentMedications", value)}
                placeholder="List current medications"
              />

              <Field
                label="Clinical Indication"
                value={form.clinicalIndication}
                onChange={(value) => updateField("clinicalIndication", value)}
                placeholder="Reason for requested treatment"
              />


              <Field
                label="Patient Details"
                value={form.details}
                onChange={(value) => updateField("details", value)}
                placeholder="Supporting patient details"
              />
            </div>
          </section>

          <section className="border-b border-border p-5 sm:p-6">
            <SectionHeader
              number="03"
              title="Request Details"
              description="Specify the service being requested and provider information."
              icon={ClipboardCheck}
            />

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field
                label="Requested Service"
                required
                value={form.requestedService}
                error={errors.requestedService}
                onChange={(value) => updateField("requestedService", value)}
                placeholder="Enter requested service"
              />

              <SelectField
                label="Service Category"
                value={form.serviceCategory}
                onChange={(value) => updateField("serviceCategory", value)}
                options={[
                  "Diagnostic Imaging",
                  "Surgery",
                  "Medication",
                  "Therapy",
                  "Specialist Consultation",
                  "Laboratory",
                  "Other",
                ]}
                placeholder="Select category"
              />

              <Field
                label="Provider"
                value={form.provider}
                onChange={(value) => updateField("provider", value)}
                placeholder="Provider name"
              />

              <Field
                label="Facility"
                value={form.facility}
                onChange={(value) => updateField("facility", value)}
                placeholder="Facility name"
              />

              <SelectField
                label="Urgency"
                value={form.urgency}
                onChange={(value) => updateField("urgency", value)}
                options={["Routine", "Urgent", "Expedited"]}
              />

              <Field
                label="Requested Date"
                type="date"
                value={form.requestedDate}
                onChange={(value) => updateField("requestedDate", value)}
              />
            </div>
          </section>

          <section className="p-5 sm:p-6">
            <SectionHeader
              number="04"
              title="Clinical Documentation"
              description="Provide clinical information using a clinical note, CSV file, or both."
              icon={FileText}
            />

            <div className="space-y-6">
              <div>
                <label htmlFor="clinical-notes" className="mb-2 block text-sm font-semibold text-text-primary">
                  Clinical Notes / Clinical Prompt
                </label>
                <textarea
                  id="clinical-notes"
                  value={form.clinicalNotes}
                  maxLength={MAX_CLINICAL_NOTES}
                  onChange={(event) => updateField("clinicalNotes", event.target.value)}
                  aria-invalid={Boolean(errors.clinicalNotes || errors.clinicalDocumentation)}
                  rows={8}
                  placeholder="Enter clinical documentation, symptoms, diagnosis, medical history, previous treatment, medications, clinical indication, and justification for the requested service..."
                  className={`w-full resize-y rounded-xl border px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:ring-2 focus:ring-primary/25 ${errors.clinicalNotes || errors.clinicalDocumentation ? "border-danger focus:border-danger" : "border-border focus:border-primary"}`}
                />
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-xs font-medium text-danger" role="alert">{errors.clinicalNotes || ""}</p>
                  <span className="ml-auto shrink-0 text-xs text-text-muted">{characterCount} / {MAX_CLINICAL_NOTES}</span>
                </div>
              </div>

              <div>
                <div className="mb-2">
                  <label htmlFor="clinical-csv" className="block text-sm font-semibold text-text-primary">Clinical Data CSV</label>
                  <p className="mt-1 text-xs text-text-secondary">Upload a CSV containing structured clinical information.</p>
                </div>
                {!csvFile ? (
                  <div
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleCsvDrop}
                    className="rounded-2xl border-2 border-dashed border-border bg-surface-secondary p-7 text-center transition hover:border-primary/50"
                  >
                    <FileSpreadsheet className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-text-primary">Upload Clinical CSV</p>
                    <p className="mt-1 text-sm text-text-secondary">Drag &amp; drop your CSV here or</p>
                    <input ref={fileInputRef} id="clinical-csv" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => handleCsvFile(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <Upload size={16} /> Choose CSV File
                    </button>
                    <p className="mt-3 text-xs text-text-muted">Supported format: .csv • Maximum size: 5 MB</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-surface-secondary p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3"><FileSpreadsheet className="shrink-0 text-primary" size={20} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-text-primary">✓ {csvFile.name}</p><p className="mt-1 text-xs text-text-secondary">Rows: {csvData.length} • Columns: {csvData[0] ? Object.keys(csvData[0]).length : 0}</p></div></div>
                      <button type="button" onClick={removeCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-secondary"><X size={14} /> Remove CSV</button>
                    </div>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
                      <table className="min-w-full text-left text-xs">
                        <thead className="border-b border-border bg-surface-secondary"><tr>{Object.keys(csvData[0] || {}).map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 font-bold text-text-primary">{header}</th>)}</tr></thead>
                        <tbody>{csvData.slice(0, 5).map((row, index) => <tr key={index} className="border-b border-border last:border-0">{Object.keys(csvData[0] || {}).map((header) => <td key={header} className="max-w-[240px] truncate px-3 py-2 text-text-secondary">{row[header]}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                    {csvData.length > 5 && <p className="mt-2 text-xs text-text-muted">Showing the first 5 rows of {csvData.length}.</p>}
                  </div>
                )}
                {csvError && <p className="mt-2 text-xs font-medium text-danger" role="alert">{csvError}</p>}
              </div>

              {errors.clinicalDocumentation && <p className="text-sm font-medium text-danger" role="alert">{errors.clinicalDocumentation}</p>}
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-border bg-surface-secondary/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-h-5">
              {saved && (
                <div className="flex items-center gap-2 text-sm font-medium text-success">
                  <CheckCircle2 size={16} />
                  Draft saved successfully.
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isEvaluating}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-primary/50 hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                <Save size={17} />
                Save Draft
              </button>

              <button
                type="submit"
                disabled={isEvaluating}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Evaluating...
                  </>
                ) : (
                  <>
                    <ClipboardCheck size={17} />
                    Evaluate Request
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <aside className="h-fit xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Request Summary
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    Live request overview
                  </p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardCheck size={18} />
                </div>
              </div>
            </div>

            <div className="space-y-0 p-2">
              <SummaryRow label="Patient" value={summary.patient} />
              <SummaryRow label="Diagnosis" value={summary.diagnosis} />
              <SummaryRow
                label="Requested Service"
                value={summary.requestedService}
              />
              <SummaryRow label="Insurance" value={summary.insurance} />
              <SummaryRow label="Urgency" value={summary.urgency} />
            </div>

            <div className="m-4 rounded-xl border border-success/20 bg-success-bg p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 size={15} />
                </div>

                <div>
                  <p className="text-xs font-medium text-text-secondary">
                    Status
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-success">
                    Ready for Evaluation
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


function SectionHeader({ number, title, description, icon: Icon }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon size={17} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold tracking-widest text-primary">
            {number}
          </span>
          <h2 className="text-base font-bold text-text-primary">{title}</h2>
        </div>

        <p className="mt-1 text-xs leading-5 text-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  min,
  max,
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-text-primary"
      >
        {label} {required && <span className="text-danger">*</span>}
      </label>

      <div className="relative">
        {type === "date" && (
          <Calendar
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
        )}

        <input
          id={id}
          type={type}
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`min-h-11 w-full rounded-xl border bg-surface-secondary px-4 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:ring-2 focus:ring-primary/25 ${
            type === "date" ? "pl-10" : ""
          } ${
            error
              ? "border-danger focus:border-danger"
              : "border-border focus:border-primary"
          }`}
        />
      </div>

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SelectField({
  label,
  required = false,
  value,
  onChange,
  error,
  options,
  placeholder = "Select an option",
}) {
  const id = `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-text-primary"
      >
        {label} {required && <span className="text-danger">*</span>}
      </label>

      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`min-h-11 w-full cursor-pointer rounded-xl border bg-surface-secondary px-4 text-sm text-text-primary outline-none transition focus:ring-2 focus:ring-primary/25 ${
          error
            ? "border-danger focus:border-danger"
            : "border-border focus:border-primary"
        }`}
      >
        {placeholder && (
          <option value="" className="bg-surface text-text-primary">
            {placeholder}
          </option>
        )}

        {options.map((option) => (
          <option
            key={option}
            value={option}
            className="bg-surface text-text-primary"
          >
            {option}
          </option>
        ))}
      </select>

      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-xl px-3 py-3 transition hover:bg-surface-secondary">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-semibold ${
          value === "Not provided" ? "text-text-muted" : "text-text-primary"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export default NewAuthorization;
