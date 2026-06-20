# SHIPTEC BUILDER SPECIFICATION (Silicon Valley Level)

## Generation Metadata
- GeneratedAt: 2026-06-20T20:29:48.864Z
- GenerationID: gen-y0w50vaqd
- ProjectID: shiptec-command-center
- Branch: main
- CommitHash: INITIAL_OR_MOCKED_HASH

---

## 1. Source of Truth Hierarchy
1. Technical_Blueprint.md
2. Architect_Pack.md
3. NEXT_TASK.md
4. Governance/*
5. Existing repository

*Mandate:* Anything outside these sources is strictly forbidden. Never invent APIs, routes, tables, schemas, or requirements. Unknown items must be written to Governance/Open_Questions.md.

---

## 2. NEXT_TASK
# Project Tasks & Status

Last Updated: 2026-06-19 (UI Polish Refinement)

## Current Status: Shiptec Factory Operational
Shiptec is an AI Software Factory command center for disciplined Architect-Builder delivery. Core factory functionality is fully implemented for local development.

### Phase 1: Foundation Complete
- [x] API Contract Strengthened
- [x] Artifact Lifecycle Improved
- [x] GitHub Automation Complete
- [x] UI Polish & Workflow Guidance Complete
- [x] Gold Standard Patterns Implemented
- [ ] Firebase Deployment (Deferred: Local-Only mode active)

---

## Phase 2: Operating the Factory (In Progress)

### 1. Project Onboarding
- [x] Implement Intake Assistant: Guided UI wizard for project intake.
- [ ] Add Architect Handoff automation: Generate Handoff Prompt from Intake.

### 2. Builder Execution
- [x] Add Builder execution feedback: Automated parsing of Implementation Logs to update Test Reports.
- [x] Add Dry Run validation: Automated check if file operations map to requested changes.

### 3. Factory Governance
- [x] Automate project health reporting in `Current_State.md`.
- [ ] Add automated periodic project scan alerts.

---

## Completed Tasks (Phase 1)

### 1. Strengthen the API Contract
- [x] Add request/response tests for Express routes.
- [x] Return consistent error shapes.
- [x] Add route-level validation.
- [x] Add real artifact reading route.
- [x] Add integration tests for artifact and sprint routes.

### 2. Improve Artifact Lifecycle
- [x] Add explicit update flows for intake and planning artifacts.
- [x] Add backup/versioning for user-authored artifacts.
- [x] Add diff/preview endpoint.
- [x] Expand artifact reader allowlist.

### 3. Complete GitHub Automation
- [x] Add GitHub repository creation/setup.
- [x] Add optional push after local sprint commit.
- [x] Record commit and push metadata in Implementation Log.

### 4. UI Polish and Workflow Guidance
- [x] Improve frontend states for loading, success, warnings, and failure.
- [x] Show validation findings and health recommendations in structured panels.
- [x] Add artifact editing and guided regeneration.
- [x] Add sprint selection UI.
- [x] **Added Artifact View Show More/Less toggle.**

### 5. Gold Standard Patterns
- [x] Add research workflow for comparable open-source project patterns.
- [x] Require network/user approval.
- [x] Store pattern notes in /Planning/Patterns_Notes.md.

---

## Verification Commands
Run from `C:\Users\hp\projects\Shitec`:

```powershell
npm.cmd test
npm.cmd run build
```

The app starts on `PORT` or `3000` by default.


---

## 3. Architect Pack Context
# Architect Pack

## Product Intent
A governed command center that turns software ideas into Architect Packs, validation gates, sprint dry runs, and implementation records.

## Business Problem
AI-assisted software work often starts from vague prompts and lacks durable planning, acceptance criteria, and delivery governance.

## Users and Roles
- Founder\nProduct engineer\nAI builder operator

## Future Workflow
Users complete structured intake, generate planning artifacts, validate readiness, create sprint plans, and execute through Builder dry runs.

## MVP Scope
A backend API and cockpit that initializes a governed project, generates source-of-truth planning artifacts, validates intake, creates sprint files, and reports health.

## Success Criteria
- Initialize required Shiptec folders\nGenerate governance templates\nCreate Architect Pack from intake\nDetect validation issues\nReport project health\nPrepare sprint dry run

## Integrations
- Local filesystem\nGit\nGitHub via token when configured

## Constraints
- Node.js\nTypeScript\nExpress\nMarkdown artifacts\nNo silent overwrites

## Risks
- GitHub credentials may be missing\nOpen questions may block Builder execution\nGenerated templates must avoid overwriting user-authored content

## Open Questions
- TBD


---

## 4. Technical Blueprint
# Technical Blueprint

## Default Stack
- Node.js
- TypeScript
- Express
- simple-git
- @octokit/rest
- Markdown planning artifacts

## Initial Architecture
- API layer handles command center requests.
- Domain services perform validation, health scoring, sprint planning, and file provisioning.
- Filesystem service owns all project artifact writes.
- Git service owns local Git and GitHub readiness checks.

## Project Constraints
- Node.js\nTypeScript\nExpress\nMarkdown artifacts\nNo silent overwrites


---

## 5. Unresolved Open Questions
# Open Questions

- TBD


---

## 6. Repository Snapshot
```text
- Docs
  - Methodology_Guide.md
  - Product_Requirements.md
  - Success_Criteria.md
  - System_Tools.md
  - User_Roles.md
- Planning
  - Architect_Pack.md
  - Builder_Specification.md
  - Governance
    - Acceptance_Criteria.md
    - Current_State.md
    - Decisions.md
    - Open_Questions.md
    - Risks.md
  - Handoff_Prompt.md
  - Technical_Blueprint.md
  - Validation_Report.md
- Sprints
  - Sprint_001
    - Acceptance_Report.md
    - Builder_Dry_Run.md
    - Implementation_Log.md
    - Implementation_Log.md.bak
    - Sprint_Plan.md
    - Test_Report.md
  - Sprint_002
    - Acceptance_Report.md
    - Builder_Dry_Run.md
    - Implementation_Log.md
    - Sprint_Plan.md
    - Test_Report.md
```

---

## 7. Change Budget & Execution Rules
- Limit implementation: Max 5 files modified, max 2 files created, max 500 lines changed.
- Exceeding limits requires immediate STOP and explanation to Governance/Open_Questions.md.
- A Builder MUST NOT immediately generate code. A Dry Run is required first.
