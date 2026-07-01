/**
 * proposalTypes.ts
 *
 * Type definitions for the AI Proposal Factory.
 * Covers the full lifecycle: intake → workflow → sections → quality → export.
 */

// ─── Proposal Intake (Extended from IntakeInput) ──────────────────────────────

export interface ProposalIntake {
  // Project Information
  projectName: string;
  organization: string;
  country: string;
  industry: string;
  fundingType: string;
  rootPath?: string;
  gitUrl?: string;

  // Executive Overview
  productSummary: string;
  vision: string;
  mission: string;
  strategicObjectives: string[];

  // Business Analysis
  businessProblem: string;
  currentWorkflow: string;
  desiredWorkflow: string;
  rootCauses: string[];
  opportunityStatement: string;

  // Stakeholders
  targetUsers: string[];
  primaryStakeholders: string[];
  secondaryStakeholders: string[];
  sponsors: string[];
  partners: string[];

  // Market Analysis
  marketSize: string;
  competitors: string[];
  competitiveAdvantage: string;
  valueProposition: string;

  // Technical Architecture
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  systemArchitecture: string;
  technologyStack: string[];
  securityRequirements: string[];
  scalabilityPlan?: string;

  // Implementation
  phases: ProposalPhase[];
  milestones: ProposalMilestone[];
  deliverables: string[];
  mvpDefinition: string;
  toolsAndIntegrations: string[];

  // Financial
  budgetTotal: string;
  budget?: string;
  budgetLineItems: BudgetLineItem[];
  fundingRequested: string;
  revenueModel: string;
  roiProjection: string;
  sustainabilityPlan?: string;

  // Governance
  teamStructure: string[];
  decisionMaking?: string;
  communicationPlan?: string;

  // Risk
  knownRisks: ProposalRisk[];
  assumptions: string[];
  constraints: string[];
  dependencies: string[];

  // Monitoring & Evaluation
  kpis: ProposalKPI[];
  successCriteria: string[];
  monitoringPlan: string;
  evaluationFramework: string;

  // Compliance
  legalRequirements: string[];
  privacyRequirements: string[];
  securityCompliance: string[];
  regulatoryRequirements: string[];

  // Environmental & Social
  esgStatement: string;
  inclusionStrategy?: string;
  environmentalSustainability?: string;

  // Future
  expansionStrategy?: string;
  exitStrategy?: string;
  skillsUrl?: string[];
  knowledgeUrl?: string[];
}

export interface ProposalPhase {
  name: string;
  description: string;
  duration: string;
  deliverables: string[];
}

export interface ProposalMilestone {
  name: string;
  date: string;
  deliverable: string;
  criteria: string;
}

export interface BudgetLineItem {
  category: string;
  item: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  deliverable: string;
  justification: string;
}

export interface ProposalRisk {
  id: string;
  description: string;
  category: string;
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  severity: number; // 1-9
  mitigation: string;
  owner: string;
  status: "open" | "mitigated" | "accepted";
}

export interface ProposalKPI {
  name: string;
  description: string;
  baseline: string;
  target: string;
  frequency: string;
  dataSource: string;
  responsible: string;
}

// ─── Workflow Step Results ─────────────────────────────────────────────────────

export type WorkflowStepName =
  | "validate_intake"
  | "find_missing"
  | "gap_analysis"
  | "business_validation"
  | "technical_validation"
  | "financial_validation"
  | "risk_analysis"
  | "stakeholder_analysis"
  | "implementation_planning"
  | "me_design"
  | "draft_proposal"
  | "quality_assurance"
  | "independent_review"
  | "revision"
  | "final_proposal";

export type StepStatus = "pending" | "running" | "completed" | "failed";

export interface WorkflowStepResult {
  step: number;
  name: WorkflowStepName;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  findings: StepFinding[];
  gaps: StepGap[];
  assumptions: StepAssumption[];
}

export interface StepFinding {
  severity: "info" | "warning" | "critical";
  field: string;
  message: string;
}

export interface StepGap {
  field: string;
  requiredFor: string;
  impact: string;
  recommendedValue: string;
  isAssumed: boolean;
}

export interface StepAssumption {
  field: string;
  assumedValue: string;
  rationale: string;
  riskIfWrong: string;
}

// ─── Proposal Sections ────────────────────────────────────────────────────────

export interface ProposalSection {
  id: string;
  title: string;
  order: number;
  content: string;
  completenessScore: number; // 0-100
  dataSources: string[];     // Which artifacts contributed
  assumptions: string[];     // Assumptions made for this section
}

// ─── Quality Assessment ───────────────────────────────────────────────────────

export type QualityDimensionName =
  | "strategic_alignment"
  | "completeness"
  | "business_case"
  | "technical_soundness"
  | "financial_credibility"
  | "risk_coverage"
  | "governance"
  | "sustainability"
  | "monitoring_evaluation"
  | "compliance"
  | "readability"
  | "persuasiveness"
  | "internal_consistency";

export interface QualityDimension {
  name: QualityDimensionName;
  label: string;
  score: number; // 0-10
  maxScore: 10;
  weakness?: string;
  revision?: string;
  /**
   * The concrete, auditable reasons this score was assigned — the intake field(s)
   * or assumption-register entries the rule inspected. Every non-perfect score
   * carries evidence so a "9.0/10 Verified" is never an unexplained assertion.
   */
  evidence?: string[];
  passedThreshold: boolean;
}

