/**
 * confidenceGate.ts
 *
 * The Confidence Gate — the honesty enforcement layer for the Proposal Factory.
 *
 * Mirrors the Software Factory's existing validation gate (pass / warning / fail)
 * that prevents Builder execution on incomplete intake. Here it prevents a
 * proposal from being promoted to FINAL — and blocks funder-facing export —
 * while funder-critical business data is still ASSUMED rather than confirmed.
 *
 * This is what makes "9.0/10 Verified" mean something: a proposal only reaches
 * FINAL when there are no unresolved, export-blocking assumptions left.
 *
 * Pure domain module: depends only on the AssumptionRegistry.
 */

import { AssumptionRegistry, AssumptionSummary } from "./assumptions.js";

export type ExportGateStatus = "pass" | "blocked";

export interface ExportGateResult {
  status: ExportGateStatus;
  /** True when the proposal is ready to be marked FINAL (no blocking assumptions). */
  readyForFinal: boolean;
  /** Reasons the gate is blocked (human-readable), empty when passing. */
  reasons: string[];
  /** The blocking assumption ids, for the UI / API consumer. */
  blockingAssumptionIds: string[];
  summary: AssumptionSummary;
}

/**
 * Evaluate whether a proposal may be exported as a FINAL document.
 *
 * Pass requires:
 *   1. No unresolved assumptions flagged `blockingExport`.
 *
 * (Confidence thresholds are surfaced as warnings on the package but do not
 *  hard-block on their own — a non-blocking low-confidence assumption may be
 *  legitimately carried into a DRAFT. Blocking is reserved for funder-critical
 *  fields where presenting an assumption as fact would be a liability.)
 */
export function evaluateExportGate(registry: AssumptionRegistry): ExportGateResult {
  const blocking = registry.blocking();
  const summary = registry.summary();
  const status: ExportGateStatus = blocking.length === 0 ? "pass" : "blocked";

  const reasons = blocking.map((a) => `${a.field}: ${a.riskIfWrong}`);

  return {
    status,
    readyForFinal: blocking.length === 0,
    reasons,
    blockingAssumptionIds: blocking.map((a) => a.id),
    summary
  };
}

/**
 * Human-readable label for the proposal's overall readiness, used in the
 * cover page and command center. DRAFT until the gate passes.
 */
export function readinessLabel(registry: AssumptionRegistry): "DRAFT" | "FINAL" {
  return evaluateExportGate(registry).readyForFinal ? "FINAL" : "DRAFT";
}
