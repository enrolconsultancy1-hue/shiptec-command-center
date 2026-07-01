/**
 * qaAssessor.ts
 *
 * The Quality Assessor — evidence-based, rule-driven scoring for the Proposal
 * Factory.
 *
 * This replaces the previous quality block in proposalService, which assigned
 * each of the 13 dimensions a near-perfect score from a ternary on a single
 * intake field, then *boosted* every score by `+0.5` per revision iteration
 * while a fake "Revision Loop" appended "*Revision Loop Correction*" text to
 * sections to simulate improvement. That fabricated a "9.0/10 Verified" stamp
 * on proposals whose business data was entirely assumed.
 *
 * The prime directive is "NEVER guess. NEVER INVENT REQUIREMENTS." A quality
 * score is itself a claim about the proposal, so it must be defensible. Every
 * score emitted here is the output of an explicit rule and carries the concrete
 * `evidence` the rule inspected. There is no revision boost — the score is what
 * the input actually supports.
 *
 * FINAL/DRAFT promotion is still decided solely by the Confidence Gate; the
 * assessor only describes quality honestly and is allowed to score low.
 *
 * Pure domain module: depends only on the proposal types and AssumptionRegistry.
 */

import { AssumptionRegistry } from "./assumptions.js";
import {
  ProposalIntake,
  QualityDimension,
  QualityReport,
  QUALITY_DIMENSIONS,
  QualityDimensionName
} from "../proposalTypes.js";
import { StepGap } from "../proposalTypes.js";

/** Threshold a dimension must reach to be considered "passed". */
const PASS_THRESHOLD = 9;

/**
 * Assess the 13 quality dimensions against the actual proposal intake and the
 * Assumption Registry. No score is fabricated and no score is boosted.
 */
export function assessQuality(
  intake: ProposalIntake,
  registry: AssumptionRegistry,
  gaps: StepGap[]
): QualityReport {
  const summary = registry.summary();

  const scored: QualityDimension[] = QUALITY_DIMENSIONS.map((d) => {
    const result = scoreDimension(d.name, intake, registry, gaps, summary);
    return {
      name: d.name,
      label: d.label,
      score: result.score,
      maxScore: 10,
      weakness: result.score < PASS_THRESHOLD ? result.weakness : undefined,
      // The assessor does not invent revisions; revision text is omitted so the
      // consumer cannot mistake an honest low score for an auto-fixed one.
      revision: undefined,
      evidence: result.evidence,
      passedThreshold: result.score >= PASS_THRESHOLD
    };
  });

  const overallScore = Number(
    (scored.reduce((acc, d) => acc + d.score, 0) / scored.length).toFixed(2)
  );
  const allPassed = scored.every((d) => d.passedThreshold);

  return {
    dimensions: scored,
    overallScore,
    // revisionCount is honestly zero — there is no automated revision theatre.
    revisionCount: 0,
    allPassed,
    threshold: PASS_THRESHOLD,
    assessedAt: new Date().toISOString()
  };
}

interface DimensionScore {
  score: number;
  weakness?: string;
  evidence: string[];
}

/** Small helper: a string field counts as present only when it is real prose. */
function hasProse(value: string | undefined): boolean {
  return Boolean(value) && !/^(not specified|none specified|tbd|n\/a)$/i.test((value ?? "").trim());
}

/**
 * The rule for a single dimension. Each branch states exactly what input it
 * inspected, so the resulting score is auditable rather than asserted.
 */
