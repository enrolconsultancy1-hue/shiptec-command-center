/**
 * assumptions.ts
 *
 * The Assumption Registry — the honesty backbone of the Shiptec Proposal Factory.
 *
 * SHIPTEC's prime directive is "NEVER guess. NEVER INVENT REQUIREMENTS." The
 * Proposal Factory previously violated this by silently fabricating ~30 business
 * fields (budgets, risks, KPIs, competitors…) and stamping the result
 * "FINAL (QA & Independent Expert Verified)".
 *
 * This module replaces silent fabrication with EXPLICIT, TRACKED assumptions.
 * Every value Shiptec infers rather than receives is recorded here with its
 * provenance, confidence, the risk of being wrong, and whether it blocks a
 * final/funder-facing export. Nothing is ever blended into the output as
 * established fact without a corresponding assumption record.
 *
 * Pure domain module: no fs / express / firebase imports.
 */

export type AssumptionSource =
  /** A generic best-practice placeholder for the field's domain/industry. */
  | "industry_default"
  /** Derived from other fields the user DID provide. */
  | "inferred"
  /** Structural scaffolding required for the document shape (e.g. phase plan). */
  | "template";

export interface Assumption {
  /** Stable id, typically the dotted field path (e.g. "budgetTotal"). */
  id: string;
  /** Dotted path into ProposalIntake (e.g. "budgetLineItems", "knownRisks"). */
  field: string;
  /** Human-readable assumed value. */
  assumedValue: string;
  /** How this value was produced. */
  source: AssumptionSource;
  /** 0..1 — how reliable this assumption is. Low confidence is flagged in output. */
  confidence: number;
  /** Why this assumption was made. */
  rationale: string;
  /** The consequence to the proposal/funder if this assumption is wrong. */
  riskIfWrong: string;
  /**
   * If true, the value is funder-critical and the proposal cannot be promoted
   * from DRAFT to FINAL until it is resolved by the user.
   */
  blockingExport: boolean;
  /** True once the user supplies a real value for this field. */
  resolved: boolean;
}

export interface AssumptionSummary {
  total: number;
  blocking: number;
  resolved: number;
  open: number;
  /** Lowest confidence among open (unresolved) assumptions, or 1 when none. */
  lowestConfidence: number;
}

/**
 * Append-only ledger of every inferred value. The registry is the single source
 * of truth for "what did Shiptec make up here?".
 */
export class AssumptionRegistry {
  private readonly assumptions = new Map<string, Assumption>();

  /** Record an assumption. Returns the stored record. Idempotent on `id`. */
  record(input: Omit<Assumption, "resolved"> & { resolved?: boolean }): Assumption {
    const existing = this.assumptions.get(input.id);
    if (existing) {
      // Keep the stricter of two records for the same field: blocking wins,
      // and the lower confidence wins, so assumptions are never silently relaxed.
      // Persist the merge so the stricter value sticks in the ledger.
      const merged: Assumption = {
        ...existing,
        blockingExport: existing.blockingExport || input.blockingExport,
        confidence: Math.min(existing.confidence, input.confidence)
      };
      this.assumptions.set(input.id, merged);
      return merged;
    }
    const record: Assumption = { ...input, resolved: input.resolved ?? false };
    this.assumptions.set(input.id, record);
    return record;
  }

  has(id: string): boolean {
    return this.assumptions.has(id);
  }

  get(id: string): Assumption | undefined {
    return this.assumptions.get(id);
  }

  /** Mark a field's assumption as resolved by the user (real value supplied). */
  resolve(id: string): boolean {
    const record = this.assumptions.get(id);
    if (!record) return false;
    record.resolved = true;
    return true;
  }

  list(): Assumption[] {
    return [...this.assumptions.values()].sort((a, b) => {
      // Blocking + unresolved first, then by confidence ascending.
      const aBlocking = a.blockingExport && !a.resolved ? 1 : 0;
      const bBlocking = b.blockingExport && !b.resolved ? 1 : 0;
      if (aBlocking !== bBlocking) return bBlocking - aBlocking;
      return a.confidence - b.confidence;
    });
  }

  /** Unresolved assumptions that prevent FINAL promotion. */
  blocking(): Assumption[] {
    return this.list().filter((a) => a.blockingExport && !a.resolved);
  }

  summary(): AssumptionSummary {
    const all = this.list();
    const open = all.filter((a) => !a.resolved);
    const blocking = open.filter((a) => a.blockingExport);
    const lowestConfidence = open.length
      ? Math.min(...open.map((a) => a.confidence))
      : 1;
    return {
      total: all.length,
      blocking: blocking.length,
      resolved: all.length - open.length,
      open: open.length,
      lowestConfidence
    };
  }

  /** Serialize for persistence (metadata.json) and API responses. */
  toJSON(): Assumption[] {
    return this.list();
  }

  /** Rehydrate a registry from persisted records (e.g. on readProposal). */
  static fromJSON(records: Assumption[] | undefined): AssumptionRegistry {
    const registry = new AssumptionRegistry();
    if (records) {
      for (const record of records) {
        registry.assumptions.set(record.id, { ...record });
      }
    }
    return registry;
  }
}
