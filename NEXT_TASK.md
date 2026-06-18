# Project Tasks & Status

Last Updated: 2026-06-18 (Firebase Backend Prep)

## Current Status: First Vertical Slice Implemented

Shiptec is an AI Software Factory command center for disciplined Architect-Builder delivery. This repository is a Node.js + TypeScript + Express app with a small browser cockpit in `public/`.

The core vertical slice is already present:

- Structured Architect intake.
- Required `Planning/`, `Planning/Governance/`, `Sprints/`, and `Docs/` artifact provisioning.
- Markdown template generation.
- Validation gate with pass, warning, and fail outcomes.
- Project scan and health scoring.
- Sprint creation with Sprint Plan, Builder Dry Run, logs, test report, and acceptance report.
- Local Git initialization and sprint acceptance commit flow.
- GitHub configuration detection with graceful missing-token handling.
- Public Command Center UI for initializing, scanning, validating, dry running, viewing artifacts, checking Git status, accepting, and preparing commits.
- Hardened API contract with structured errors, route-level sprint validation, and real sprint artifact reads.
- Friendlier occupied-port handling for local development.
- Project Ops now surfaces validation findings and health recommendations directly in the UI.
- Firebase deployment prep is in place with Hosting, Cloud Functions, and Firestore-backed storage mode.

Primary local app:

- API server: `npm run dev`
- Default URL: `http://localhost:3000`
- Current workspace: `C:\Users\hp\projects\Shitec`
- Default managed project folder: `C:\Users\hp\projects\Shitec\projects\shiptec-command-center`

Firebase target:

- Hosting serves `public/`.
- Cloud Functions serves the Express API through `/api/**`.
- Firestore stores project records and generated artifacts when `SHIPTEC_DATA_BACKEND=firestore`.
- Display name should be `Shiptec`; Firebase project ID must be globally unique.

Important note for future AI models: older Tectagrand/Firebase/Flutter notes are not the active project truth for this workspace. This repo is Shiptec.

---

## Completed Tasks

### 1. Architecture & Project Foundation

- [x] Created TypeScript + Express backend scaffold.
- [x] Added deterministic project initialization from structured intake.
- [x] Added centralized filesystem helpers with path safety.
- [x] Added local project registry at `.shiptec/projects.json`.
- [x] Added domain types for intake, projects, scans, health, Git status, sprints, and acceptance.
- [x] Kept route handlers thin and pushed project behavior into services.

### 2. Shiptec Operating Artifacts

- [x] Implemented required folder provisioning:
  - `Planning/`
  - `Planning/Governance/`
  - `Sprints/Sprint_001/`
  - `Docs/`
- [x] Added templates for:
  - Architect Pack
  - Technical Blueprint
  - Handoff Prompt
  - Validation Report
  - Current State
  - Decisions
  - Risks
  - Open Questions
  - Acceptance Criteria
  - Product Requirements
  - User Roles
  - Methodology Guide
  - System Tools
  - Success Criteria
  - Sprint Plan
  - Builder Dry Run
  - Implementation Log
  - Test Report
  - Acceptance Report
- [x] Uses write-if-missing behavior to avoid silently overwriting existing artifacts.

### 3. Validation, Health, and Governance

- [x] Added intake validation for missing roles, success criteria, ambiguous details, integrations, acceptance criteria, open questions, and sprint scope readiness.
- [x] Added project scan for required files.
- [x] Added health scoring with human-readable reasons and recommended next actions.
- [x] Added safe artifact reading for approved planning files only.

### 4. Sprint and Git Workflow

- [x] Added sprint creation through `createSprint`.
- [x] Added Builder Dry Run and Sprint Plan generation.
- [x] Added sprint acceptance flow.
- [x] Added optional local commit on approved sprint acceptance.
- [x] Added local Git repository initialization via `simple-git`.
- [x] Added GitHub config status check via `GITHUB_TOKEN`.

### 5. Command Center UI

- [x] Added working cockpit in `public/index.html`, `public/app.js`, and `public/styles.css`.
- [x] Supports project initialization from intake.
- [x] Supports known project selection.
- [x] Supports scan, validate, dry run, Git status, accept, commit preparation, and artifact viewing.
- [x] Shows validation findings and health recommendations in dedicated Project Ops panels.
- [x] Avoids a marketing landing page; the first screen is the actual operating surface.

