import crypto from "node:crypto";
import { ProjectRecord, ExportFormat, TargetEditor, HandoffExportResult } from "./types.js";
import { readProjectArtifact } from "./projectService.js";
import { readmeTemplate, gitignoreTemplate, ciWorkflowTemplate } from "./templates.js";
import path from "node:path";
import fs from "node:fs/promises";
import { ZipArchive } from "archiver";

// ─── File & Agent Specs ──────────────────────────────────────

const ESSENTIAL_ARTIFACTS = [
  "Planning/Architect_Pack.md",
  "Planning/Technical_Blueprint.md",
  "Planning/Builder_Specification.md",
  "Planning/Governance/Acceptance_Criteria.md",
  "Planning/Governance/Current_State.md"
];

interface AgentSpec {
  dir: string;
  files: string[];
  prerequisites: string[];
  outputs: string[];
}

const AGENT_SPECS: AgentSpec[] = [
  {
    dir: "auth_agent",
    files: ["Docs/Architecture/AUTH.md", "Docs/Architecture/SECURITY.md"],
    prerequisites: [],
    outputs: ["Auth middleware", "JWT utilities", "RBAC guards", "Session store"]
  },
  {
    dir: "backend_agent",
    files: ["Docs/Architecture/DATABASE.md", "Docs/Architecture/API_SPEC.md", "Docs/Architecture/BACKEND.md"],
    prerequisites: ["auth_agent"],
    outputs: ["Models/Schemas", "API routes", "Service layer", "DB migrations"]
  },
  {
    dir: "payment_agent",
    files: ["Docs/Architecture/PAYMENTS.md", "Docs/Architecture/DATABASE.md"],
    prerequisites: ["auth_agent", "backend_agent"],
    outputs: ["Payment processor integration", "Webhook handlers", "Invoice model"]
  },
  {
    dir: "frontend_agent",
    files: ["Docs/Architecture/FRONTEND.md", "Docs/Architecture/API_SPEC.md"],
    prerequisites: ["auth_agent", "backend_agent"],
    outputs: ["UI components", "Page views", "API client layer"]
  },
  {
    dir: "devops_agent",
    files: ["Docs/Architecture/DEPLOYMENT.md", "Docs/Architecture/SECURITY.md"],
    prerequisites: [],
    outputs: ["Dockerfile", "CI workflow", "Env templates", "Deploy scripts"]
  },
  {
    dir: "qa_agent",
    files: ["Docs/Architecture/API_SPEC.md", "Docs/Architecture/TESTING.md", "Docs/Architecture/ARCHITECTURE.md"],
    prerequisites: ["auth_agent", "backend_agent", "frontend_agent"],
    outputs: ["Test fixtures", "E2E test suite", "Mock server payloads", "Coverage reports"]
  }
];

// ─── AGENTS.md (DAG orchestrator) ─────────────────────────────

function generateManifestJson(
  project: ProjectRecord,
  editor: TargetEditor,
  allFiles: { path: string; agentTarget?: string }[],
  fileMap: Map<string, string>
): string {
  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: "1.0",
    projectId: project.id,
    projectName: project.name,
    generatedAt: now,
    targetEditor: editor,
    totalFiles: allFiles.length,
    files: allFiles.map(f => {
      const agent = f.agentTarget || "root";
      const content = fileMap.get(f.path) || "";
      const checksum = crypto.createHash("sha256").update(content).digest("hex");
      return { 
        path: f.path, 
        type: agent === "root" ? "document" : "agent-spec", 
        agentTarget: agent,
        checksum 
      };
    }),
    agentDag: AGENT_SPECS.map(a => ({
      agent: a.dir,
      prerequisites: a.prerequisites,
      outputs: a.outputs
    }))
  };
  return JSON.stringify(manifest, null, 2);
}

// ─── AGENTS.md (DAG orchestrator) ─────────────────────────────