export interface QualityReport {
  dimensions: QualityDimension[];
  overallScore: number; // Average of all dimensions
  revisionCount: number;
  allPassed: boolean;
  threshold: number; // Target score (9)
  assessedAt: string;
}

// ─── Final Proposal Package ───────────────────────────────────────────────────

export type ProposalReadiness = "DRAFT" | "FINAL";

export interface ProposalPackage {
  metadata: ProposalMetadata;
  intake: ProposalIntake;
  workflowLog: WorkflowStepResult[];
  sections: ProposalSection[];
  quality: QualityReport;
  /**
   * Assumption Registry — every value Shiptec inferred rather than received.
   * Serialized into metadata.json so the ledger is durable across reads.
   */
  assumptions: Assumption[];
  /** Confidence gate result at generation time. */
  confidence: ExportGateResultSnapshot;
  fullMarkdown: string;
}

export interface ProposalMetadata {
  proposalId: string;
  projectId: string;
  projectName: string;
  version: number;
  generatedAt: string;
  generationDurationMs: number;
  /** DRAFT until the confidence gate reports no blocking assumptions. */
  readiness: ProposalReadiness;
}

/** Plain-data snapshot of the export gate, persisted with the package. */
export interface ExportGateResultSnapshot {
  status: "pass" | "blocked";
  readyForFinal: boolean;
  reasons: string[];
  blockingAssumptionIds: string[];
  summary: AssumptionSummary;
}

// Re-export the domain types so callers import from one place.
export type { Assumption, AssumptionSummary } from "./domain/assumptions.js";
import type { Assumption, AssumptionSummary } from "./domain/assumptions.js";

// ─── Persisted Record ─────────────────────────────────────────────────────────

export interface ProposalRecord {
  id: string;
  projectId: string;
  path: string;
  createdAt: string;
  /**
   * Quality score read from metadata.json. `null` when metadata is missing or
   * unreadable — never an invented value (the previous fallback fabricated 9.0).
   */
  overallScore: number | null;
  /** Proposal version read from metadata.json, or `null` when unknown. */
  version: number | null;
  /** Section count read from metadata.json, or `null` when unknown. */
  sectionCount: number | null;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ProposalExportFormat =
  | "pdf"
  | "docx"
  | "xlsx"
  | "pptx"
  | "html"
  | "csv"
  | "rtf"
  | "odp"
  | "google-sheets";

export interface ExportOptions {
  brandColors?: string;
  typography?: string;
  includeAppendices?: boolean;
  googleCredentials?: GoogleCredentials;
  shareWith?: string[]; // email addresses for Google Sheets
  /**
   * Explicit opt-in to export a DRAFT proposal despite unresolved blocking
   * assumptions. The Confidence Gate blocks FINAL/funder export by default;
   * this flag acknowledges "I know this is a draft". Never set silently.
   */
  force?: boolean;
}

export interface GoogleCredentials {
  type: "service_account" | "oauth2";
  keyFilePath?: string;
  accessToken?: string;
}

export interface ExportResult {
  format: ProposalExportFormat;
  filename: string;
  mimeType: string;
  buffer?: Buffer;
  content?: string;  // For HTML/RTF text formats
  url?: string;      // For Google Sheets
  size: number;
  exportedAt: string;
}

// ─── Section Registry ─────────────────────────────────────────────────────────

export const PROPOSAL_SECTIONS = [
  "cover_page",
  "executive_summary",
  "table_of_contents",
  "background",
  "problem_statement",
  "needs_assessment",
  "opportunity_analysis",
  "project_justification",
  "strategic_alignment",
  "smart_objectives",
  "scope",
  "solution_overview",
  "technical_architecture",
  "requirements",
  "implementation_methodology",
  "work_breakdown_structure",
  "timeline_milestones",
  "governance_structure",
  "stakeholder_engagement",
  "staffing_capacity",
  "budget_narrative",
  "detailed_budget",
  "cost_benefit_analysis",
  "procurement_plan",
  "risk_register",
  "quality_assurance",
  "monitoring_evaluation",
  "sustainability_plan",
  "scalability_roadmap",
  "communication_plan",
  "change_management",
  "training_plan",
  "operations_maintenance",
  "environmental_social_impact",
  "legal_compliance",
  "expected_outcomes",
  "success_metrics",
  "return_on_investment",
  "conclusion",
  "appendices"
] as const;

export type ProposalSectionId = typeof PROPOSAL_SECTIONS[number];

export const QUALITY_DIMENSIONS: { name: QualityDimensionName; label: string }[] = [
  { name: "strategic_alignment", label: "Strategic Alignment" },
  { name: "completeness", label: "Completeness" },
  { name: "business_case", label: "Business Case" },
  { name: "technical_soundness", label: "Technical Soundness" },
  { name: "financial_credibility", label: "Financial Credibility" },
  { name: "risk_coverage", label: "Risk Coverage" },
  { name: "governance", label: "Governance" },
  { name: "sustainability", label: "Sustainability" },
  { name: "monitoring_evaluation", label: "Monitoring & Evaluation" },
  { name: "compliance", label: "Compliance" },
  { name: "readability", label: "Readability" },
  { name: "persuasiveness", label: "Persuasiveness" },
  { name: "internal_consistency", label: "Internal Consistency" }
];
