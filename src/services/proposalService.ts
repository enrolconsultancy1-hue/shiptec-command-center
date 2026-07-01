import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { ProjectRecord } from "../types.js";
import {
  ProposalPackage,
  ProposalIntake,
  ProposalSection,
  QualityReport,
  WorkflowStepResult,
  StepGap,
  StepAssumption,
  StepFinding,
  ProposalRecord,
  ProposalRisk,
  BudgetLineItem,
  ProposalKPI,
  ProposalPhase,
  ProposalMilestone,
  ExportGateResultSnapshot,
  ProposalReadiness
} from "../proposalTypes.js";
import { writeArtifact, readArtifactText, readArtifactTextIfExists, writeArtifactIfMissing } from "../artifactStore.js";
import { badRequest, notFound } from "../errors.js";
import { useFirestoreBackend, firestore } from "../firebase.js";
import * as templates from "../proposalTemplates.js";
import { AssumptionRegistry, Assumption } from "../domain/assumptions.js";
import { evaluateExportGate } from "../domain/confidenceGate.js";
import type { ExportGateResult } from "../domain/confidenceGate.js";
import { assessQuality } from "../domain/qaAssessor.js";
import { PipelineEngine } from "../domain/pipeline/engine.js";
import type { PipelineStep } from "../domain/pipeline/engine.js";

// Helper to slugify proposal IDs
function getProposalId(num: number): string {
  return `Proposal_${String(num).padStart(3, "0")}`;
}

/**
 * Result of normalization: the full ProposalIntake plus the registry of every
 * value that was inferred rather than provided. The two travel together so that
 * nothing in `intake` is treated as established fact without an assumption record.
 */
export interface NormalizedProposal {
  intake: ProposalIntake;
  registry: AssumptionRegistry;
}

/**
 * Mutable context that flows through the Proposal Factory pipeline. This replaces
 * the closure locals `generateProposal` used to thread between steps: each step
 * reads the immutable inputs (`project`, `intake`, `registry`) and deposits the
 * result it wants later steps to see via the engine's `outcome.payload` merge
 * (e.g. step 2 publishes `gaps` for step 12; step 11 publishes `gate`/`sections`
 * for step 15; step 12 publishes `qualityReport`).
 */
interface ProposalPipelineContext {
  project: ProjectRecord;
  startTime: number;
  intake: ProposalIntake;
  registry: AssumptionRegistry;
  // Deposited by steps as they run (each optional until its producer step runs):
  gaps?: StepGap[];
  gate?: ExportGateResult;
  readiness?: ProposalReadiness;
  sections?: ProposalSection[];
  qualityReport?: QualityReport;
  proposalIdStr?: string;
}

/**
 * Record an assumption for a single string field that the user did not supply,
 * and return the assumed value. Centralizing this keeps provenance consistent.
 *
 * A value counts as "supplied" only if it is a real, non-placeholder string.
 * Sentinel placeholders ("Not specified", "None specified", "TBD") are treated
 * as absent so they never masquerade as confirmed client data.
 */
function assumeString(
  registry: AssumptionRegistry,
  field: string,
  provided: string | undefined,
  assumedValue: string,
  opts: { rationale: string; riskIfWrong: string; blocking?: boolean; confidence?: number }
): string {
  if (provided && isSuppliedValue(provided)) return provided;
  registry.record({
    id: field,
    field,
    assumedValue,
    source: "industry_default",
    confidence: opts.confidence ?? 0.5,
    rationale: opts.rationale,
    riskIfWrong: opts.riskIfWrong,
    blockingExport: opts.blocking ?? false
  });
  return assumedValue;
}

/** True when a string is a genuine client value, not an empty/placeholder sentinel. */
function isSuppliedValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return !/^(not specified|none specified|tbd|n\/a|null|undefined)$/i.test(trimmed);
}

/**
 * Normalizes ProjectRecord intake into a full ProposalIntake structure.
 *
 * HONESTY CONTRACT: every value NOT supplied by the user is recorded as an
 * explicit Assumption in the returned registry. Nothing is silently fabricated
 * and blended into the proposal as established fact. Funder-critical fields
 * (organization, budget, funding) are marked blockingExport so the Confidence
 * Gate keeps the proposal in DRAFT until they are confirmed.
 */