function generateAgentsDotMd(): string {
  let body = `# AGENTS.md — Builder Orchestration DAG

> Machine-readable execution order for multi-agent handoff packages.
> Agents MUST execute in the topological order defined below.
> An agent MUST NOT begin until ALL its prerequisites have completed.

## Execution Order (Topological Sort)

| Order | Agent | Prerequisites | Outputs |
|---|---|---|---|
`;
  AGENT_SPECS.forEach((a, i) => {
    const prereq = a.prerequisites.length ? a.prerequisites.join(", ") : "—";
    const outputs = a.outputs.join(", ");
    body += `| ${i + 1} | \`${a.dir}\` | ${prereq} | ${outputs} |\n`;
  });

  body += `\n## Dependency Graph Edges\n\`\`\`\n`;
  for (const a of AGENT_SPECS) {
    for (const p of a.prerequisites) {
      body += `  ${p} --> ${a.dir}\n`;
    }
  }
  body += `\`\`\`\n\n## Global Constraints\n`;
  body += `- Max 5 modified files, 2 created files, 500 lines total per agent.\n`;
  body += `- No agent may modify files outside its declared scope.\n`;
  body += `- All code MUST pass \`npm run build\` and \`npm test\` before the agent is considered complete.\n`;
  body += `- Blocking open questions MUST be resolved before implementation begins.\n`;
  return body;
}

// ─── Agent-Specific README ────────────────────────────────────

function generateAgentReadme(agentName: string, spec: AgentSpec): string {
  const prereq = spec.prerequisites.length ? spec.prerequisites.map(p => `- \`${p}\``).join("\n") : "- None";
  const outputs = spec.outputs.map(o => `- ${o}`).join("\n");

  return `# ${agentName} — Agent Context

## Input Files
${spec.files.map(f => `- \`${f}\``).join("\n")}

## Prerequisites (must be complete before start)
${prereq}

## Scope & Deliverables
${outputs}

## Execution Rules
- Read the \`Builder_Specification.md\` in this folder first.
- Read all input files before making any changes.
- Follow the change budget: 5 files max, 500 lines max.
- Run \`npm run build\` && \`npm test\` after implementation.
- Log all changes to \`Implementation_Log.md\` in the parent sprint folder.

## Forbidden Modifications
- Do not modify files outside this agent's input scope.
- Do not invent requirements not present in the input files.
- Do not skip pre-flight validation checks.
`;
}

// ─── Editor Configs ────────────────────────────────────────────

function generateClaudeDotMd(project: ProjectRecord, editor: TargetEditor): string {
  return `# CLAUDE.md — ${project.name}

> Auto-generated by Shiptec Command Center for ${EDITOR_LABELS[editor]}

## Project Overview
${project.intake.productSummary}

## Technical Constraints
${(project.intake.technicalConstraints || []).join("\n")}

## Change Budget
- Max Modified Files: 5
- Max Created Files: 2
- Max Line Change: 500

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`
- Dev: \`npm run dev\`

## Governance
- Read \`Builder_Specification.md\` first
- Read \`Technical_Blueprint.md\` for hard constraints
- Do NOT invent missing requirements — log to Open_Questions.md
- All code must pass \`npm test\` before completion
`;
}

function generateCursorRules(project: ProjectRecord): string {
  return `You are working on ${project.name}.

STACK: Node.js v22, TypeScript, Express.
CONSTRAINTS:
${(project.intake.technicalConstraints || []).map(c => `- ${c}`).join("\n")}

RULES:
- Read Builder_Specification.md before any changes.
- Max 5 files modified, 2 created, 500 lines.
- Do not invent requirements. Log unknowns to Open_Questions.md.
- Run "npm test" after every change batch.
`;
}

function generateAntigravityRules(project: ProjectRecord): string {
  return JSON.stringify({
    project: project.name,
    rules: {
      readBeforeEdit: ["Builder_Specification.md", "Technical_Blueprint.md"],
      budget: { maxFilesModified: 5, maxLines: 500 },
      allowedEdits: "Strictly within agent scope",
      validation: "npm test && npm run build"
    }
  }, null, 2);
}

