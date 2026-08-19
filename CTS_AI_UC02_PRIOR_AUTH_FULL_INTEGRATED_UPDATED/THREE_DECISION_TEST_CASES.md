# Three Decision Test Cases

The frontend now exposes **Death Date** and **Patient Details** so all three decision outcomes can be tested from the same New Authorization form.

## Decision precedence implemented

1. Existing required-field check -> `REQUEST_MORE_INFORMATION`.
2. If no required field is missing, `death_date` invalid/missing **OR** `details` invalid/missing -> `PEND_FOR_NURSE_REVIEW`.
3. Otherwise the existing rule-engine decision is preserved, including `APPROVE`.

## 1. Approved

Use:

- Patient ID: `PAT-AP-001`
- Patient Name: `John Anderson`
- Date of Birth: `1985-04-12`
- Age: `41`
- Gender: `Male`
- Insurance Plan: `UnitedHealthcare`
- Member ID: `UHC-AP-001`
- Primary Diagnosis: `Chronic knee pain`
- Diagnosis Code: `M25.561`
- Symptoms: `Persistent right knee pain and mild stiffness`
- Symptom Duration: `8 weeks`
- Previous Treatment: `Physical therapy for 8 weeks`
- Treatment Duration: `8 weeks`
- Current Medications: `Ibuprofen`
- Clinical Indication: `MRI is medically necessary to evaluate persistent knee pain and guide treatment planning.`
- Requested Service: `MRI Knee`
- Service Category: `Diagnostic Imaging`
- Provider: `Dr. Robert Wilson`
- Facility: `Central Medical Center`
- Urgency: `Routine`
- Clinical Notes: `Patient has persistent knee pain despite conservative treatment. Imaging is clinically indicated.`
- Death Date: `2026-01-15`
- Patient Details: `Complete patient and clinical documentation is available.`

Expected: **Approved** (`APPROVE`)

## 2. Request More Information

Use the same valid data as the Approved case, but leave **Provider** empty. Keep **Death Date** and **Patient Details** valid.

The existing backend `missing()` check identifies `provider.provider_id` as missing.

Expected: **Request More Information** (`REQUEST_MORE_INFORMATION`)

## 3. Pending for Nurse Review

Use the same valid data as the Approved case, including a valid Provider, but leave **Death Date empty**. Keep Patient Details valid.

Expected: **Pending for Nurse Review** (`PEND_FOR_NURSE_REVIEW`)

You can also test the other side of the requested OR condition by keeping Death Date valid and leaving Patient Details empty. That should produce the same Nurse Review decision.
