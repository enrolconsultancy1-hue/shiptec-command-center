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