function generateOpenCodeMd(project: ProjectRecord): string {
  return `# OPENCODE.md — ${project.name}

## Project Context
${project.intake.productSummary}

## Rules for OpenCode Agent
- Always start with a read-only exploration of the codebase.
- Adhere to the file modification boundaries per agent.
- Log unresolved unknowns to \`Open_Questions.md\`.
- After every edit, verify with \`npm test\`.
`;
}

function generateCodexMd(project: ProjectRecord): string {
  return `# CODEX.md — ${project.name}

## Guidelines for OpenAI Codex / Copilot
- Maintain modularity following \`Architecture/ARCHITECTURE.md\`.
- Keep changes atomic (one logical feature per prompt).
- Verify type safety in TypeScript (strict mode).
- Review all generated diffs before applying.
`;
}

// ─── Environment Spec ──────────────────────────────────────────

function generateEnvExample(): string {
  return `# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET=change-me-to-a-random-64-char-string
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/shiptec
DATABASE_SCHEMA=public

# GitHub Integration
GITHUB_TOKEN=
GITHUB_USERNAME=

# Firebase (if using Firestore backend)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Payment Processing (if payment_agent enabled)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
`;
}

function generateEnvSpec(): string {
  return `# ENV_SPEC.md — Environment Variable Reference

## Required Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| \`PORT\` | number | 3000 | HTTP server listen port |
| \`NODE_ENV\` | string | development | Runtime environment |
| \`JWT_SECRET\` | string | — | 64-char random secret for token signing |
| \`JWT_EXPIRES_IN\` | string | 7d | Token expiration duration |
| \`DATABASE_URL\` | string | — | PostgreSQL connection string |
| \`GITHUB_TOKEN\` | string | — | Personal access token for GitHub API |

## Optional Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| \`DATABASE_SCHEMA\` | string | public | Database schema name |
| \`GITHUB_USERNAME\` | string | — | GitHub username for repo creation |
| \`FIREBASE_PROJECT_ID\` | string | — | Firebase project identifier |
| \`STRIPE_SECRET_KEY\` | string | — | Stripe API secret key |
| \`STRIPE_WEBHOOK_SECRET\` | string | — | Stripe webhook signing secret |

## Startup Validation
The server checks these at boot:
1. \`PORT\` — falls back to 3000
2. \`JWT_SECRET\` — must be set in production
3. \`DATABASE_URL\` — must be set in production
`;
}

// ─── Route Table ──────────────────────────────────────────────

function generateRouteTable(): string {
  return `# ROUTE_TABLE.md — API Route Reference

| Method | Endpoint | Auth | Request Body | Response Shape | Status |
|---|---|---|---|---|---|
| GET | /health | No | — | { ok, service } | 200 |
| POST | /projects/init | No | IntakeInput | { project } | 201 |
| GET | /projects | No | — | { projects[] } | 200 |
| GET | /projects/:id/details | No | — | { id, name, folder, intake } | 200 |
| DELETE | /projects/:id | No | — | { success } | 200 |
| GET | /projects/:id/scan | No | — | { scan, health, projectStatus } | 200 |
| GET | /projects/:id/tree | No | — | { projectId, tree } | 200 |
| GET | /projects/:id/graph | No | — | { graph, stats } | 200 |
| POST | /projects/:id/architect-pack | No | — | { project, status, manifest } | 200 |
| POST | /projects/:id/validate | No | — | { report, reportMarkdown } | 200 |
| POST | /projects/:id/sprints | No | { sprintNumber } | { sprint } | 201 |
| GET | /projects/:id/sprints | No | — | { sprints[] } | 200 |
| POST | /projects/:id/sprints/:sid/accept | No | AcceptanceInput | { acceptance } | 200 |
| POST | /projects/:id/builder/apply | No | { sprintId } | { message, changes } | 200 |
| POST | /projects/:id/handoff | No | — | { packagePath, filesIncluded } | 200 |
| POST | /projects/:id/handoff/export | No | { format, editor } | zip / { result } | 200 |
| POST | /projects/:id/authorize-urls | No | — | { success, passed, findings } | 200 |
| GET | /projects/:id/pipeline | No | — | { pipeline } | 200 |

> All endpoints accept \`Content-Type: application/json\`.
> All error responses follow \`{ error: { code, message, details? } }\`.
> Routes are mounted at both root and \`/api\` prefix.
`;
}

