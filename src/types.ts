export type ValidationStatus = "pass" | "warning" | "fail";

export type ProjectLifecycleStatus = "fresh" | "initialized" | "in_progress" | "handed_over";

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
  gitUrl?: string;
  skillsUrl?: string;
  knowledgeUrl?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  intake: IntakeInput;
  createdAt: string;
  /** Lifecycle state of the project. Defaults to 'initialized' for legacy records. */
  status?: ProjectLifecycleStatus;
  /** ISO timestamp of the last status change. */
  statusUpdatedAt?: string;
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
  authStatus: "pending" | "authorized" | "rejected";
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

export interface FolderTreeNode {
  name: string;
  type: "file" | "directory";
  relativePath: string;
  size?: number;
  children?: FolderTreeNode[];
}

export type ExportFormat = "zip" | "folder";

export type TargetEditor = "antigravity" | "opencode" | "codex" | "claudecode" | "cursor";

export interface HandoffExportResult {
  format: ExportFormat;
  editor: TargetEditor;
  filesIncluded: string[];
  destinationPath?: string;
}
