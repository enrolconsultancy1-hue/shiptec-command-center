# Shiptec

Shiptec is an AI Software Factory command center that turns raw software ideas into governed implementation plans.

## First Vertical Slice

- TypeScript and Express API scaffold.
- Project initialization from structured intake.
- Required Planning, Governance, Sprints, and Docs folder provisioning.
- Markdown templates for all required operating artifacts.
- Architect Pack generation.
- Validation gate with pass, warning, and fail outcomes.
- Project scan and health scoring.
- Sprint creation with Sprint Plan and Builder Dry Run.
- Local Git initialization through `simple-git`.
- GitHub configuration check through `@octokit/rest`, with graceful missing-token handling.

## Commands

```bash
npm install
npm run dev
npm test
npm run build
```

The API starts on `PORT` or `3000` by default.