// ─── Execution Sequence ───────────────────────────────────────

function generateExecutionSequence(project: ProjectRecord): string {
  return `# EXECUTION_SEQUENCE.md — File Creation Roadmap

> Follow this sequence strictly. Each step depends on the previous.

## Step 1: Foundation (auth_agent)
1. Create \`src/middleware/auth.ts\` — JWT verification middleware
2. Create \`src/utils/jwt.ts\` — Token sign/verify utilities
3. Create \`src/types/auth.ts\` — Auth-related type definitions
4. Run \`npm run build\` && \`npm test\`

## Step 2: Data Layer (backend_agent)
1. Create \`src/models/\` — Data models / schemas
2. Create \`src/repositories/\` — Data access layer
3. Create \`src/migrations/\` — Database migration files
4. Create \`src/services/\` — Business logic services
5. Run \`npm run build\` && \`npm test\`

## Step 3: Payment Integration (payment_agent)
1. Create \`src/services/payment.ts\` — Payment processor wrapper
2. Create \`src/routes/payment.ts\` — Payment webhook routes
3. Create \`src/types/payment.ts\` — Payment type definitions
4. Run \`npm run build\` && \`npm test\`

## Step 4: Frontend (frontend_agent)
1. Create \`public/app.js\` sections — UI components
2. Create \`public/styles.css\` sections — Styling
3. Wire API client calls
4. Run \`npm run build\` && \`npm test\`

## Step 5: Quality Assurance (qa_agent)
1. Create \`tests/fixtures/\` — Test data fixtures
2. Create \`tests/integration/\` — Integration tests
3. Create \`tests/e2e/\` — End-to-end tests
4. Run full suite: \`npm test\`

## Delivery
- Update \`Implementation_Log.md\` after each step.
- Run \`npm run build\` before final commit.
- Verify all acceptance criteria are met.
`;
}

// ─── Main Handoff Package Builder ─────────────────────────────

