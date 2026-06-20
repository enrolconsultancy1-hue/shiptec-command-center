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
