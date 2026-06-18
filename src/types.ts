export type ValidationStatus = "pass" | "warning" | "fail";

export interface IntakeInput {
  projectName: string;
  productSummary: string;
  businessProblem: string;
  targetUsers: string[];
  currentWorkflow: string;
  desiredWorkflow: string;
  toolsAndIntegrations: string[];
  technicalConstraints: string[];
  successCriteria: string[];
  mvpDefinition: string;
  knownRisks: string[];
  openQuestions: string[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  intake: IntakeInput;
  createdAt: string;
}

export interface FileCheck {
  path: string;
  exists: boolean;
}

export interface ProjectScan {
  projectId: string;
  rootPath: string;
  files: FileCheck[];
  missingFiles: string[];
}

export interface ValidationFinding {
  status: ValidationStatus;
  field: string;
  message: string;
}

export interface ValidationReport {
  status: ValidationStatus;
  findings: ValidationFinding[];
  generatedAt: string;
}

export interface HealthScore {
  score: number;
  reasons: string[];
  recommendedActions: string[];
}

export interface SprintRecord {
  sprintId: string;
  path: string;
  createdAt: string;
}

export interface SprintArtifact {
  path: string;
  content: string;
}

export interface SprintArtifacts {
  sprintId: string;
  path: string;
  artifacts: SprintArtifact[];
}

export interface SprintAcceptanceInput {
  approvedBy: string;
  summary: string;
  commit?: boolean;
  push?: boolean;
}

export interface SprintAcceptanceResult {
  sprintId: string;
  accepted: boolean;
  reportPath: string;
  logPath?: string;
  commit?: {
    created: boolean;
    hash?: string;
    message?: string;
  };
  push?: {
    pushed: boolean;
    message?: string;
  };
}

export interface GitStatusSummary {
  isRepo: boolean;
  currentBranch?: string;
  clean: boolean;
  changedFiles: string[];
}

export interface GitHubConfigStatus {
  configured: boolean;
  reason?: string;
}
