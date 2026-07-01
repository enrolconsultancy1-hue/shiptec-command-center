# Project Tasks & Status

Last Updated: 2026-07-01 (Unified Intake Schema Complete — All Roadmap Items Done)

## Current Status: Shiptec Engine 1.0 — All Roadmap Items Complete
Shiptec is a fully operational AI Software Factory command center with an honest Proposal Factory. Every roadmap item has been shipped. The codebase has a canonical Zod intake schema, a reusable PipelineEngine, an evidence-based QA Assessor, and a Confidence Gate that prevents fabricated quality scores.

### Phase 0: Proposal Factory Honesty (COMPLETE)
- [x] Assumption Registry domain module (`src/domain/assumptions.ts`)
- [x] Confidence Gate evaluator (`src/domain/confidenceGate.ts`)
- [x] Refactored `normalizeProposalIntake` to emit assumptions instead of fabricating
- [x] Wired registry + confidence gate into `ProposalPackage` + `generateProposal`
- [x] Confidence Gate enforced in export route (409 + `force` opt-in)
- [x] Cover page stamp changed from false "FINAL Verified" to honest DRAFT/FINAL
- [x] Template fallbacks stripped of fabricated budget/risks/KPIs
- [x] `intakeSchema` extended to pass through all proposal/business fields
- [x] 12 domain tests + 2 updated API tests (34/34 passing)
- [x] Appendix Z (Assumption Register) appended to every proposal

### Phase 0.5: Pipeline Engine + Remaining Honesty (COMPLETE)
- [x] Generic `PipelineEngine` (`src/domain/pipeline/engine.ts`) — resumable, step-based runner
- [x] `generateProposal` refactored onto `PipelineEngine` — 15 steps declared as data
- [x] `listProposals` honesty fix — null scores instead of fabricated 9.0
- [x] Frontend renders "unknown" for proposals with missing metadata
- [x] 8 pipeline regression tests

### Phase 0.75: Unified Intake Schema (COMPLETE)
- [x] Canonical Zod schema (`src/schemas/intakeSchema.ts`) — single source of truth for user-provided intake
- [x] `IntakeInput` type derived from Zod (`z.infer<typeof intakeSchema>`) — eliminates drift with hand-written interface
- [x] Removed duplicate Zod from `projectService.ts`, removed hand-written interface from `types.ts`
- [x] `INTAKE_DEFAULTS` exported for test fixtures constructing intake directly
- [x] `ProposalIntake` kept as separate normalized output type (has derived fields user never provides)

### Phase 1: Foundation (COMPLETE)
- [x] API Contract Strengthened
- [x] Artifact Lifecycle Improved
- [x] GitHub Automation Complete
- [x] UI Polish & Workflow Guidance Complete
- [x] Gold Standard Patterns Implemented

### Phase 2: Operating the Factory (COMPLETE)
- [x] Implement Intake Assistant
- [x] Architect Handoff Automation (V2 Optimized Spec + Handoff Package)
- [x] Builder Execution Feedback (Implementation Log → Test Report)
- [x] Dry Run Validation
- [x] Factory Governance (Health Score & Current State)

### Phase 3: Handoff Optimization (COMPLETE)
- [x] Token-Dense Specification Format (V2)
- [x] Handoff Package Creator (`.shiptec-handoff` folder)
- [x] Dynamic Sprint-based Artifact Selection in UI

---

## Recommended Next Steps
All roadmap items are complete. Potential future work (not committed):
- Normalize the ~20 hardcoded-but-untracked fields in `normalizeProposalIntake` (e.g. `functionalRequirements`, `technologyStack`, `systemArchitecture`) into the Assumption Register so the Appendix Z fully discloses every inferred value.
- Resumable proposals: use `PipelineEngine.fromStep` to re-run from a failed step instead of regenerating from scratch.
- Software Factory pipeline: migrate the builder workflow onto `PipelineEngine` (the engine is generic and ready).

---

## Verification Commands
Run from `C:\Users\hp\projects\Shitec`:

```powershell
npm.cmd test      # 42 tests passing
npm.cmd run build # Zero TypeScript errors
```

The app starts on `PORT` or `3000` by default.
