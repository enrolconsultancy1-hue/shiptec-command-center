import { IntakeInput, ValidationFinding, ValidationReport, ValidationStatus } from "./types.js";

function statusFromFindings(findings: ValidationFinding[]): ValidationStatus {
  if (findings.some((finding) => finding.status === "fail")) {
    return "fail";
  }
  if (findings.some((finding) => finding.status === "warning")) {
    return "warning";
  }
  return "pass";
}

function missing(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim().length === 0;
}

export function validateIntake(intake: IntakeInput): ValidationReport {
  const findings: ValidationFinding[] = [];
  const requiredStringFields: Array<keyof Pick<IntakeInput, "projectName" | "productSummary" | "businessProblem" | "currentWorkflow" | "desiredWorkflow" | "mvpDefinition">> = [
    "projectName",
    "productSummary",
    "businessProblem",
    "currentWorkflow",
    "desiredWorkflow",
    "mvpDefinition"
  ];

  for (const field of requiredStringFields) {
    if (missing(intake[field])) {
      findings.push({ status: "fail", field, message: `${field} is required.` });
    }
  }

  if (missing(intake.targetUsers)) {
    findings.push({ status: "fail", field: "targetUsers", message: "At least one target user or role is required." });
  }

  if (missing(intake.successCriteria)) {
    findings.push({ status: "fail", field: "successCriteria", message: "Specific success criteria are required before Builder execution." });
  }

  if (intake.openQuestions.length > 0) {
    findings.push({ status: "warning", field: "openQuestions", message: "Open questions exist. Mark them non-blocking before Builder execution." });
  }

  if (intake.toolsAndIntegrations.some((tool) => /tbd|unknown|maybe/i.test(tool))) {
    findings.push({ status: "warning", field: "toolsAndIntegrations", message: "One or more integrations appear undefined." });
  }

  if (findings.length === 0) {
    findings.push({ status: "pass", field: "intake", message: "Intake is specific enough to create the first Architect Pack." });
  }

  return {
    status: statusFromFindings(findings),
    findings,
    generatedAt: new Date().toISOString()
  };
}
