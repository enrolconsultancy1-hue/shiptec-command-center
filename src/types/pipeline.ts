export enum WorkflowStep {
  INTAKE_INIT = 1,
  PRODUCT_DEF = 2,
  SCAN = 3,
  VALIDATE = 4,
  ARCHITECT_PACK = 5,
  BUILDER_SPEC = 6,
  SPRINT_CREATE = 7,
  BUILDER_DRY_RUN = 8,
  DRY_RUN_VALIDATE = 9,
  PATTERN_RESEARCH = 10,
  BUILDER_EXECUTE = 11,
  ACCEPTANCE = 12,
  EXPORT_DELIVERY = 13
}

export type PipelineStepStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped';

export interface PipelineProgress {
  currentStep: WorkflowStep;
  stepStatuses: Record<WorkflowStep, PipelineStepStatus>;
}

export const WORKFLOW_STEP_NAMES: Record<WorkflowStep, string> = {
  [WorkflowStep.INTAKE_INIT]: "Intake & Project Initialization",
  [WorkflowStep.PRODUCT_DEF]: "Product & Business Definition",
  [WorkflowStep.SCAN]: "Project Health Scan",
  [WorkflowStep.VALIDATE]: "Intake & Project Validation",
  [WorkflowStep.ARCHITECT_PACK]: "Architect Pack Generation",
  [WorkflowStep.BUILDER_SPEC]: "Builder Specification",
  [WorkflowStep.SPRINT_CREATE]: "Sprint Creation",
  [WorkflowStep.BUILDER_DRY_RUN]: "Builder Dry Run Simulation",
  [WorkflowStep.DRY_RUN_VALIDATE]: "Dry Run Scope Validation",
  [WorkflowStep.PATTERN_RESEARCH]: "Pattern Research & Benchmarking",
  [WorkflowStep.BUILDER_EXECUTE]: "Builder Execution & Code Apply",
  [WorkflowStep.ACCEPTANCE]: "Sprint Acceptance & Governance",
  [WorkflowStep.EXPORT_DELIVERY]: "Handoff Export & Package Delivery"
};