export async function createHandoffPackage(project: ProjectRecord, editor: TargetEditor = 'antigravity'): Promise<{ packagePath: string; filesIncluded: string[] }> {
  const handoffDir = path.join(project.rootPath, ".shiptec-handoff");

  // Ensure directory exists
  await fs.mkdir(handoffDir, { recursive: true });

  const filesIncluded: string[] = [];

  // ── Essential artifacts ────────────────────────────────────
  for (const artifactPath of ESSENTIAL_ARTIFACTS) {
    try {
      const artifact = await readProjectArtifact(project, artifactPath);
      const destPath = path.join(handoffDir, path.basename(artifactPath));
      await fs.writeFile(destPath, artifact.content);
      filesIncluded.push(artifactPath);
    } catch (e) {
      console.error(`Could not include ${artifactPath} in handoff:`, e);
    }
  }

  // ── HANDOFF_SUMMARY ──────────────────────────────────────
  await fs.writeFile(
    path.join(handoffDir, "HANDOFF_SUMMARY.txt"),
    `Project: ${project.name}\nID: ${project.id}\nGenerated: ${new Date().toISOString()}\nTarget Editor: ${editor}\n\nFiles included for external editor implementation.`
  );
  filesIncluded.push("HANDOFF_SUMMARY.txt");

  // ── Phase 1: MANIFEST.json ────────────────────────────────
  const manifestFiles: { path: string; agentTarget?: string }[] = [
    ...ESSENTIAL_ARTIFACTS.map(p => ({ path: p })),
    { path: "README.md" },
    { path: ".gitignore" },
    { path: ".github/workflows/ci.yml" },
    { path: "HANDOFF_SUMMARY.txt" },
    { path: "MANIFEST.json" },
    { path: "AGENTS.md" },
    { path: "CLAUDE.md" },
    { path: ".cursorrules" },
    { path: ".antigravityrules" },
    { path: "OPENCODE.md" },
    { path: "CODEX.md" },
    { path: ".env.example" },
    { path: "ENV_SPEC.md" },
    { path: "ROUTE_TABLE.md" },
    { path: "EXECUTION_SEQUENCE.md" },
    { path: "HANDOFF_GUIDE.md" }
  ];
  for (const spec of AGENT_SPECS) {
    manifestFiles.push({ path: `agents/${spec.dir}/README.md`, agentTarget: spec.dir });
  }

  const manifestJson = generateManifestJson(project, editor, manifestFiles, new Map());
  await fs.writeFile(path.join(handoffDir, "MANIFEST.json"), manifestJson);
  filesIncluded.push("MANIFEST.json");

  // ── Phase 1: AGENTS.md ────────────────────────────────────
  const agentsMd = generateAgentsDotMd();
  await fs.writeFile(path.join(handoffDir, "AGENTS.md"), agentsMd);
  filesIncluded.push("AGENTS.md");

  // ── Phase 1: Editor configs ───────────────────────────────
  const claudeMd = generateClaudeDotMd(project, editor);
  await fs.writeFile(path.join(handoffDir, "CLAUDE.md"), claudeMd);
  filesIncluded.push("CLAUDE.md");

  const cursorRules = generateCursorRules(project);
  await fs.writeFile(path.join(handoffDir, ".cursorrules"), cursorRules);
  filesIncluded.push(".cursorrules");

  const antigravityRules = generateAntigravityRules(project);
  await fs.writeFile(path.join(handoffDir, ".antigravityrules"), antigravityRules);
  filesIncluded.push(".antigravityrules");

  const openCodeMd = generateOpenCodeMd(project);
  await fs.writeFile(path.join(handoffDir, "OPENCODE.md"), openCodeMd);
  filesIncluded.push("OPENCODE.md");

  const codexMd = generateCodexMd(project);
  await fs.writeFile(path.join(handoffDir, "CODEX.md"), codexMd);
  filesIncluded.push("CODEX.md");

  // ── Phase 2: Environment Specs ─────────────────────────────
  const envExample = generateEnvExample();
  await fs.writeFile(path.join(handoffDir, ".env.example"), envExample);
  filesIncluded.push(".env.example");

  const envSpec = generateEnvSpec();
  await fs.writeFile(path.join(handoffDir, "ENV_SPEC.md"), envSpec);
  filesIncluded.push("ENV_SPEC.md");

  // ── Phase 2: Route Table ──────────────────────────────────
  const routeTable = generateRouteTable();
  await fs.writeFile(path.join(handoffDir, "ROUTE_TABLE.md"), routeTable);
  filesIncluded.push("ROUTE_TABLE.md");

  // ── Phase 4: Execution Sequence ───────────────────────────
  const execSeq = generateExecutionSequence(project);
  await fs.writeFile(path.join(handoffDir, "EXECUTION_SEQUENCE.md"), execSeq);
  filesIncluded.push("EXECUTION_SEQUENCE.md");

  // ── Specialized Agent Sub-Folders ─────────────────────────
  const agentsDir = path.join(handoffDir, "agents");
  await fs.mkdir(agentsDir, { recursive: true });

  for (const spec of AGENT_SPECS) {
    const subAgentDir = path.join(agentsDir, spec.dir);
    await fs.mkdir(subAgentDir, { recursive: true });

    // Include the Builder Specification
    try {
      const specContent = await readProjectArtifact(project, "Planning/Builder_Specification.md");
      await fs.writeFile(path.join(subAgentDir, "Builder_Specification.md"), specContent.content);
    } catch {}

    // Include the agent's input files
    for (const filePath of spec.files) {
      try {
        const artifact = await readProjectArtifact(project, filePath);
        const filename = path.basename(filePath);
        await fs.writeFile(path.join(subAgentDir, filename), artifact.content);
        filesIncluded.push(`${spec.dir}/${filename}`);
      } catch (e) {
        // Skip missing files
      }
    }

    // Include agent README
    const readme = generateAgentReadme(spec.dir, spec);
    await fs.writeFile(path.join(subAgentDir, "README.md"), readme);
    filesIncluded.push(`agents/${spec.dir}/README.md`);

    // Include .env per agent
    await fs.writeFile(path.join(subAgentDir, ".env.example"), generateEnvExample());
    filesIncluded.push(`agents/${spec.dir}/.env.example`);
  }

  // ── Phase 4: QA test fixtures ─────────────────────────────
  const qaFixtureDir = path.join(agentsDir, "qa_agent", "fixtures");
  await fs.mkdir(qaFixtureDir, { recursive: true });
  const fixtures = {
    "user-auth.json": JSON.stringify({ email: "test@example.com", password: "test-password", token: "jwt-placeholder" }, null, 2),
    "api-response.json": JSON.stringify({ ok: true, data: { id: "demo-id", name: "Demo" }, timestamp: new Date().toISOString() }, null, 2),
    "mock-payload.json": JSON.stringify({ method: "POST", path: "/projects/init", body: { projectName: "test" } }, null, 2)
  };
  for (const [fname, content] of Object.entries(fixtures)) {
    await fs.writeFile(path.join(qaFixtureDir, fname), content);
    filesIncluded.push(`agents/qa_agent/fixtures/${fname}`);
  }

  // ── HANDOFF_GUIDE.md ──────────────────────────────────────
  const handoffGuideContent = generateEditorGuide(project, editor);
  await fs.writeFile(path.join(handoffDir, "HANDOFF_GUIDE.md"), handoffGuideContent);
  filesIncluded.push("HANDOFF_GUIDE.md");

  return {
    packagePath: handoffDir,
    filesIncluded
  };
}

