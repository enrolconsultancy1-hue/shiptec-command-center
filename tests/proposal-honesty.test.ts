/**
 * Proposal Honesty tests.
 *
 * These tests enforce SHIPTEC's prime directive ("NEVER guess. NEVER INVENT
 * REQUIREMENTS.") on the Proposal Factory:
 *   1. The Assumption Registry records every inferred value.
 *   2. The Confidence Gate blocks FINAL/export while funder-critical fields
 *      are still assumed.
 *   3. The "no-fabrication" invariant: no assumed value is ever blended into
 *      the proposal body as established fact — it is either client-supplied or
 *      surfaced in the Assumption Register appendix.
 */
import { describe, expect, it } from "vitest";
import { AssumptionRegistry } from "../src/domain/assumptions.js";
import { evaluateExportGate, readinessLabel } from "../src/domain/confidenceGate.js";
import { normalizeProposalIntake } from "../src/services/proposalService.js";
import type { ProjectRecord } from "../src/types.js";
import type { IntakeInput } from "../src/types.js";
import { INTAKE_DEFAULTS } from "../src/schemas/intakeSchema.js";

/** Minimal but complete build-side intake — has NO proposal/business data. */
const buildOnlyIntake: IntakeInput = {
  ...INTAKE_DEFAULTS,
  projectName: "Honesty Demo",
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

function projectWith(intake: IntakeInput): ProjectRecord {
  return {
    id: "honesty-demo",
    name: intake.projectName,
    rootPath: "/tmp/ignored", // normalization is pure; no FS access.
    intake,
    createdAt: new Date().toISOString(),
    status: "initialized"
  };
}

describe("Assumption Registry", () => {
  it("records an assumption and tracks it as open/blocking", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "budgetTotal",
      field: "budgetTotal",
      assumedValue: "$36,200",
      source: "industry_default",
      confidence: 0.1,
      rationale: "not provided",
      riskIfWrong: "financial misrepresentation",
      blockingExport: true
    });

    expect(registry.has("budgetTotal")).toBe(true);
    const summary = registry.summary();
    expect(summary.total).toBe(1);
    expect(summary.blocking).toBe(1);
    expect(summary.open).toBe(1);
    expect(summary.resolved).toBe(0);
  });

  it("keeps the stricter record when the same field is recorded twice", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "x", field: "x", assumedValue: "a", source: "industry_default",
      confidence: 0.8, rationale: "r", riskIfWrong: "rw", blockingExport: false
    });
    registry.record({
      id: "x", field: "x", assumedValue: "b", source: "industry_default",
      confidence: 0.3, rationale: "r2", riskIfWrong: "rw2", blockingExport: true
    });

    // Stricter (blocking + lower confidence) must win — never silently relax.
    expect(registry.blocking().length).toBe(1);
    expect(registry.summary().lowestConfidence).toBeCloseTo(0.3, 5);
  });

  it("resolves an assumption so it stops blocking", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "org", field: "organization", assumedValue: "ACME", source: "industry_default",
      confidence: 0.2, rationale: "r", riskIfWrong: "rw", blockingExport: true
    });

    expect(registry.blocking().length).toBe(1);
    expect(registry.resolve("org")).toBe(true);
    expect(registry.blocking().length).toBe(0);
    expect(registry.summary().resolved).toBe(1);
  });

  it("round-trips through toJSON / fromJSON", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "a", field: "a", assumedValue: "v", source: "inferred",
      confidence: 0.5, rationale: "r", riskIfWrong: "rw", blockingExport: false
    });
    const restored = AssumptionRegistry.fromJSON(registry.toJSON());

    expect(restored.list().length).toBe(1);
    expect(restored.has("a")).toBe(true);
  });
});

