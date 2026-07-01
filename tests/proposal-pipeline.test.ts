/**
 * Pipeline regression tests.
 *
 * `generateProposal` runs its 15-step workflow on the reusable `PipelineEngine`.
 * The honesty/API suites cover the OUTPUT `ProposalPackage`; these tests lock
 * the STRUCTURE of the run itself — the engine is now the source of the step
 * log, so a future change to the engine or the step array that silently drops,
 * reorders, or misnames a step is caught here.
 *
 * Uses a real temp project root because `generateProposal` persists artifacts.
 */
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateProposal, listProposals } from "../src/services/proposalService.js";
import type { ProjectRecord, IntakeInput } from "../src/types.js";
import type { WorkflowStepName } from "../src/proposalTypes.js";
import { INTAKE_DEFAULTS } from "../src/schemas/intakeSchema.js";

const buildOnlyIntake: IntakeInput = {
  ...INTAKE_DEFAULTS,
  projectName: "Pipeline Demo",
  productSummary: "A governed command center.",
  businessProblem: "Vibe coding produces drift.",
  targetUsers: ["Founder"],
  currentWorkflow: "Type ideas into a chat.",
  desiredWorkflow: "Ideas become validated plans.",
  toolsAndIntegrations: ["Git"],
  technicalConstraints: ["TypeScript"],
  successCriteria: ["Initialize folders"],
  mvpDefinition: "Init, validate, scan.",
  knownRisks: ["Token may be missing"],
  openQuestions: []
};

/** The 15 WorkflowStepNames in execution order — the contract the engine runs. */
const EXPECTED_STEPS: WorkflowStepName[] = [
  "validate_intake",
  "find_missing",
  "gap_analysis",
  "business_validation",
  "technical_validation",
  "financial_validation",
  "risk_analysis",
  "stakeholder_analysis",
  "implementation_planning",
  "me_design",
  "draft_proposal",
  "quality_assurance",
  "independent_review",
  "revision",
  "final_proposal"
];

/**
 * Runs a proposal in a fresh temp workspace. Returns the project (so callers can
 * call listProposals / readProposal) and the generated package.
 */
async function runProposal(): Promise<{ project: ProjectRecord; pkg: Awaited<ReturnType<typeof generateProposal>> }> {
  const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-pipeline-"));
  const project: ProjectRecord = {
    id: "pipeline-demo",
    name: buildOnlyIntake.projectName,
    rootPath: workspace,
    intake: buildOnlyIntake,
    createdAt: new Date().toISOString(),
    status: "initialized"
  };
  const pkg = await generateProposal(project);
  return { project, pkg };
}

describe("Proposal Factory pipeline (PipelineEngine)", () => {
  it("runs exactly the 15 canonical steps in order", async () => {
    const { pkg } = await runProposal();
    const names = pkg.workflowLog.map((s) => s.name);
    expect(names).toEqual(EXPECTED_STEPS);
    expect(pkg.workflowLog).toHaveLength(15);
  });

  it("numbers steps 1..15 consecutively", async () => {
    const { pkg } = await runProposal();
    expect(pkg.workflowLog.map((s) => s.step)).toEqual(
      EXPECTED_STEPS.map((_, i) => i + 1)
    );
  });

  it("marks every step completed (DRAFT intake produces no failures)", async () => {
    const { pkg } = await runProposal();
    expect(pkg.workflowLog.every((s) => s.status === "completed")).toBe(true);
  });

  it("records real timestamps with completedAt after startedAt", async () => {
    const { pkg } = await runProposal();
    for (const s of pkg.workflowLog) {
      expect(s.startedAt).toBeTruthy();
      expect(s.completedAt).toBeTruthy();
      expect(s.completedAt! >= s.startedAt).toBe(true);
    }
  });

  it("carries the gap list on the find_missing step and assumptions on gap_analysis", async () => {
    const { pkg } = await runProposal();
    // Build-only intake has no business data → gaps and assumptions are non-empty.
    expect(pkg.workflowLog[1].name).toBe("find_missing");
    expect(pkg.workflowLog[1].gaps.length).toBeGreaterThan(0);
    expect(pkg.workflowLog[2].name).toBe("gap_analysis");
    expect(pkg.workflowLog[2].assumptions.length).toBeGreaterThan(0);
  });

  it("surfaces the blocking budget finding on the financial_validation step", async () => {
    const { pkg } = await runProposal();
    const financial = pkg.workflowLog.find((s) => s.name === "financial_validation")!;
    expect(financial.findings.some((f) => f.severity === "critical" && f.field === "budgetTotal")).toBe(true);
  });
});

describe("listProposals honesty", () => {
  it("returns real scores from metadata.json", async () => {
    const { project, pkg } = await runProposal();
    const list = await listProposals(project);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("Proposal_001");
    expect(list[0].overallScore).toBe(pkg.quality.overallScore);
    expect(list[0].version).toBe(1);
    expect(list[0].sectionCount).toBe(pkg.sections.length);
  });

  it("returns null scores when metadata.json is missing, not fabricated 9.0", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-listprop-"));
    const project: ProjectRecord = {
      id: "listprop-demo",
      name: "ListProp Demo",
      rootPath: workspace,
      intake: buildOnlyIntake,
      createdAt: new Date().toISOString(),
      status: "initialized"
    };
    // Create a proposal directory structure with NO metadata.json — simulates
    // a corrupted or partial proposal folder.
    const propDir = path.join(workspace, "Proposals", "Proposal_001");
    await mkdir(propDir, { recursive: true });
    await writeFile(path.join(propDir, "Proposal.md"), "# stub");

    const list = await listProposals(project);
    expect(list).toHaveLength(1);
    // The record must exist (we can see the folder) but must NOT invent a
    // quality score. `null` means "unknown" — honest about missing data.
    expect(list[0].overallScore).toBeNull();
    expect(list[0].version).toBeNull();
    expect(list[0].sectionCount).toBeNull();
  });
});