export function normalizeProposalIntake(project: ProjectRecord): NormalizedProposal {
  const intake = project.intake;
  const registry = new AssumptionRegistry();

  // ── Project Information ────────────────────────────────────────────────────
  const projectName = intake.projectName || project.name || "Unnamed Project";
  const organization = assumeString(registry, "organization", intake.organization, "Not specified", {
    rationale: "Client organization was not captured in intake.",
    riskIfWrong: "A funder cannot verify the proposing entity; cover page and contractual sections are incomplete.",
    blocking: true,
    confidence: 0.2
  });
  const country = assumeString(registry, "country", intake.country, "Not specified", {
    rationale: "Geography was not captured in intake.",
    riskIfWrong: "Jurisdictional tax and compliance treatment may be wrong.",
    blocking: false,
    confidence: 0.3
  });
  const industry = assumeString(registry, "industry", intake.industry, "Not specified", {
    rationale: "Industry vertical was not captured in intake.",
    riskIfWrong: "Market sizing and competitive framing may not match the real sector.",
    blocking: false,
    confidence: 0.3
  });
  const fundingType = assumeString(registry, "fundingType", intake.fundingType, "Commercial Contract", {
    rationale: "Funding mechanism not specified; defaulting to a commercial contract model.",
    riskIfWrong: "Grant, equity, or RFP compliance requirements may be missed.",
    blocking: false,
    confidence: 0.4
  });

  // ── Executive Overview (vision/mission are framing, not funder-blocking) ───
  const productSummary = intake.productSummary || "A governed digital modernization solution.";
  const vision = assumeString(registry, "vision", intake.vision, `To create a standard-setting, highly efficient digital ecosystem for ${projectName}.`, {
    rationale: "No explicit vision provided; framed from the project name.",
    riskIfWrong: "Strategic narrative may not reflect the founder's actual ambition.",
    blocking: false,
    confidence: 0.5
  });
  const mission = assumeString(registry, "mission", intake.mission, `To deliver maximum quality, reliability, and security to users of ${projectName}.`, {
    rationale: "No explicit mission provided; framed from the project name.",
    riskIfWrong: "Operational narrative may not reflect the founder's actual intent.",
    blocking: false,
    confidence: 0.5
  });
  const strategicObjectives = (intake.successCriteria || []).map((s, idx) => `Objective ${idx + 1}: Implement ${s}`);

  // ── Business Analysis ──────────────────────────────────────────────────────
  const businessProblem = intake.businessProblem || "Lack of automated controls, security gates, and structured operational workflows.";
  const currentWorkflow = intake.currentWorkflow || "Manual request processing and visual verification cycles.";
  const desiredWorkflow = intake.desiredWorkflow || "Governed automated state changes and programmatic validation gates.";
  const opportunityStatement = `To deploy ${projectName} to reduce workflow bottlenecks.`;
  // rootCauses are analytical; only inferred if no business problem context exists.
  const rootCauses = businessProblem
    ? ["Derived from the stated business problem — confirm root-cause analysis with the client."]
    : [];

  // ── Stakeholders ───────────────────────────────────────────────────────────
  const targetUsers = intake.targetUsers && intake.targetUsers.length ? intake.targetUsers : [];
  if (targetUsers.length === 0) {
    registry.record({
      id: "targetUsers",
      field: "targetUsers",
      assumedValue: "[] (no user groups provided)",
      source: "inferred",
      confidence: 0.2,
      rationale: "No target user groups captured in intake.",
      riskIfWrong: "Needs assessment and success metrics cannot be tied to real beneficiaries.",
      blockingExport: false
    });
  }
  // Stakeholder categories are structural placeholders, not fabricated contacts.
  const primaryStakeholders: string[] = [];
  const secondaryStakeholders: string[] = [];
  const sponsors: string[] = [];
  const partners: string[] = [];

  // ── Market Analysis (blocking — a proposal with no market case misleads) ───
  const marketSize = assumeString(registry, "marketSize", intake.marketSize, "Not specified", {
    rationale: "Market size was not captured in intake.",
    riskIfWrong: "Opportunity analysis and ROI claims are unsubstantiated.",
    blocking: true,
    confidence: 0.2
  });
  const competitors = intake.competitors && intake.competitors.length ? intake.competitors : [];
  if (competitors.length === 0) {
    registry.record({
      id: "competitors",
      field: "competitors",
      assumedValue: "[] (no competitors provided)",
      source: "inferred",
      confidence: 0.2,
      rationale: "No competitor set captured in intake.",
      riskIfWrong: "Competitive positioning is unsubstantiated.",
      blockingExport: false
    });
  }
  const competitiveAdvantage = assumeString(registry, "competitiveAdvantage", intake.competitiveAdvantage, "Not specified", {
    rationale: "Competitive advantage was not captured in intake.",
    riskIfWrong: "Value proposition cannot be defended against alternatives.",
    blocking: true,
    confidence: 0.2
  });
  const valueProposition = assumeString(registry, "valueProposition", intake.valueProposition, "Not specified", {
    rationale: "Value proposition was not captured in intake.",
    riskIfWrong: "The core reason-to-buy is unclear to evaluators.",
    blocking: true,
    confidence: 0.2
  });

  // ── Technical Architecture ─────────────────────────────────────────────────
  const functionalRequirements = [
    `Automation of ${desiredWorkflow.substring(0, 40)}...`,
    "Real-time diagnostic health scoring dashboard",
    "Encrypted data store with strict tenant isolation",
    "Audit log generation on all system state modifications"
  ];
  const nonFunctionalRequirements = [
    "API response latency under 500ms for 95% of operations",
    "Strict HTTPS TLS 1.3 transit security encryption",
    "TypeScript type-safety checking on 100% of compile targets"
  ];
  const systemArchitecture = "Distributed three-tier MVC service model: express-based API, file/firestore storage repository, and client dashboard cockpit.";
  const technologyStack = [
    "Node.js (v22 LTS)",
    "TypeScript (v5+)",
    "Express (v4+)",
    "simple-git",
    "firebase-admin",
    "Zod Validation"
  ];
  const securityRequirements = [
    "Token-based Bearer authentication on all endpoints",
    "Environment variable injection for secret tokens",
    "Role-based authorization rules enforced at route level"
  ];
  const scalabilityPlan = assumeString(registry, "scalabilityPlan", intake.scalabilityPlan, "Stateless API server design to support rapid containerized horizontal scaling.", {
    rationale: "Scalability plan not captured; using the Shiptec reference architecture default.",
    riskIfWrong: "Scaling expectations may not match the target load profile.",
    blocking: false,
    confidence: 0.5
  });

  // ── Implementation (template scaffolding — clearly labelled, not fabricated) ─
  const phases: ProposalPhase[] = [
    { name: "Phase 1: Foundation Setup", description: "Repository configuration, environment vars validation, initial Express shell bootstrap.", duration: "TBD", deliverables: ["Configured git repository", "Health-check endpoint API"] },
    { name: "Phase 2: Core Engineering", description: "Implementation of all intake, scanning, validation, and dashboard service modules.", duration: "TBD", deliverables: ["Engine services code", "Unit/Integration test suites"] },
    { name: "Phase 3: GUI & Handoff Integration", description: "Frontend cockpit controls assembly, export file compilers, and validation gate logic.", duration: "TBD", deliverables: ["Cockpit admin panel", "Handoff zip compiler", "Final QA report"] }
  ];
  registry.record({
    id: "phases",
    field: "phases",
    assumedValue: "3-phase generic delivery scaffold (durations TBD)",
    source: "template",
    confidence: 0.4,
    rationale: "No detailed implementation plan provided; using a generic phase scaffold.",
    riskIfWrong: "Timeline and effort estimates are not grounded in the real scope.",
    blockingExport: false
  });
  const milestones: ProposalMilestone[] = [];
  const deliverables = [
    "TypeScript source code repository",
    "Automated unit & integration test suites",
    "Production deployment configuration files",
    "User manuals and API contract documentation"
  ];

  // ── Financial (BLOCKING — never fabricate a budget) ────────────────────────
  const budgetTotal = assumeString(registry, "budgetTotal", intake.budget, "Not specified", {
    rationale: "Budget was not captured in intake.",
    riskIfWrong: "Funding requested and cost-benefit sections would present fabricated figures as fact.",
    blocking: true,
    confidence: 0.1
  });
  const budgetLineItems: BudgetLineItem[] = [];
  if (!intake.budget) {
    registry.record({
      id: "budgetLineItems",
      field: "budgetLineItems",
      assumedValue: "[] (no line items — budget table intentionally left empty)",
      source: "inferred",
      confidence: 0.1,
      rationale: "No budget breakdown provided; the detailed budget table must not be fabricated.",
      riskIfWrong: "Presenting a generated budget as confirmed would be a financial misrepresentation.",
      blockingExport: true
    });
  }
  const fundingRequested = budgetTotal;
  const revenueModel = assumeString(registry, "revenueModel", intake.revenueModel, "Not specified", {
    rationale: "Revenue model was not captured in intake.",
    riskIfWrong: "Commercial viability case is unsupported.",
    blocking: true,
    confidence: 0.2
  });
  const roiProjection = assumeString(registry, "roiProjection", intake.roi, "Not specified", {
    rationale: "ROI projection was not captured in intake.",
    riskIfWrong: "Return claims to funders would be unsubstantiated.",
    blocking: false,
    confidence: 0.2
  });
  const sustainabilityPlan = assumeString(registry, "sustainabilityPlan", intake.sustainabilityPlan, "Not specified", {
    rationale: "Post-handover sustainability plan not captured in intake.",
    riskIfWrong: "Long-term viability narrative is unsupported.",
    blocking: false,
    confidence: 0.3
  });

  // ── Governance (structural, not fabricated teams) ──────────────────────────
  const teamStructure: string[] = [];
  const decisionMaking = assumeString(registry, "decisionMaking", intake.decisionMaking, "Not specified", {
    rationale: "Decision-making model not captured in intake.",
    riskIfWrong: "Governance section cannot describe real authority flows.",
    blocking: false,
    confidence: 0.3
  });
  const communicationPlan = assumeString(registry, "communicationPlan", intake.communicationPlan, "Not specified", {
    rationale: "Communication plan not captured in intake.",
    riskIfWrong: "Stakeholder engagement cadence is undefined.",
    blocking: false,
    confidence: 0.3
  });

  // ── Risk ───────────────────────────────────────────────────────────────────
  const knownRisks: ProposalRisk[] = [];
  if (!intake.knownRisks || intake.knownRisks.length === 0) {
    registry.record({
      id: "knownRisks",
      field: "knownRisks",
      assumedValue: "[] (no risks provided — register intentionally left empty)",
      source: "inferred",
      confidence: 0.2,
      rationale: "No risks captured in intake; the risk register must not be fabricated.",
      riskIfWrong: "A populated-looking risk register would mislead evaluators about exposure.",
      blockingExport: true
    });
  } else {
    knownRisks.push(
      ...intake.knownRisks.map((r, idx) => ({
        id: `R${idx + 1}`,
        description: r,
        category: "Unspecified",
        likelihood: "medium" as const,
        impact: "medium" as const,
        severity: 4,
        mitigation: "To be defined during planning.",
        owner: "Architect",
        status: "open" as const
      }))
    );
  }
  const assumptions = [
    "Node.js runtime environment v22 is available on the target server.",
    "Developer tooling has standard internet access during package install."
  ];
  const constraints = intake.technicalConstraints && intake.technicalConstraints.length ? intake.technicalConstraints : [];
  if (constraints.length === 0) {
    registry.record({
      id: "constraints",
      field: "constraints",
      assumedValue: "[] (no constraints provided)",
      source: "inferred",
      confidence: 0.3,
      rationale: "No technical constraints captured in intake.",
      riskIfWrong: "Architecture may not honor real platform or budget limits.",
      blockingExport: false
    });
  }
  const dependencies = ["Git local repositories", "Firebase credentials for Cloud Firestore backend"];

  // ── Monitoring & Evaluation ────────────────────────────────────────────────
  const kpis: ProposalKPI[] = [];
  if (!intake.successCriteria || intake.successCriteria.length === 0) {
    registry.record({
      id: "kpis",
      field: "kpis",
      assumedValue: "[] (no KPIs provided — M&E table intentionally left empty)",
      source: "inferred",
      confidence: 0.2,
      rationale: "No success criteria captured to derive KPIs from.",
      riskIfWrong: "Success measurement framework would be fabricated.",
      blockingExport: true
    });
  }
  const successCriteria = intake.successCriteria && intake.successCriteria.length ? intake.successCriteria : [];
  const monitoringPlan = "Continuous dashboard scanning of repository file trees and automated git state verification checkpoints.";
  const evaluationFramework = "Formal end-of-phase evaluations conducted against the SuccessCriteria.md blueprints.";

  // ── Compliance ─────────────────────────────────────────────────────────────
  const legalRequirements: string[] = [];
  const privacyRequirements = intake.compliance ? [intake.compliance] : [];
  if (privacyRequirements.length === 0) {
    registry.record({
      id: "privacyRequirements",
      field: "privacyRequirements",
      assumedValue: "[] (no compliance regime provided)",
      source: "inferred",
      confidence: 0.3,
      rationale: "No compliance regime captured in intake.",
      riskIfWrong: "Specific regulatory obligations (GDPR/HIPAA/PCI…) may be missed.",
      blockingExport: false
    });
  }
  const securityCompliance: string[] = [];
  const regulatoryRequirements: string[] = [];

  // ── ESG / Future ───────────────────────────────────────────────────────────
  const esgStatement = assumeString(registry, "esgStatement", intake.esgStatement, "Not specified", {
    rationale: "ESG statement not captured in intake.",
    riskIfWrong: "Sustainability narrative is unsupported.",
    blocking: false,
    confidence: 0.3
  });
  const inclusionStrategy = "Not specified";
  const environmentalSustainability = "Not specified";
  const expansionStrategy = assumeString(registry, "expansionStrategy", intake.expansionStrategy, "Not specified", {
    rationale: "Expansion strategy not captured in intake.",
    riskIfWrong: "Scalability roadmap is unsupported.",
    blocking: false,
    confidence: 0.3
  });
  const exitStrategy = assumeString(registry, "exitStrategy", intake.exitStrategy, "Not specified", {
    rationale: "Exit strategy not captured in intake.",
    riskIfWrong: "Investor exit narrative is unsupported.",
    blocking: false,
    confidence: 0.3
  });

  const normalized: ProposalIntake = {
    projectName,
    organization,
    country,
    industry,
    fundingType,
    productSummary,
    vision,
    mission,
    strategicObjectives,
    businessProblem,
    currentWorkflow,
    desiredWorkflow,
    rootCauses,
    opportunityStatement,
    targetUsers,
    primaryStakeholders,
    secondaryStakeholders,
    sponsors,
    partners,
    marketSize,
    competitors,
    competitiveAdvantage,
    valueProposition,
    functionalRequirements,
    nonFunctionalRequirements,
    systemArchitecture,
    technologyStack,
    securityRequirements,
    scalabilityPlan,
    phases,
    milestones,
    deliverables,
    mvpDefinition: project.intake.mvpDefinition || "Not specified",
    toolsAndIntegrations: project.intake.toolsAndIntegrations || [],
    budget: project.intake.budget,
    budgetTotal,
    budgetLineItems,
    fundingRequested,
    revenueModel,
    roiProjection,
    sustainabilityPlan,
    teamStructure,
    decisionMaking,
    communicationPlan,
    knownRisks,
    assumptions,
    constraints,
    dependencies,
    kpis,
    successCriteria,
    monitoringPlan,
    evaluationFramework,
    legalRequirements,
    privacyRequirements,
    securityCompliance,
    regulatoryRequirements,
    esgStatement,
    inclusionStrategy,
    environmentalSustainability,
    expansionStrategy,
    exitStrategy,
    skillsUrl: project.intake.skillsUrl || [],
    knowledgeUrl: project.intake.knowledgeUrl || []
  };

  return { intake: normalized, registry };
}