describe("Confidence Gate", () => {
  it("blocks when a blocking assumption is unresolved", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "budgetTotal", field: "budgetTotal", assumedValue: "$1", source: "industry_default",
      confidence: 0.1, rationale: "r", riskIfWrong: "rw", blockingExport: true
    });

    const gate = evaluateExportGate(registry);
    expect(gate.status).toBe("blocked");
    expect(gate.readyForFinal).toBe(false);
    expect(gate.blockingAssumptionIds).toContain("budgetTotal");
    expect(readinessLabel(registry)).toBe("DRAFT");
  });

  it("passes when all blocking assumptions are resolved", () => {
    const registry = new AssumptionRegistry();
    registry.record({
      id: "budgetTotal", field: "budgetTotal", assumedValue: "$1", source: "industry_default",
      confidence: 0.1, rationale: "r", riskIfWrong: "rw", blockingExport: true
    });
    registry.resolve("budgetTotal");

    const gate = evaluateExportGate(registry);
    expect(gate.status).toBe("pass");
    expect(gate.readyForFinal).toBe(true);
    expect(readinessLabel(registry)).toBe("FINAL");
  });

  it("passes with zero assumptions (fully client-supplied)", () => {
    const gate = evaluateExportGate(new AssumptionRegistry());
    expect(gate.status).toBe("pass");
    expect(gate.summary.total).toBe(0);
  });
});

describe("normalizeProposalIntake honesty", () => {
  it("does not fabricate a budget — flags it as a blocking assumption instead", () => {
    const { intake, registry } = normalizeProposalIntake(projectWith(buildOnlyIntake));

    expect(intake.budgetLineItems).toEqual([]);
    expect(intake.budgetTotal).toBe("Not specified");
    const budgetAssumption = registry.get("budgetTotal");
    expect(budgetAssumption).toBeDefined();
    expect(budgetAssumption?.blockingExport).toBe(true);
  });

  it("does not fabricate risks or KPIs — leaves them empty and blocking", () => {
    // An intake with NO risks and NO success criteria (so no KPIs can be derived).
    const bareIntake: IntakeInput = {
      ...buildOnlyIntake,
      knownRisks: [],
      successCriteria: []
    };
    const { intake, registry } = normalizeProposalIntake(projectWith(bareIntake));

    expect(intake.knownRisks).toEqual([]);
    expect(registry.get("knownRisks")?.blockingExport).toBe(true);

    expect(intake.kpis).toEqual([]);
    expect(registry.get("kpis")?.blockingExport).toBe(true);
  });

  it("records organization as a blocking assumption when not supplied", () => {
    const { registry } = normalizeProposalIntake(projectWith(buildOnlyIntake));
    const org = registry.get("organization");
    expect(org).toBeDefined();
    expect(org?.blockingExport).toBe(true);
  });

  it("marks the overall proposal DRAFT when business data is missing", () => {
    const { registry } = normalizeProposalIntake(projectWith(buildOnlyIntake));
    expect(evaluateExportGate(registry).status).toBe("blocked");
    expect(readinessLabel(registry)).toBe("DRAFT");
  });

  it("does NOT assume a field the client actually supplied", () => {
    const fullIntake: IntakeInput = {
      ...buildOnlyIntake,
      organization: "Real Client LLC",
      budget: "$50,000",
      marketSize: "$2B TAM",
      valueProposition: "Faster shipping.",
      competitiveAdvantage: "Governance.",
      revenueModel: "SaaS subscription",
      knownRisks: ["Token expiry"],
      successCriteria: ["Init", "Validate"]
    };
    const { intake, registry } = normalizeProposalIntake(projectWith(fullIntake));

    // Supplied values pass through untouched.
    expect(intake.organization).toBe("Real Client LLC");
    expect(intake.budgetTotal).toBe("$50,000");
    expect(intake.knownRisks.length).toBe(1);
    expect(intake.knownRisks[0].description).toBe("Token expiry");

    // And are NOT recorded as assumptions.
    expect(registry.has("organization")).toBe(false);
    expect(registry.has("budgetTotal")).toBe(false);
    expect(registry.has("knownRisks")).toBe(false);
  });
});