function scoreDimension(
  name: QualityDimensionName,
  intake: ProposalIntake,
  registry: AssumptionRegistry,
  gaps: StepGap[],
  summary: { total: number; blocking: number; open: number }
): DimensionScore {
  switch (name) {
    case "strategic_alignment": {
      const n = intake.strategicObjectives.length;
      if (n >= 3) return { score: 10, evidence: [`${n} strategic objectives derived from success criteria.`] };
      if (n >= 1) return { score: 7.5, weakness: "Only one strategic objective derived.", evidence: [`${n} strategic objective(s) derived.`] };
      return { score: 3, weakness: "No strategic objectives — no success criteria were provided.", evidence: ["strategicObjectives is empty."] };
    }

    case "completeness": {
      // Score falls with the number of open gaps/assumptions. No artificial floor.
      const open = summary.open;
      if (open === 0) return { score: 10, evidence: ["No open assumptions in the register."] };
      // Each open gap costs 0.4, down to a floor of 2 where the intake is mostly absent.
      const raw = 10 - open * 0.4;
      const score = Math.max(2, Number(raw.toFixed(1)));
      return {
        score,
        weakness: `${open} intake value(s) are assumed rather than confirmed.`,
        evidence: [`${open} open assumption(s); ${gaps.length} gap(s) surfaced at the find-missing step.`]
      };
    }

    case "business_case": {
      const problem = hasProse(intake.businessProblem);
      const summaryProse = hasProse(intake.productSummary);
      const value = hasProse(intake.valueProposition);
      const present = [problem, summaryProse, value].filter(Boolean).length;
      if (present === 3) return { score: 9.5, evidence: ["businessProblem, productSummary and valueProposition all supplied."] };
      if (present >= 1) return { score: 6.5, weakness: "The business case is incomplete (some core fields assumed).", evidence: [`${present}/3 core business-case fields present.`] };
      return { score: 3, weakness: "Business problem, summary and value proposition are all absent.", evidence: ["All three core business-case fields are assumed."] };
    }

    case "technical_soundness": {
      const reqs = intake.functionalRequirements.length + intake.nonFunctionalRequirements.length;
      const arch = hasProse(intake.systemArchitecture);
      if (reqs >= 4 && arch) return { score: 9.5, evidence: [`${reqs} functional/non-functional requirements and an architecture statement.`] };
      if (reqs >= 1) return { score: 7, weakness: "Requirements set is thin or architecture is unproven.", evidence: [`${reqs} requirement(s) present; architecture present: ${arch}.`] };
      return { score: 4, weakness: "No technical requirements captured.", evidence: ["functionalRequirements and nonFunctionalRequirements are empty."] };
    }

    case "financial_credibility": {
      if (intake.budgetLineItems.length > 0) {
        const total = intake.budgetLineItems.reduce((acc, i) => acc + i.totalCost, 0);
        return { score: 10, evidence: [`Client-supplied ${intake.budgetLineItems.length} line items totalling $${total.toLocaleString()}.`] };
      }
      if (hasProse(intake.budgetTotal)) return { score: 7, weakness: "A budget figure is present but no line-item breakdown.", evidence: [`budgetTotal="${intake.budgetTotal}" with no line items.`] };
      return {
        score: 3,
        weakness: "No budget supplied. The detailed budget table is intentionally empty and FINAL promotion is blocked.",
        evidence: ["budgetLineItems is empty; budgetTotal is assumed (blocking)."]
      };
    }

    case "risk_coverage": {
      const n = intake.knownRisks.length;
      if (n >= 3) return { score: 9.5, evidence: [`${n} risks registered.`] };
      if (n >= 1) return { score: 7, weakness: "Risk register is thin.", evidence: [`${n} risk(s) registered.`] };
      return {
        score: 3,
        weakness: "No risks captured. The risk register is intentionally empty and FINAL promotion is blocked.",
        evidence: ["knownRisks is empty (blocking assumption recorded)."]
      };
    }

    case "governance": {
      const team = intake.teamStructure.length;
      const decision = hasProse(intake.decisionMaking);
      if (team >= 2 && decision) return { score: 9.5, evidence: [`${team} team roles and a decision-making model.`] };
      if (team >= 1 || decision) return { score: 7, weakness: "Governance is only partially described.", evidence: [`${team} role(s); decision-making present: ${decision}.`] };
      return { score: 5, weakness: "No team structure or decision model captured.", evidence: ["teamStructure empty and decisionMaking assumed."] };
    }

    case "sustainability": {
      const plan = hasProse(intake.sustainabilityPlan);
      const revenue = hasProse(intake.revenueModel);
      if (plan && revenue) return { score: 9, evidence: ["Sustainability plan and revenue model both supplied."] };
      if (plan || revenue) return { score: 6.5, weakness: "Sustainability narrative is partial.", evidence: [`sustainabilityPlan present: ${plan}; revenueModel present: ${revenue}.`] };
      return { score: 3.5, weakness: "No sustainability plan or revenue model captured.", evidence: ["Both assumed."] };
    }

    case "monitoring_evaluation": {
      const kpis = intake.kpis.length;
      const plan = hasProse(intake.monitoringPlan);
      if (kpis >= 2 && plan) return { score: 9, evidence: [`${kpis} KPIs and a monitoring plan.`] };
      if (kpis >= 1 || plan) return { score: 7, weakness: "M&E framework is thin.", evidence: [`${kpis} KPI(s); monitoring plan present: ${plan}.`] };
      return {
        score: 3,
        weakness: "No KPIs captured. The M&E table is intentionally empty and FINAL promotion is blocked.",
        evidence: ["kpis is empty (blocking assumption recorded)."]
      };
    }

    case "compliance": {
      const legal = intake.legalRequirements.length + intake.privacyRequirements.length + intake.securityCompliance.length;
      if (legal >= 2) return { score: 9.5, evidence: [`${legal} compliance/regulatory requirement(s) registered.`] };
      if (legal === 1) return { score: 7.5, weakness: "Only one compliance requirement captured.", evidence: [`${legal} requirement registered.`] };
      return { score: 5, weakness: "No compliance regime specified.", evidence: ["No legal/privacy/security compliance entries."] };
    }

    case "readability": {
      // Readability is a property of the drafted prose, not the intake. We score
      // it on the size of the assembled content rather than asserting 9.8 blind.
      const sections = Math.max(0, Math.round((intake.productSummary?.length ?? 0) / 1));
      const evidence = [`Cover and executive-summary prose compiled (${intake.productSummary.length} chars of product summary).`];
      // Bounded, content-aware score. Avoids claiming perfection for an empty draft.
      const score = intake.productSummary.length > 0 ? 9 : 6;
      if (score < PASS_THRESHOLD) return { score, weakness: "Summary prose is too thin to support a top readability score.", evidence };
      return { score: sections > 0 ? 9 : 7, evidence };
    }

    case "persuasiveness": {
      // Persuasiveness depends on whether the value/market case is real or assumed.
      const real = [hasProse(intake.valueProposition), hasProse(intake.competitiveAdvantage), hasProse(intake.marketSize)].filter(Boolean).length;
      if (real === 3) return { score: 9, evidence: ["Value proposition, competitive advantage and market size all supplied."] };
      if (real >= 1) return { score: 6, weakness: "Persuasive case rests partly on assumed market data.", evidence: [`${real}/3 market-case fields present.`] };
      return { score: 3, weakness: "No market/value case supplied — the proposal cannot be persuasive on assumed data.", evidence: ["valueProposition, competitiveAdvantage and marketSize all assumed."] };
    }

    case "internal_consistency": {
      // Cross-field consistency: fundingRequested should agree with budgetTotal,
      // and successCriteria/KPIs should both be present together.
      const fundingMatches = hasProse(intake.fundingRequested) && intake.fundingRequested === intake.budgetTotal;
      const mePaired = (intake.successCriteria.length > 0) === (intake.kpis.length > 0 || registry.get("kpis") !== undefined);
      const consistent = [fundingMatches, mePaired].filter(Boolean).length;
      if (consistent === 2) return { score: 9.5, evidence: ["fundingRequested agrees with budgetTotal; M&E fields are consistently populated."] };
      return { score: 7, weakness: "Some cross-field relationships are not internally consistent.", evidence: [`fundingRequested=budgetTotal: ${fundingMatches}; M&E pairing consistent: ${mePaired}.`] };
    }

    default: {
      // Exhaustiveness guard — a new dimension with no rule fails loudly.
      return { score: 1, weakness: `No scoring rule defined for dimension "${name}".`, evidence: ["Assessor rule missing — this is a bug."] };
    }
  }
}