// ─── Editor Labels ────────────────────────────────────────────

const EDITOR_LABELS: Record<TargetEditor, string> = {
  antigravity: "Google Antigravity",
  opencode: "Open Code",
  codex: "OpenAI Codex CLI",
  claudecode: "Claude Code",
  cursor: "Cursor"
};

// ─── HANDOFF_GUIDE.md Generator ──────────────────────────────

function generateEditorGuide(project: ProjectRecord, editor: TargetEditor): string {
  const header = `# SHIPTEC HANDOFF GUIDE — ${EDITOR_LABELS[editor]}

> **Optimized for ${EDITOR_LABELS[editor]}**
> This directory contains a fully governed Architect Handoff package.
> Do not deviate from these files.

---

## PACKAGE CONTENTS

| File | Purpose |
|------|---------|
| \`Architect_Pack.md\` | User's product vision, MVP definitions, target users |
| \`Technical_Blueprint.md\` | Tech stack, constraints, rules, custom skills |
| \`Builder_Specification.md\` | Master instruction set, file tree snapshot |
| \`Acceptance_Criteria.md\` | Definition of done per feature |
| \`Current_State.md\` | Latest health score and project status |
| \`MANIFEST.json\` | Machine-readable file inventory with agent DAG |
| \`AGENTS.md\` | DAG execution order for multi-agent builds |
| \`CLAUDE.md\` | Claude Code project conventions file |
| \`.cursorrules\` | Cursor editor rules file |
| \`.antigravityrules\` | Antigravity engine configuration |
| \`OPENCODE.md\` | OpenCode agent guidelines |
| \`CODEX.md\` | Codex/Copilot workspace configuration |
| \`.env.example\` | Environment variable template |
| \`ENV_SPEC.md\` | Environment variable reference |
| \`ROUTE_TABLE.md\` | API endpoint reference |
| \`EXECUTION_SEQUENCE.md\` | File-by-file creation roadmap |
| \`HANDOFF_GUIDE.md\` | This file — editor-specific execution instructions |

---

## EXECUTION PROTOCOL

### Step 1 — Load Context (Read These First)
1. **\`Builder_Specification.md\`**
2. **\`Architect_Pack.md\`**
3. **\`Technical_Blueprint.md\`**

### Step 2 — Read Orchestration Files
- **\`AGENTS.md\`** — Understand the dependency graph and agent order.
- **\`EXECUTION_SEQUENCE.md\`** — Follow the file-by-file roadmap.
- **\`ROUTE_TABLE.md\`** — Reference the API contract.

### Step 3 — Configure Environment
- Copy \`.env.example\` to \`.env\` and fill in values.
- Refer to \`ENV_SPEC.md\` for variable descriptions.

### Step 4 — Leverage Anchored Knowledge
- **Verified Skills Reference:** ${project.intake.skillsUrl || "None"}
- **Reference Projects:** ${project.intake.knowledgeUrl || "None"}

### Step 5 — Change Budget
| Metric | Limit |
|--------|-------|
| Max Modified Files | 5 |
| Max Created Files | 2 |
| Max Line Change | 500 lines |

`;

  const editorInstructions = getEditorSpecificInstructions(editor);

  const footer = `

---

### Step 7 — Implementation Flow
1. **Review AGENTS.md** for execution order.
2. **Start with the first agent** that has no prerequisites.
3. **Dry Run first** — list intended file edits before executing.
4. **Execute** — edit files per agent scope only.
5. **Validate** — \`npm run build\` && \`npm test\` after each agent.
6. **Proceed to next agent** in DAG order.

---

*Handoff generated by Shiptec Command Center — optimized for ${EDITOR_LABELS[editor]}.*
`;

  return header + editorInstructions + footer;
}

