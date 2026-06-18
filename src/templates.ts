import { IntakeInput } from "./types.js";

export const requiredProjectFiles = [
  "Planning/Architect_Pack.md",
  "Planning/Technical_Blueprint.md",
  "Planning/Handoff_Prompt.md",
  "Planning/Validation_Report.md",
  "Planning/Governance/Current_State.md",
  "Planning/Governance/Decisions.md",
  "Planning/Governance/Risks.md",
  "Planning/Governance/Open_Questions.md",
  "Planning/Governance/Acceptance_Criteria.md",
  "Sprints/Sprint_001/Sprint_Plan.md",
  "Sprints/Sprint_001/Builder_Dry_Run.md",
  "Sprints/Sprint_001/Implementation_Log.md",
  "Sprints/Sprint_001/Test_Report.md",
  "Sprints/Sprint_001/Acceptance_Report.md",
  "Docs/Product_Requirements.md",
  "Docs/User_Roles.md",
  "Docs/Methodology_Guide.md",
  "Docs/System_Tools.md",
  "Docs/Success_Criteria.md"
] as const;

const list = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join("\n") : "- TBD";

export function productRequirementsTemplate(intake: IntakeInput): string {
  return `# Product Requirements

## Project
${intake.projectName}

## Product Summary
${intake.productSummary}

## Business Problem
${intake.businessProblem}

## MVP Definition
${intake.mvpDefinition}

## Current Workflow
${intake.currentWorkflow}

## Desired Workflow
${intake.desiredWorkflow}
`;
}

export function userRolesTemplate(intake: IntakeInput): string {
  return `# User Roles

## Target Users
${list(intake.targetUsers)}
`;
}

export function successCriteriaTemplate(intake: IntakeInput): string {
  return `# Success Criteria

${list(intake.successCriteria)}
`;
}

export function methodologyGuideTemplate(): string {
  return `# Methodology Guide

Shiptec uses a strict Architect-Builder split.

## Architect
- Captures requirements.
- Creates explicit blueprints.
- Defines acceptance criteria.
- Reviews Builder output.

## Builder
- Reads the source-of-truth planning files.
- Produces a dry run before edits.
- Implements only approved sprint scope.
- Records checks, results, and acceptance status.
`;
}

export function systemToolsTemplate(intake: IntakeInput): string {
  return `# System Tools

## Required Tools and Integrations
${list(intake.toolsAndIntegrations)}

## Technical Constraints
${list(intake.technicalConstraints)}
`;
}

export function architectPackTemplate(intake: IntakeInput): string {
  return `# Architect Pack

## Product Intent
${intake.productSummary}

## Business Problem
${intake.businessProblem}

## Users and Roles
${list(intake.targetUsers)}

## Future Workflow
${intake.desiredWorkflow}

## MVP Scope
${intake.mvpDefinition}

## Success Criteria
${list(intake.successCriteria)}

## Integrations
${list(intake.toolsAndIntegrations)}

## Constraints
${list(intake.technicalConstraints)}

## Risks
${list(intake.knownRisks)}

## Open Questions
${list(intake.openQuestions)}
`;
}

export function technicalBlueprintTemplate(intake: IntakeInput): string {
  return `# Technical Blueprint

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
${list(intake.technicalConstraints)}
`;
}

export function handoffPromptTemplate(intake: IntakeInput): string {
  return `# Handoff Prompt

You are the Builder for ${intake.projectName}.

Before editing files, read:
- Planning/Architect_Pack.md
- Planning/Technical_Blueprint.md
- Planning/Governance/Acceptance_Criteria.md
- Planning/Governance/Current_State.md
- Planning/Governance/Decisions.md
- Planning/Governance/Risks.md
- Planning/Governance/Open_Questions.md

Produce a Builder Dry Run and Sprint Plan before implementation. Do not invent missing requirements.
`;
}

export function currentStateTemplate(intake: IntakeInput): string {
  return `# Current State

## Status
Initialized from structured intake.

## Product
${intake.projectName}

## Last Updated
${new Date().toISOString()}
`;
}

export function decisionsTemplate(): string {
  return `# Decisions

| Date | Decision | Rationale | Owner |
| --- | --- | --- | --- |
| TBD | Initial architecture uses TypeScript and Express. | Matches Shiptec default stack. | Architect |
`;
}

export function risksTemplate(intake: IntakeInput): string {
  return `# Risks

${list(intake.knownRisks)}
`;
}

export function openQuestionsTemplate(intake: IntakeInput): string {
  return `# Open Questions

${list(intake.openQuestions)}
`;
}

export function acceptanceCriteriaTemplate(intake: IntakeInput): string {
  return `# Acceptance Criteria

${list(intake.successCriteria)}
`;
}

export function sprintPlanTemplate(sprintId: string): string {
  return `# ${sprintId} Sprint Plan

## Goal
Deliver the first validated vertical slice.

## Scope
- Confirm planning source files exist.
- Create or update Builder Dry Run.
- Implement approved functionality only.
- Run available checks.

## Out of Scope
- Unapproved feature expansion.
- Silent overwrites of user-authored files.
`;
}

export function builderDryRunTemplate(sprintId: string): string {
  return `# ${sprintId} Builder Dry Run

## Files To Read First
- Planning/Architect_Pack.md
- Planning/Technical_Blueprint.md
- Planning/Governance/Acceptance_Criteria.md
- Planning/Governance/Current_State.md
- Planning/Governance/Decisions.md
- Planning/Governance/Risks.md
- Planning/Governance/Open_Questions.md

## Intended File Operations
- Create missing implementation files for approved sprint scope.
- Update implementation and test logs after checks run.

## Pre-Flight Checklist
- Validation report is not fail.
- Acceptance criteria are specific.
- Blocking open questions are resolved or explicitly marked non-blocking.
`;
}

export function implementationLogTemplate(): string {
  return `# Implementation Log

No implementation work has been recorded yet.
`;
}

export function testReportTemplate(): string {
  return `# Test Report

No tests have been run for this sprint yet.
`;
}

export function acceptanceReportTemplate(): string {
  return `# Acceptance Report

Acceptance review is pending.
`;
}
