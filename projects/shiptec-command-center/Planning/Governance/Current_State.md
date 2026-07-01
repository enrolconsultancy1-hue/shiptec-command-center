# Current State

## Project
Shiptec Command Center

## Health Score
95/100

## Status
Healthy

## Latest Scan
- Required files: All present
- Git: Changes pending (PipelineEngine wiring + listProposals honesty fix)

## Active Work: Phase 0.5 — Pipeline Engine + Remaining Honesty
**Status:** Implementation complete, tests passing (42/42).

### What Changed
- **PipelineEngine wired in** (`src/services/proposalService.ts`): `generateProposal`'s 15 inline step blocks were refactored into a `PipelineStep<ProposalPipelineContext>[]` array run by the reusable `PipelineEngine`. Steps are now declared as data; the engine provides real per-step timestamps, failure halting with `status: "failed"`, and payload-based cross-step data flow (step 2→12 gaps, step 11→15 gate/sections, step 12→14 qualityReport).
- **`ProposalPipelineContext`** (`src/services/proposalService.ts`): Typed context carrying inputs (`project`, `intake`, `registry`, `startTime`) plus optional fields deposited by steps (`gaps`, `gate`, `readiness`, `sections`, `qualityReport`, `proposalIdStr`). Replaces the previous closure-local shared variables.
- **`listProposals` honesty fix** (`src/services/proposalService.ts`): When `metadata.json` is missing or unreadable, the fallback now returns `overallScore: null`, `version: null`, `sectionCount: null` instead of the previously fabricated `9.0/1.0/16`.
- **`ProposalRecord` fields nullable** (`src/proposalTypes.ts`): `overallScore`, `version`, `sectionCount` are now `number | null` — honest about unknown state.
- **Frontend renders "unknown"** (`public/app.js`): Proposal dropdown shows "Proposal_001 (unknown)" instead of the fabricated "Proposal_001 (9.0/10)" when metadata is unavailable.
- **Pipeline regression tests** (`tests/proposal-pipeline.test.ts`): 8 tests locking the engine contract — 15 steps in canonical order, 1–15 numbering, all completed status, real timestamps (`completedAt ≥ startedAt`), gap/assumption cross-step flow, blocking budget finding, and listProposals honesty with missing metadata.

### Earlier Phases (Unchanged)
- **Assumption Registry** (`src/domain/assumptions.ts`): Tracks every inferred value with provenance, confidence, risk if wrong, and `exportBlocking`.
- **Confidence Gate** (`src/domain/confidenceGate.ts`): Blocks FINAL promotion when funder-critical assumptions are unresolved.
- **QA Assessor** (`src/domain/qaAssessor.ts`): Evidence-based, rule-driven 13-dimension scoring replacing the old hardcoded 9.0 + revision boost.
- **PipelineEngine** (`src/domain/pipeline/engine.ts`): Generic, resumable, step-based runner shared by Shiptec's factories.

## Decisions
- Fabricated business data is a liability, not a feature. Every inferred value must be tracked.
- The Confidence Gate uses HTTP 409 (not 403) because the resource exists but is in the wrong state.
- `options.force` exists as an explicit opt-in. Never set silently.
- `ProposalRecord` nullable fields (`overallScore`, `version`, `sectionCount`) use `null` for "unknown" rather than inventing plausible-looking defaults. `null` is honest; `9.0` was a lie.
- Steps are declared as data (an array of `PipelineStep` objects) rather than inline code blocks — the engine contract is testable independently of `generateProposal`.

## Risks
- Existing proposals persisted before Phase 0 lack `assumptions` and `confidence` fields. `readProposal` returns them without these fields. The export gate should handle this gracefully (treat missing gate as "unknown — allow export").

## Recommended Next Actions
- **Unified IntakeSchema**: Collapse `IntakeInput` (types.ts) and `ProposalIntake` (proposalTypes.ts) into a single Zod schema with a required/optional split. This is the one remaining roadmap item from the original Phase 1 plan.

## Last Updated
2026-06-30T23:40:00.000Z
