const OUTCOME = "APPROVE";
// Change ONLY the value above to:
// "PEND FOR NURSE REVIEW"
// "REQUEST MORE INFORMATION"

const OUTCOME_CONFIG = {
  APPROVE: {
    outcome: "APPROVE",
    confidence: "HIGH",
    confidencePercent: 95,
    summary:
      "All required policy conditions are satisfied. The submitted clinical evidence meets the applicable authorization criteria.",
    nextAction: "Proceed with authorization.",
    actionLabel: "Proceed with Authorization",
    accent: "success",
    icon: "check",
  },

  "PEND FOR NURSE REVIEW": {
    outcome: "PEND FOR NURSE REVIEW",
    confidence: "MEDIUM",
    confidencePercent: 82,
    summary:
      "Clinical information requires additional nurse review before a final authorization decision can be made.",
    nextAction: "Assign this request to a nurse reviewer.",
    actionLabel: "Send to Nurse Review",
    accent: "warning",
    icon: "review",
  },

  "REQUEST MORE INFORMATION": {
    outcome: "REQUEST MORE INFORMATION",
    confidence: "LOW",
    confidencePercent: 68,
    summary:
      "Required clinical documentation is missing. Additional information is needed before a final authorization decision can be made.",
    nextAction: "Request the missing clinical documentation.",
    actionLabel: "Request Information",
    accent: "danger",
    icon: "info",
  },
};

export const decisionData = {
  requestId: "PA-10025",

  patient: "John Smith",

  requestedService: "MRI — Knee",

  policy: "Knee MRI Policy",

  policyVersion: "v2.1",

  rulesEvaluated: 5,

  rulesPassed: 5,

  rulesFailed: 0,

  informationMissing: 0,

  ...OUTCOME_CONFIG[OUTCOME],
};

export { OUTCOME };