function getEditorSpecificInstructions(editor: TargetEditor): string {
  switch (editor) {
    case "antigravity":
      return `### Step 6 — Antigravity-Specific Workflow

> **Tool Patterns:**
> - Use \`view_file\` to read each artifact before making any changes.
> - Use \`grep_search\` to find existing patterns in the codebase before editing.
> - Use \`replace_file_content\` for single-block edits.
> - Use \`multi_replace_file_content\` for non-contiguous edits.
> - Use \`run_command\` to execute tests and build verification.

> **Subagent Delegation:**
> - Use \`invoke_subagent\` with \`research\` type for codebase exploration.
> - Use \`define_subagent\` for specialized parallel work.

> **Planning Mode:**
> - Create an \`implementation_plan.md\` artifact before major changes.
> - Track progress with a \`task.md\` checklist.`;
    case "claudecode":
      return `### Step 6 — Claude Code-Specific Workflow

> **Tool Patterns:**
> - Use \`Read\` to load each artifact file into context.
> - Use \`Write\` for creating new files, \`Edit\` for modifying existing ones.
> - Use \`Bash\` to execute: \`npm test\`, \`npm run build\`.

> **Memory Management:**
> - Use \`/compact\` when context gets large.
> - The bundled \`CLAUDE.md\` in this folder is auto-read by Claude Code.

> **Conventions:**
> - Respect the existing \`.gitignore\` and code style.
> - Prefer targeted edits over full file rewrites.`;
    case "cursor":
      return `### Step 6 — Cursor-Specific Workflow

> **Composer Workflow:**
> - Open Composer (Ctrl+I) and paste \`Builder_Specification.md\` as primary context.
> - Reference files with \`@file\` mentions.
> - Use \`@codebase\` to search full project.

> **Rules Configuration:**
> - The bundled \`.cursorrules\` will be auto-detected by Cursor.
> - Pin the Builder Specification as always-included context.

> **Best Practices:**
> - Use multi-file edits in Composer for coordinated changes.
> - Review diffs carefully before accepting.`;
    case "opencode":
      return `### Step 6 — Open Code-Specific Workflow

> **Terminal-First Approach:**
> - Provide the Builder Specification content directly in your prompt.
> - Use file references to include additional context.

> **Configuration:**
> - Create an \`opencode.json\` config with model preferences.
> - Set working directory to the project root.

> **Execution Pattern:**
> - Start with read-only exploration.
> - Make targeted edits following the change budget.
> - Use shell commands for testing: \`npm test\`, \`npm run build\`.`;
    case "codex":
      return `### Step 6 — Codex CLI-Specific Workflow

> **Sandboxed Execution:**
> - Ensure all dependencies are installed: \`npm install\` before starting.
> - Use \`--suggest\` for review-first workflow.

> **AGENTS.md Convention:**
> - Codex will automatically read and follow \`AGENTS.md\` directives.

> **Patch-Based Workflow:**
> - Codex produces patch-style diffs — review each before applying.
> - Keep changes atomic: one logical change per prompt.`;
  }
}

