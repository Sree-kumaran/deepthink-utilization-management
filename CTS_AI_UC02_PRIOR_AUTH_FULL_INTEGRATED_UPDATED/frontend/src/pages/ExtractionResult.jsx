import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  ClipboardCheck,
  FileText,
  Gauge,
  Pill,
  ScanLine,
  UserRound,
} from "lucide-react";

export default function ExtractionResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [authorization, setAuthorization] = useState(location.state?.authorization || null);
  const [loading, setLoading] = useState(!location.state?.authorization && Boolean(id));
  const [loadError, setLoadError] = useState(null);

  const request = location.state?.request;

  useEffect(() => {
    if (authorization || !id) return;
    let cancelled = false;
    api.authorization.get(id)
      .then((data) => { if (!cancelled) setAuthorization(data); })
      .catch((err) => { if (!cancelled) setLoadError(err.message || "Unable to load authorization details."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, authorization]);

  const display = (value) => {
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return "Not available";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  };

  if (loading) {
    return <div className="flex min-h-[420px] items-center justify-center"><p className="text-sm text-text-secondary">Loading extraction results...</p></div>;
  }

  if (loadError || !authorization) {
    return <div className="mx-auto max-w-3xl"><div className="rounded-xl border border-danger/30 bg-danger/10 p-5"><p className="font-semibold text-danger">Unable to load extraction results</p><p className="mt-1 text-sm text-danger/80">{loadError || "No authorization context is available. Open the request again from the queue."}</p><button type="button" onClick={() => navigate("/requests")} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">Back to Requests</button></div></div>;
  }

  const sourceRequest = request || {
    patientId: authorization.patient?.patient_id,
    patientName: authorization.patient?.patient_name,
    age: authorization.patient?.age,
    gender: authorization.patient?.gender || authorization.patient?.sex,
    insurancePlan: authorization.plan?.plan_name,
    primaryDiagnosis: authorization.clinical?.diagnosis,
    diagnosisCode: authorization.clinical?.diagnosis_code || authorization.patient?.diagnosis_code,
    symptoms: authorization.clinical?.symptoms,
    symptomDuration: authorization.clinical?.symptom_duration_weeks,
    previousTreatment: authorization.clinical?.prior_treatment,
    treatmentDuration: authorization.clinical?.prior_treatment_duration_weeks,
    currentMedications: authorization.clinical?.current_medications || authorization.patient?.medications,
    clinicalIndication: authorization.clinical?.indication,
    requestedService: authorization.service?.service_name,
    serviceCategory: authorization.service?.category,
    clinicalNotes: authorization.clinical?.clinical_notes,
    csvData: [],
    csvFileName: "",
  };

  const data = {
    requestId: authorization?.id || sourceRequest?.requestId || "Not available",
    patient: {
      patientId: sourceRequest?.patientId,
      patientName: sourceRequest?.patientName,
      age: sourceRequest?.age,
      gender: sourceRequest?.gender,
      insurance: sourceRequest?.insurancePlan,
    },
    clinical: {
      diagnosis: sourceRequest?.primaryDiagnosis,
      diagnosisCode: sourceRequest?.diagnosisCode,
      symptoms: sourceRequest?.symptoms,
      symptomDuration: sourceRequest?.symptomDuration,
      indication: sourceRequest?.clinicalIndication,
    },
    previousTreatment: {
      treatment: sourceRequest?.previousTreatment,
      duration: sourceRequest?.treatmentDuration,
    },
    medication: {
      medication: sourceRequest?.currentMedications,
    },
    requestedService: {
      service: sourceRequest?.requestedService,
      category: sourceRequest?.serviceCategory,
    },
    clinicalPrompt: sourceRequest?.clinicalPrompt || sourceRequest?.clinicalNotes,
    csvData: sourceRequest?.csvData || [],
    csvFileName: sourceRequest?.csvFileName || "",
    confidence: authorization?.extraction_confidence,
  };

  const keyFacts = [
    [data.clinical.diagnosis, "Diagnosis provided"],
    [data.requestedService.service, "Requested service provided"],
    [data.clinical.symptoms, "Symptoms provided"],
    [data.previousTreatment.treatment, "Previous treatment provided"],
    [data.medication.medication, "Medication information provided"],
    [data.clinical.indication, "Clinical indication provided"],
  ].filter(([value]) => value).map(([, label]) => label);

  const policyEvaluationData = {
    requestId: data.requestId,
    source: "Clinical Documentation",
    status: "Documentation Ready",
    extractedData: data,
    originalRequest: sourceRequest || null,
    authorization,
  };

  return (
    <div className="mx-auto w-full max-w-[1500px]">
      {/* Header */}
      <header className="mb-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BrainCircuit size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                AI Extraction Results
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">
                Review the clinical information submitted for this authorization before policy evaluation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:pt-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success-bg px-3 py-1.5 text-xs font-semibold text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              Documentation Ready
            </div>

            <div className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary">
              Request ID:{" "}
              <span className="font-semibold text-text-primary">
                {display(data.requestId)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        {/* LEFT */}
        <main className="min-w-0 space-y-5">
          <div className="mb-1 flex items-center gap-2">
            <ClipboardCheck size={17} className="text-primary" />
            <h2 className="text-sm font-bold text-text-primary">
              Submitted Clinical Information
            </h2>
          </div>

          <InformationCard
            icon={UserRound}
            title="Patient Information"
            items={[
              ["Patient ID", data.patient.patientId],
              ["Patient Name", data.patient.patientName],
              ["Age", data.patient.age],
              ["Gender", data.patient.gender],
              ["Insurance", data.patient.insurance],
            ]}
          />

          <InformationCard
            icon={FileText}
            title="Clinical Information"
            items={[
              ["Diagnosis", data.clinical.diagnosis],
              ["Diagnosis Code", data.clinical.diagnosisCode],
              ["Symptoms", data.clinical.symptoms],
              ["Symptom Duration", data.clinical.symptomDuration],
            ]}
          />

          <InformationCard
            icon={ClipboardCheck}
            title="Previous Treatment"
            items={[
              ["Treatment", data.previousTreatment.treatment],
              ["Duration", data.previousTreatment.duration],
              ["Outcome", data.previousTreatment.outcome],
            ]}
          />

          <InformationCard
            icon={Pill}
            title="Medication"
            items={[
              ["Medication", data.medication.medication],
              ["Duration", data.medication.duration],
            ]}
          />

          {/* Mobile / lower requested service */}
          <RequestedServiceCard data={data} />
        </main>

        {/* RIGHT */}
        <aside className="space-y-5 xl:sticky xl:top-6">
          {/* AI Summary */}
          <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
            <div className="border-b border-border p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BrainCircuit size={20} />
                </div>

                <div>
                  <h2 className="text-base font-bold text-text-primary">
                    Clinical Documentation Summary
                  </h2>
                  <p className="mt-1 text-xs text-text-secondary">
                    User-provided clinical documentation
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                <p className="text-sm font-medium leading-6 text-text-primary">
                  The submitted clinical documentation is shown below. No sample clinical information is used.
                </p>
              </div>

              <div className="mt-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">
                  Provided Key Facts
                </p>

                <div className="space-y-3">
                  {keyFacts.map((fact) => (
                    <div
                      key={fact}
                      className="flex items-start gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-secondary"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check size={12} strokeWidth={3} />
                      </span>

                      <span className="text-sm leading-5 text-text-primary">
                        {fact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Confidence */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Documentation Source
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Source of the information shown on this page
                </p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Gauge size={18} />
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <span className="text-3xl font-bold tracking-tight text-text-primary">
                {data.csvFileName ? "Prompt + CSV" : data.clinicalPrompt ? "Clinical Prompt" : data.csvData.length ? "CSV" : "Not available"}
              </span>

              <span className="pb-1 text-xs font-medium text-text-muted">
                User-provided source
              </span>
            </div>

          </section>

          {/* Desktop requested service */}
          <div className="hidden xl:block">
            <RequestedServiceCard data={data} />
          </div>
        </aside>
      </div>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-base font-bold text-text-primary">Clinical Notes / Clinical Prompt</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-text-secondary">{display(data.clinicalPrompt)}</p>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="text-base font-bold text-text-primary">Clinical Data CSV</h2>
          <p className="mt-1 text-xs text-text-secondary">{data.csvFileName ? data.csvFileName : "Not uploaded"}</p>
          {data.csvData.length ? <div className="mt-4 overflow-x-auto rounded-xl border border-border"><table className="min-w-full text-left text-xs"><thead className="border-b border-border bg-surface-secondary"><tr>{Object.keys(data.csvData[0]).map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 font-bold text-text-primary">{header}</th>)}</tr></thead><tbody>{data.csvData.slice(0, 5).map((row, index) => <tr key={index} className="border-b border-border last:border-0">{Object.keys(data.csvData[0]).map((header) => <td key={header} className="max-w-[240px] truncate px-3 py-2 text-text-secondary">{row[header]}</td>)}</tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-text-secondary">Not available</p>}
        </section>
      </section>

      {/* Actions */}
      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate("/new-authorization")}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-5 text-sm font-semibold text-text-primary transition hover:border-primary/40 hover:bg-surface-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto"
        >
          <ArrowLeft size={17} />
          Back to Request
        </button>

        <button
          type="button"
          onClick={() =>
            navigate(`/policy-evaluation/${data.requestId}`, {
              state: { ...policyEvaluationData, authorization },
            })
          }
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-background sm:w-auto"
        >
          Continue to Policy Evaluation
          <ArrowRight size={17} />
        </button>
      </div>
    </div>
  );
}

function InformationCard({ icon: Icon, title, items }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition hover:border-primary/20">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={17} />
        </div>

        <h3 className="text-sm font-bold text-text-primary">{title}</h3>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {items.map(([label, value], index) => (
          <div
            key={label}
            className={`px-5 py-4 transition hover:bg-surface-secondary sm:px-6 ${
              index >= 2 ? "sm:border-t sm:border-border" : ""
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
              {label}
            </p>

            <p className="mt-1.5 text-sm font-semibold leading-5 text-text-primary">
              {value || "Not identified"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RequestedServiceCard({ data }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.04] shadow-card">
      <div className="flex items-center gap-3 border-b border-primary/10 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanLine size={18} />
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
            Requested Service
          </p>
          <h3 className="mt-0.5 text-base font-bold text-text-primary">
            {data.requestedService.service}
          </h3>
        </div>
      </div>

      <div className="px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">
          Category
        </p>

        <p className="mt-1 text-sm font-semibold text-text-primary">
          {data.requestedService.category}
        </p>
      </div>
    </section>
  );
}