### 6. Verification

- [x] Added Vitest coverage in `tests/vertical-slice.test.ts`.
- [x] Tests cover initialization, health scoring, validation failure, sprint acceptance commit, artifact reading, and unsafe path rejection.
- [x] Added API request/response coverage for project initialization, sprint artifact reads, unknown projects, and invalid sprint numbers.
- [x] Current verification: 7 tests passing and TypeScript build passing.

### 7. API Contract

- [x] Added consistent structured error responses with `code`, `message`, and optional `details`.
- [x] Added 404 responses for unknown projects.
- [x] Added route-level validation for sprint numbers.
- [x] Added required artifact path validation.
- [x] Implemented real `GET /projects/:id/sprints/:sprintId` response that reads sprint files.
- [x] Added a clear startup message when the desired port is already in use.
- [x] Added clearer UI diagnostics when an API request receives HTML instead of JSON.
- [x] Added `/api` route mounting for Firebase Hosting rewrites.

### 8. Firebase Backend Prep

- [x] Added Firebase Admin and Functions dependencies.
- [x] Added `src/firebaseFunction.ts` Cloud Functions entrypoint.
- [x] Added `firebase.json`, `.firebaserc`, Firestore rules, and Firestore indexes files.
- [x] Added Firestore-backed project registry mode.
- [x] Added Firestore-backed artifact storage mode.
- [x] Preserved local filesystem mode for development and tests.
- [x] Updated frontend API base so deployed Firebase Hosting calls `/api`.
- [x] Current verification: 8 tests passing and TypeScript build passing.

---

## Next Phase Tasks

### 1. Strengthen the API Contract

- [x] Add request/response tests for Express routes, not only service-level tests.
- [x] Return consistent error shapes for Zod validation failures and unknown projects.
- [x] Add route-level validation for sprint numbers and artifact paths.
- [x] Add a real `GET /projects/:id/sprints/:sprintId` response that reads sprint files instead of returning only IDs.
- [ ] Add request/response tests for artifact reading and sprint acceptance routes.

### 2. Improve Artifact Lifecycle

- [ ] Add explicit update flows for intake and planning artifacts.
- [ ] Add backup or versioning when user-authored artifacts need regeneration.
- [ ] Add a diff/preview endpoint before overwriting generated files.
- [ ] Expand artifact reader allowlist for additional governance files where useful.

### 3. Complete GitHub Automation

- [ ] Add GitHub repository creation or connection flow when `GITHUB_TOKEN` is configured.
- [ ] Add optional push after local sprint commit, gated by explicit user approval.
- [ ] Record commit and push metadata in the sprint implementation or acceptance log.

### 4. UI Polish and Workflow Guidance

- [ ] Improve frontend states for loading, success, warnings, and failure.
- [x] Show validation findings and health recommendations in structured panels instead of only the activity log.
- [ ] Add artifact editing or guided regeneration flow.
- [ ] Add sprint selection instead of hardcoding `Sprint_001` in several UI actions.

### 5. Gold Standard Patterns

- [ ] Add optional research workflow for comparable open-source project patterns.
- [ ] Require network/user approval before external lookup.
- [ ] Store pattern notes as planning artifacts without copying external code.

### 6. Firebase Deployment

- [ ] Create the Firebase project with display name `Shiptec`.
- [ ] Enable Firestore in native mode.
- [ ] Deploy Hosting, Functions, and Firestore rules.
- [ ] Initialize a Shiptec project through the deployed URL and verify Firestore records/artifacts are created.

---

## Verification Commands

Run from `C:\Users\hp\projects\Shitec`:

```powershell
npm.cmd install
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

The app starts on `PORT` or `3000` by default.

If port `3000` is already busy, run:

```powershell
$env:PORT="3001"; npm.cmd run dev
```

---

## Working Guidance For The Next AI Model

1. Inspect this repository before making assumptions.
2. Treat `NEXT_TASK.md`, `README.md`, and `Shiptec.md` as the project memory trio.
3. Preserve user-authored planning artifacts; do not overwrite generated project files silently.
4. Keep the Architect-Builder split intact.
5. Build in small verified increments.
6. Run `npm test` and `npm run build` after meaningful code changes.
7. If continuing the next phase, expand artifact lifecycle flows or improve the UI states for validation and health recommendations.