// ─── Export Functions ───────────────────────────────────────

async function collectHandoffFiles(project: ProjectRecord, editor: TargetEditor): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  // Essential artifacts
  for (const artifactPath of ESSENTIAL_ARTIFACTS) {
    try {
      const artifact = await readProjectArtifact(project, artifactPath);
      files.set(path.basename(artifactPath), artifact.content);
    } catch (e) {
      console.error(`Could not include ${artifactPath} in export:`, e);
    }
  }

  // Summary
  files.set("HANDOFF_SUMMARY.txt",
    `Project: ${project.name}\nID: ${project.id}\nGenerated: ${new Date().toISOString()}\nTarget Editor: ${EDITOR_LABELS[editor]}\n\nFiles included for external editor implementation.`
  );

  // Generated orchestration files
  const allFiles = [
    ...ESSENTIAL_ARTIFACTS.map(p => ({ path: p })),
    { path: "README.md" }, { path: ".gitignore" }, { path: ".github/workflows/ci.yml" },
    { path: "HANDOFF_SUMMARY.txt" }, { path: "MANIFEST.json" }, { path: "AGENTS.md" },
    { path: "CLAUDE.md" }, { path: ".cursorrules" }, { path: ".antigravityrules" },
    { path: "OPENCODE.md" }, { path: "CODEX.md" }, { path: ".env.example" },
    { path: "ENV_SPEC.md" }, { path: "ROUTE_TABLE.md" }, { path: "EXECUTION_SEQUENCE.md" },
    { path: "HANDOFF_GUIDE.md" }
  ];

  files.set("MANIFEST.json", generateManifestJson(project, editor, allFiles, files));
  files.set("AGENTS.md", generateAgentsDotMd());
  files.set("CLAUDE.md", generateClaudeDotMd(project, editor));
  files.set(".cursorrules", generateCursorRules(project));
  files.set(".antigravityrules", generateAntigravityRules(project));
  files.set("OPENCODE.md", generateOpenCodeMd(project));
  files.set("CODEX.md", generateCodexMd(project));
  files.set(".env.example", generateEnvExample());
  files.set("ENV_SPEC.md", generateEnvSpec());
  files.set("ROUTE_TABLE.md", generateRouteTable());
  files.set("EXECUTION_SEQUENCE.md", generateExecutionSequence(project));
  files.set("HANDOFF_GUIDE.md", generateEditorGuide(project, editor));

  // Repository root artifacts
  files.set("README.md", readmeTemplate(project.intake));
  files.set(".gitignore", gitignoreTemplate());
  files.set(".github/workflows/ci.yml", ciWorkflowTemplate());

  return files;
}

export async function exportHandoffPackage(
  project: ProjectRecord,
  format: ExportFormat,
  editor: TargetEditor,
  destinationPath?: string
): Promise<{ result: HandoffExportResult; zipBuffer?: Buffer }> {
  const files = await collectHandoffFiles(project, editor);
  const filesIncluded = Array.from(files.keys());

  if (format === "folder") {
    const destDir = destinationPath || path.join(project.rootPath, `.shiptec-handoff-${editor}`);
    await fs.mkdir(destDir, { recursive: true });

    for (const [filename, content] of files) {
      const filePath = path.join(destDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content);
    }

    return {
      result: { format, editor, filesIncluded, destinationPath: destDir }
    };
  }

  // ZIP
  const zipBuffer = await createZipBuffer(files, project.name, editor);

  return {
    result: { format, editor, filesIncluded },
    zipBuffer
  };
}

function createZipBuffer(files: Map<string, string>, projectName: string, editor: TargetEditor): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = new ZipArchive({ zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    const folderName = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}-handoff-${editor}`;

    for (const [filename, content] of files) {
      archive.append(content, { name: `${folderName}/${filename}` });
    }

    archive.finalize();
  });
}