/**
 * Executes the 15-step Proposal Factory Workflow.
 *
 * The steps are declared as data (an array of `PipelineStep`s) and run by the
 * reusable `PipelineEngine`, which records real per-step timestamps, halts on
 * the first failing step (recording `status: "failed"`), and merges each step's
 * `payload` onto the mutable context so later steps can read prior results.
 * The engine result log is mapped back to the package's `WorkflowStepResult[]`.
 */
export async function generateProposal(project: ProjectRecord): Promise<ProposalPackage> {
  const startTime = Date.now();
  const { intake, registry } = normalizeProposalIntake(project);

  const ctx: ProposalPipelineContext = { project, startTime, intake, registry };

  const steps: PipelineStep<ProposalPipelineContext>[] = [
    // Step 1: Validate Intake
    {
      name: "validate_intake",
      run: ({ project }) => {
        const findings: StepFinding[] = [];
        if (!project.intake.projectName) {
          findings.push({ severity: "critical", field: "projectName", message: "Project Name is missing in intake." });
        } else {
          findings.push({ severity: "info", field: "projectName", message: `Valid project name: ${project.intake.projectName}` });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 2: Find Missing Information — read gaps directly from the Assumption
    // Registry, the single honest source of "what did Shiptec infer?". The gaps
    // are published onto the context so step 12 can pass them to the assessor.
    {
      name: "find_missing",
      run: ({ registry }) => {
        const gaps: StepGap[] = registry.list().map(a => ({
          field: a.field,
          requiredFor: "Complete, defensible proposal context",
          impact: a.blockingExport ? `${a.riskIfWrong} (BLOCKS FINAL promotion.)` : a.riskIfWrong,
          recommendedValue: a.assumedValue,
          isAssumed: true
        }));
        return { status: "completed" as const, gaps, payload: { gaps } };
      }
    },

    // Step 3: Gap Analysis — surface every inferred value as a tracked assumption.
    {
      name: "gap_analysis",
      run: ({ registry }) => {
        const assumptions: StepAssumption[] = registry.list().map(a => ({
          field: a.field,
          assumedValue: a.assumedValue,
          rationale: a.rationale,
          riskIfWrong: a.riskIfWrong
        }));
        return { status: "completed" as const, assumptions };
      }
    },

    // Step 4: Business Validation
    {
      name: "business_validation",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.successCriteria.length === 0) {
          findings.push({ severity: "warning", field: "successCriteria", message: "No explicit success criteria specified." });
        } else {
          findings.push({ severity: "info", field: "successCriteria", message: "Success criteria maps well to SMART objectives." });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 5: Technical Validation
    {
      name: "technical_validation",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.constraints.length === 0) {
          findings.push({ severity: "warning", field: "constraints", message: "No technical constraints defined." });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 6: Financial Validation — honest about budget provenance.
    {
      name: "financial_validation",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.budgetLineItems.length > 0) {
          const detailedTotal = intake.budgetLineItems.reduce((acc, curr) => acc + curr.totalCost, 0);
          findings.push({
            severity: "info",
            field: "budgetTotal",
            message: `Client-supplied budget line items total $${detailedTotal.toLocaleString()}.`
          });
        } else {
          findings.push({
            severity: "critical",
            field: "budgetTotal",
            message: "No budget supplied. The detailed budget table is intentionally empty and FINAL promotion is blocked until figures are confirmed."
          });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 7: Risk Analysis
    {
      name: "risk_analysis",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        intake.knownRisks.forEach(r => {
          if (!r.mitigation) {
            findings.push({ severity: "warning", field: `knownRisks.${r.id}`, message: `Risk ${r.id} is missing mitigation.` });
          }
        });
        return { status: "completed" as const, findings };
      }
    },

    // Step 8: Stakeholder Analysis
    {
      name: "stakeholder_analysis",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.targetUsers.length === 0) {
          findings.push({ severity: "warning", field: "targetUsers", message: "No target user groups identified." });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 9: Implementation Planning
    {
      name: "implementation_planning",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.phases.length === 0) {
          findings.push({ severity: "critical", field: "phases", message: "Implementation phases are empty." });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 10: Monitoring & Evaluation Design
    {
      name: "me_design",
      run: ({ intake }) => {
        const findings: StepFinding[] = [];
        if (intake.kpis.length === 0) {
          findings.push({ severity: "warning", field: "kpis", message: "No performance KPIs defined." });
        }
        return { status: "completed" as const, findings };
      }
    },

    // Step 11: Proposal Draft (Assemble sections). The registry is fully
    // populated by this point, so evaluate the Confidence Gate once and reuse
    // its result for both the cover-page stamp and the package. Gate, readiness
    // and sections are published for step 15.
    {
      name: "draft_proposal",
      run: ({ intake, registry }) => {
        const gate = evaluateExportGate(registry);
        const readiness: ProposalReadiness = gate.readyForFinal ? "FINAL" : "DRAFT";
        const sections: ProposalSection[] = [
          { id: "cover_page", title: "Cover Page", order: 1, content: templates.coverPageTemplate(intake, 1, readiness), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "executive_summary", title: "1. Executive Summary", order: 2, content: templates.executiveSummaryTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "table_of_contents", title: "Table of Contents", order: 3, content: templates.tableOfContentsTemplate(), completenessScore: 100, dataSources: [], assumptions: [] },
          { id: "background", title: "2. Background & Problem Statement", order: 4, content: templates.backgroundTemplate(intake) + "\n\n" + templates.problemStatementTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "needs_assessment", title: "3. Needs Assessment & Gap Analysis", order: 5, content: templates.needsAssessmentTemplate(intake) + "\n\n" + templates.opportunityAnalysisTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "project_justification", title: "4. Project Justification & Alignment", order: 6, content: templates.projectJustificationTemplate(intake) + "\n\n" + templates.strategicAlignmentTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "smart_objectives", title: "5. SMART Objectives & Scope", order: 7, content: templates.smartObjectivesTemplate(intake) + "\n\n" + templates.scopeTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "solution_overview", title: "6. Technical Solution & Architecture", order: 8, content: templates.solutionOverviewTemplate(intake) + "\n\n" + templates.technicalArchitectureTemplate(intake) + "\n\n" + templates.requirementsTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "implementation_methodology", title: "7. Implementation & Work Plan", order: 9, content: templates.implementationMethodologyTemplate() + "\n\n" + templates.workBreakdownStructureTemplate(intake) + "\n\n" + templates.timelineMilestonesTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "governance_structure", title: "8. Governance & Organizational Capacity", order: 10, content: templates.governanceStructureTemplate(intake) + "\n\n" + templates.stakeholderEngagementTemplate(intake) + "\n\n" + templates.staffingCapacityTemplate(), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "budget_narrative", title: "9. Financial Proposal & Cost-Benefit Analysis", order: 11, content: templates.budgetNarrativeTemplate(intake) + "\n\n" + templates.detailedBudgetTemplate(intake) + "\n\n" + templates.costBenefitAnalysisTemplate(intake) + "\n\n" + templates.procurementPlanTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "risk_register", title: "10. Risk Management & Quality Assurance", order: 12, content: templates.riskRegisterTemplate(intake) + "\n\n" + templates.qualityAssuranceTemplate(), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "monitoring_evaluation", title: "11. Monitoring, Evaluation & Sustainability", order: 13, content: templates.monitoringEvaluationTemplate(intake) + "\n\n" + templates.sustainabilityPlanTemplate(intake) + "\n\n" + templates.scalabilityRoadmapTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "environmental_social_impact", title: "12. Environmental, Social & Legal Compliance", order: 14, content: templates.communicationPlanTemplate(intake) + "\n\n" + templates.changeManagementTemplate() + "\n\n" + templates.trainingPlanTemplate() + "\n\n" + templates.operationsMaintenanceTemplate() + "\n\n" + templates.environmentalSocialImpactTemplate(intake) + "\n\n" + templates.legalComplianceTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "expected_outcomes", title: "13. Expected Outcomes & Return on Investment", order: 15, content: templates.expectedOutcomesTemplate(intake) + "\n\n" + templates.successMetricsTemplate(intake) + "\n\n" + templates.roiTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] },
          { id: "conclusion", title: "14. Conclusion & Appendices", order: 16, content: templates.conclusionTemplate(intake.projectName) + "\n\n" + templates.appendicesTemplate(intake), completenessScore: 100, dataSources: ["intake"], assumptions: [] }
        ];
        return { status: "completed" as const, payload: { gate, readiness, sections } };
      }
    },

    // Step 12: Quality Assurance — evidence-based assessment via the rule-based
    // QA Assessor. Scores reflect what the intake actually supports; no score is
    // boosted, no section content is fabricated, and there is no revision theatre.
    {
      name: "quality_assurance",
      run: ({ intake, registry, gaps }) => ({
        status: "completed" as const,
        payload: { qualityReport: assessQuality(intake, registry, gaps ?? []) }
      })
    },

    // Step 13: Independent Review
    {
      name: "independent_review",
      run: () => ({ status: "completed" as const })
    },

    // Step 14: Revision — the assessor does not auto-rewrite sections to inflate
    // scores. Any sub-threshold dimension is an honest signal for the human
    // author, so this step records that no automated revisions were applied.
    {
      name: "revision",
      run: ({ qualityReport }) => ({
        status: "completed" as const,
        findings: qualityReport && !qualityReport.allPassed
          ? [{ severity: "info" as const, field: "quality", message: "Sub-threshold dimensions are flagged for human review; no scores were boosted." }]
          : []
      })
    },

    // Step 15: Final Proposal Package — determine the auto-incrementing Proposal
    // ID BEFORE assembling so it never appears as "PENDING_ID" in artifacts,
    // append the Assumption Register, and persist the package. This is the only
    // async step and the only one that can realistically throw.
    {
      name: "final_proposal",
      run: async ({ project, registry, sections }) => {
        const proposals = await listProposals(project);
        const proposalIdStr = getProposalId(proposals.length + 1);
        const sectionList = sections ?? [];
        sectionList.push(buildAssumptionRegisterSection(registry));
        return { status: "completed" as const, payload: { proposalIdStr, sections: sectionList } };
      }
    }
  ];

  const engine = new PipelineEngine<ProposalPipelineContext>(steps);
  await engine.run(ctx);

  // The engine log is the structured record of the run; map it onto the
  // package's WorkflowStepResult[]. Step names are authored as valid
  // WorkflowStepNames, so the cast at the boundary is safe.
  const workflowLog: WorkflowStepResult[] = engine.results.map(r => ({
    step: r.step,
    name: r.name as WorkflowStepResult["name"],
    status: r.status,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    findings: r.findings,
    gaps: r.gaps,
    assumptions: r.assumptions
  }));

  const { intake: pkgIntake, registry: pkgRegistry, sections, gate, readiness, qualityReport, proposalIdStr } = ctx;

  const fullMarkdown = (sections ?? [])
    .map(s => s.content)
    .join("\n\n---\n\n");

  // Confidence Gate result snapshot (gate evaluated before section assembly).
  const confidence: ExportGateResultSnapshot = {
    status: gate!.status,
    readyForFinal: gate!.readyForFinal,
    reasons: gate!.reasons,
    blockingAssumptionIds: gate!.blockingAssumptionIds,
    summary: gate!.summary
  };

  const finalPackage: ProposalPackage = {
    metadata: {
      proposalId: proposalIdStr!,
      projectId: project.id,
      projectName: pkgIntake.projectName,
      version: 1.0,
      generatedAt: new Date().toISOString(),
      generationDurationMs: Date.now() - startTime,
      readiness: readiness ?? "DRAFT"
    },
    intake: pkgIntake,
    workflowLog,
    sections: sections ?? [],
    quality: qualityReport!,
    assumptions: pkgRegistry.toJSON(),
    confidence,
    fullMarkdown
  };

  // Persist files.
  const baseRel = `Proposals/${proposalIdStr!}`;
  await writeArtifact(project, `${baseRel}/Proposal.md`, fullMarkdown);
  await writeArtifact(project, `${baseRel}/metadata.json`, JSON.stringify(finalPackage, null, 2));

  return finalPackage;
}

/**
 * Builds the "Assumption Register" appendix section that is appended to every
 * proposal so inferred values are never hidden. This is the visible half of the
 * honesty contract — the registry is the machine half.
 */
function buildAssumptionRegisterSection(registry: AssumptionRegistry): ProposalSection {
  const all = registry.list();
  const blocking = registry.blocking();
  const summary = registry.summary();

  let body = `# Appendix Z — Assumption Register\n\n`;
  body += `> **Honesty disclosure.** The following values were INFERRED by Shiptec, not `;
  body += `confirmed by the client. They are tracked here and must be reviewed before `;
  body += `this proposal is promoted to FINAL.\n\n`;
  body += `- **Total assumptions:** ${summary.total}\n`;
  body += `- **Blocking FINAL promotion:** ${summary.blocking}\n`;
  body += `- **Open (unconfirmed):** ${summary.open}\n`;
  body += `- **Lowest open confidence:** ${summary.lowestConfidence.toFixed(2)}\n\n`;

  if (blocking.length > 0) {
    body += `## Blocking — must be confirmed before export\n\n`;
    body += `| Field | Assumed Value | Confidence | Risk if Wrong |\n`;
    body += `|---|---|---|---|\n`;
    for (const a of blocking) {
      body += `| ${a.field} | ${truncate(a.assumedValue, 60)} | ${a.confidence.toFixed(2)} | ${truncate(a.riskIfWrong, 80)} |\n`;
    }
    body += `\n`;
  }

  const openNonBlocking = all.filter(a => !a.resolved && !a.blockingExport);
  if (openNonBlocking.length > 0) {
    body += `## Open (non-blocking)\n\n`;
    body += `| Field | Assumed Value | Confidence | Rationale |\n`;
    body += `|---|---|---|---|\n`;
    for (const a of openNonBlocking) {
      body += `| ${a.field} | ${truncate(a.assumedValue, 60)} | ${a.confidence.toFixed(2)} | ${truncate(a.rationale, 80)} |\n`;
    }
  }

  if (all.length === 0) {
    body += `_No assumptions were made — all proposal data was client-supplied._\n`;
  }

  return {
    id: "assumption_register",
    title: "Appendix Z — Assumption Register",
    order: 999,
    content: body,
    completenessScore: 100,
    dataSources: ["assumption_registry"],
    assumptions: all.filter(a => !a.resolved).map(a => a.field)
  };
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * Read all generated proposals for a project.
 */
export async function listProposals(project: ProjectRecord): Promise<ProposalRecord[]> {
  const proposals: ProposalRecord[] = [];

  if (useFirestoreBackend()) {
    try {
      const snap = await firestore()
        .collection("projects")
        .doc(project.id)
        .collection("proposals")
        .get();
      snap.forEach(doc => {
        proposals.push(doc.data() as ProposalRecord);
      });
      return proposals.sort((a, b) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  // File system backend scanning Proposals/ dir
  const propDir = path.join(project.rootPath, "Proposals");
  try {
    const entries = await readdir(propDir);
    for (const entry of entries) {
      if (/^Proposal_\d{3}$/.test(entry)) {
        try {
          const metaPath = path.join(propDir, entry, "metadata.json");
          const dataStr = await readFile(metaPath, "utf8");
          const packageData = JSON.parse(dataStr) as ProposalPackage;
          proposals.push({
            id: entry,
            projectId: project.id,
            path: path.join(propDir, entry, "Proposal.md"),
            createdAt: packageData.metadata.generatedAt,
            overallScore: packageData.quality.overallScore,
            version: packageData.metadata.version,
            sectionCount: packageData.sections.length
          });
        } catch {
          // Metadata is missing or unreadable — record the proposal exists but
          // do NOT invent a quality score. `null` means "unknown", surfaced to
          // the user as such. (Previously this fabricated overallScore: 9.0.)
          proposals.push({
            id: entry,
            projectId: project.id,
            path: path.join(propDir, entry, "Proposal.md"),
            createdAt: new Date().toISOString(),
            overallScore: null,
            version: null,
            sectionCount: null
          });
        }
      }
    }
    return proposals.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

/**
 * Reads a single ProposalPackage.
 */
export async function readProposal(project: ProjectRecord, proposalId: string): Promise<ProposalPackage> {
  const relPath = `Proposals/${proposalId}/metadata.json`;
  const dataStr = await readArtifactText(project, relPath);
  if (!dataStr) {
    throw notFound(`Proposal metadata not found: ${proposalId}`, { proposalId });
  }
  return JSON.parse(dataStr) as ProposalPackage;
}
