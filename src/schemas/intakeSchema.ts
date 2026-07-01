/**
 * intakeSchema.ts
 *
 * The canonical Zod schema for user-provided intake data. This is the single
 * source of truth consumed by both `initializeProject` (build factory) and
 * `normalizeProposalIntake` (proposal factory). The derived `IntakeInput` type
 * replaces the hand-written interface that previously drifted from the schema.
 *
 * Required fields are the minimum viable intake for project initialization.
 * Optional fields (the proposal/business block) pass through untouched so the
 * Proposal Factory's Assumption Registry can track whichever are missing.
 */
import { z } from "zod";

export const intakeSchema = z.object({
  // ── Required core fields ──────────────────────────────────────────────────
  projectName: z.string().min(1),
  productSummary: z.string().min(1),
  businessProblem: z.string().min(1),
  targetUsers: z.array(z.string().min(1)),
  currentWorkflow: z.string().min(1),
  desiredWorkflow: z.string().min(1),
  toolsAndIntegrations: z.array(z.string()).default([]),
  technicalConstraints: z.array(z.string()).default([]),
  successCriteria: z.array(z.string().min(1)),
  mvpDefinition: z.string().min(1),
  knownRisks: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),

  // ── Optional build-side fields ────────────────────────────────────────────
  budget: z.string().optional(),
  timeline: z.string().optional().default("Not specified"),
  compliance: z.string().optional().default("None specified"),
  generateLegalDocs: z.boolean().default(false),
  brandColors: z.string().optional().default("Not specified"),
  typography: z.string().optional().default("Not specified"),
  gitUrl: z.string().url().optional().or(z.literal("")),
  skillsUrl: z.array(z.string().url()).default([]),
  knowledgeUrl: z.array(z.string().url()).default([]),

  // ── Proposal / business fields ─────────────────────────────────────────────
  // These flow straight through to the Proposal Factory. They are OPTIONAL
  // (not validated for presence) so a build-only intake still initializes; the
  // Proposal Factory's Assumption Registry tracks whichever are missing.
  organization: z.string().optional(),
  country: z.string().optional(),
  industry: z.string().optional(),
  fundingType: z.string().optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  marketSize: z.string().optional(),
  competitors: z.array(z.string()).optional(),
  competitiveAdvantage: z.string().optional(),
  valueProposition: z.string().optional(),
  revenueModel: z.string().optional(),
  roi: z.string().optional(),
  esgStatement: z.string().optional(),
  expansionStrategy: z.string().optional(),
  exitStrategy: z.string().optional(),
  scalabilityPlan: z.string().optional(),
  sustainabilityPlan: z.string().optional(),
  decisionMaking: z.string().optional(),
  communicationPlan: z.string().optional(),
  inclusionStrategy: z.string().optional(),
  environmentalSustainability: z.string().optional()
});

/**
 * The TypeScript type derived from the canonical Zod schema.
 * Replaces the hand-written `IntakeInput` interface (previously in types.ts).
 *
 * Note: fields with `.default()` (e.g. `timeline`, `compliance`, `brandColors`,
 * `typography`) are non-optional in this type because Zod guarantees a value at
 * runtime. The old hand-written interface incorrectly marked them optional.
 */
export type IntakeInput = z.infer<typeof intakeSchema>;

/**
 * Default values the schema applies to optional fields. Useful in tests and
 * other code that constructs IntakeInput objects directly (bypassing Zod
 * parse) but still needs to satisfy the derived non-optional type.
 */
export const INTAKE_DEFAULTS = {
  timeline: "Not specified",
  compliance: "None specified",
  generateLegalDocs: false,
  brandColors: "Not specified",
  typography: "Not specified",
  skillsUrl: [] as string[],
  knowledgeUrl: [] as string[]
};
