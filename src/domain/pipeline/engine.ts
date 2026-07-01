/**
 * pipeline/engine.ts
 *
 * A generic, resumable, step-based pipeline runner shared by Shiptec's factories.
 *
 * The Proposal Factory's 15-step workflow (validate_intake → find_missing → … →
 * final_proposal) was originally a flat sequence of inline blocks inside
 * `generateProposal`. This engine extracts that pattern into a reusable,
 * testable abstraction so that:
 *   - Steps are declared as data (an array of PipelineStep objects).
 *   - Execution is sequential, timestamped, and produces a structured log.
 *   - Resumption is possible: re-run from `fromStep` while preserving prior
 *     results — the context carries mutable state forward.
 *   - A failing step halts the pipeline immediately and records `status: failed`.
 *
 * The step sub-shapes (StepFinding, StepGap, StepAssumption) are imported from
 * proposalTypes.ts because they already represent the most general vocabulary
 * for step-level observations. The Software Factory can adopt these same shapes
 * when it migrates onto the engine in a future milestone.
 *
 * Pure domain module: no fs / express / firebase imports.
 */

import {
  StepStatus,
  StepFinding,
  StepGap,
  StepAssumption
} from "../../proposalTypes.js";

// ─── Step Outcome ─────────────────────────────────────────────────────────────────

/**
 * What a step returns. Fields are optional so a simple step can just return
 * `{ status: "completed" }` while richer steps can populate findings,
 * gaps, assumptions, or attach arbitrary payload to the context.
 */
export interface StepOutcome {
  status: StepStatus;
  findings?: StepFinding[];
  gaps?: StepGap[];
  assumptions?: StepAssumption[];
  /** Arbitrary data the step wants to deposit on the context for later steps. */
  payload?: Record<string, unknown>;
}

// ─── Step Definition ─────────────────────────────────────────────────────────────

/**
 * A single unit of work in the pipeline. The `name` is a free-form string
 * (typically matching the WorkflowStepName union for the Proposal Factory, but
 * not constrained to it so the Software Factory can use its own names).
 */
export interface PipelineStep<C> {
  name: string;
  run(ctx: C): StepOutcome | Promise<StepOutcome>;
}

// ─── Step Result (recorded) ──────────────────────────────────────────────────────

/**
 * A recorded step result with timestamps. This is the engine's internal shape;
 * consumers map it to their own result type (e.g. WorkflowStepResult).
 */
export interface StepResult {
  step: number;
  name: string;
  status: StepStatus;
  startedAt: string;
  completedAt?: string;
  findings: StepFinding[];
  gaps: StepGap[];
  assumptions: StepAssumption[];
}

// ─── Engine ──────────────────────────────────────────────────────────────────────

export class PipelineEngine<C> {
  private readonly steps: PipelineStep<C>[];
  private readonly log: StepResult[] = [];

  constructor(steps: PipelineStep<C>[]) {
    this.steps = steps;
  }

  /** Current step count (how many have been executed). */
  get completedCount(): number {
    return this.log.length;
  }

  /** The step results log. */
  get results(): StepResult[] {
    return [...this.log];
  }

  /**
   * Run the pipeline from the beginning or from a specific step (1-indexed).
   * Prior results from steps before `fromStep` are preserved.
   * A failing step halts execution immediately.
   */
  async run(ctx: C, opts?: { fromStep?: number }): Promise<StepResult[]> {
    const from = opts?.fromStep ?? 1;
    const startIdx = from - 1;

    if (startIdx < 0 || startIdx >= this.steps.length) {
      throw new RangeError(
        `fromStep ${from} is out of range for a pipeline with ${this.steps.length} steps.`
      );
    }

    for (let i = startIdx; i < this.steps.length; i++) {
      const stepDef = this.steps[i];
      const startedAt = new Date().toISOString();

      let outcome: StepOutcome;
      try {
        outcome = await stepDef.run(ctx);
      } catch (err) {
        outcome = {
          status: "failed",
          findings: [{
            severity: "critical",
            field: stepDef.name,
            message: err instanceof Error ? err.message : String(err)
          }]
        };
      }

      const result: StepResult = {
        step: i + 1,
        name: stepDef.name,
        status: outcome.status,
        startedAt,
        completedAt: outcome.status !== "running" ? new Date().toISOString() : undefined,
        findings: outcome.findings ?? [],
        gaps: outcome.gaps ?? [],
        assumptions: outcome.assumptions ?? []
      };

      this.log.push(result);

      // Merge payload onto the context so later steps can read it.
      if (outcome.payload) {
        Object.assign(ctx as object, outcome.payload);
      }

      // Halt on failure.
      if (outcome.status === "failed") break;
    }

    return this.results;
  }

  /**
   * Serialize the log for persistence (metadata.json, debug output, etc.).
   * Round-trips through `PipelineEngine.fromJSON` to rehydrate.
   */
  toJSON(): StepResult[] {
    return this.results;
  }

  /** Create a detached engine from persisted step results (read-only log). */
  static fromJSON<C>(steps: PipelineStep<C>[], results: StepResult[]): PipelineEngine<C> {
    const engine = new PipelineEngine<C>(steps);
    // Hydrate the internal log from persisted results. `log` is private and
    // readonly so it can't be assigned normally; this static factory is the one
    // legitimate construction path that pre-seeds it, hence the double cast.
    (engine as unknown as { log: StepResult[] }).log = results;
    return engine;
  }
}
