import { ProjectRecord, ExportFormat, TargetEditor, HandoffExportResult } from "./types.js";
import { readProjectArtifact } from "./projectService.js";
import path from "node:path";
import fs from "node:fs/promises";
import { ZipArchive } from "archiver";

const ESSENTIAL_ARTIFACTS = [
  "Planning/Architect_Pack.md",
  "Planning/Technical_Blueprint.md",
  "Planning/Builder_Specification.md",
  "Planning/Governance/Acceptance_Criteria.md",
  "Planning/Governance/Current_State.md"
];

export async function createHandoffPackage(project: ProjectRecord, editor: TargetEditor = 'antigravity'): Promise<{ packagePath: string; filesIncluded: string[] }> {
  const handoffDir = path.join(project.rootPath, ".shiptec-handoff");
  
  // Ensure directory exists
  await fs.mkdir(handoffDir, { recursive: true });
  
  const filesIncluded: string[] = [];
  
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
  
  // Also include the current state as a summary file
  await fs.writeFile(
    path.join(handoffDir, "HANDOFF_SUMMARY.txt"), 
    `Project: ${project.name}\nID: ${project.id}\nGenerated: ${new Date().toISOString()}\nTarget Editor: ${editor}\n\nFiles included for external editor implementation.`
  );

  // ==========================================
  // Phase 2 - Specialized Agent Sub-Folders
  // ==========================================
  const agentSpecs = {
    "backend_agent": [
      "Docs/Architecture/DATABASE.md",
      "Docs/Architecture/API_SPEC.md",
      "Docs/Architecture/BACKEND.md"
    ],
    "frontend_agent": [
      "Docs/Architecture/FRONTEND.md",
      "Docs/Architecture/API_SPEC.md"
    ],
    "auth_agent": [
      "Docs/Architecture/AUTH.md",
      "Docs/Architecture/SECURITY.md"
    ],
    "payment_agent": [
      "Docs/Architecture/PAYMENTS.md",
      "Docs/Architecture/DATABASE.md"
    ],
    "devops_agent": [
      "Docs/Architecture/DEPLOYMENT.md",
      "Docs/Architecture/SECURITY.md"
    ],
    "qa_agent": [
      "Docs/Architecture/API_SPEC.md",
      "Docs/Architecture/TESTING.md"
    ]
  };

  const agentsDir = path.join(handoffDir, "agents");
  await fs.mkdir(agentsDir, { recursive: true });

  for (const [agentName, filesToCopy] of Object.entries(agentSpecs)) {
    const subAgentDir = path.join(agentsDir, agentName);
    await fs.mkdir(subAgentDir, { recursive: true });

    // Include the general Spec
    try {
      const spec = await readProjectArtifact(project, "Planning/Builder_Specification.md");
      await fs.writeFile(path.join(subAgentDir, "Builder_Specification.md"), spec.content);
    } catch {}

    for (const filePath of filesToCopy) {
      try {
        const artifact = await readProjectArtifact(project, filePath);
        const filename = path.basename(filePath);
        await fs.writeFile(path.join(subAgentDir, filename), artifact.content);
        filesIncluded.push(`${agentName}/${filename}`);
      } catch (e) {
        // Skip missing files
      }
    }
  }

  // Generate the ultimate HANDOFF_GUIDE.md for external AI Editors
  const handoffGuideContent = generateEditorGuide(project, editor);

  await fs.writeFile(
    path.join(handoffDir, "HANDOFF_GUIDE.md"),
    handoffGuideContent
  );
  
  filesIncluded.push("HANDOFF_GUIDE.md");

  return {
    packagePath: handoffDir,
    filesIncluded
  };
}

// ─── Editor-Specific Guide Generators ──────────────────────

const EDITOR_LABELS: Record<TargetEditor, string> = {
  antigravity: "Google Antigravity",
  opencode: "Open Code",
  codex: "OpenAI Codex CLI",
  claudecode: "Claude Code",
  cursor: "Cursor"
};

function generateEditorGuide(project: ProjectRecord, editor: TargetEditor): string {
  const header = `# 🧭 SHIPTEC HANDOFF GUIDE — ${EDITOR_LABELS[editor]}

> **Optimized for ${EDITOR_LABELS[editor]}**
> This directory contains a fully governed Architect Handoff package.
> Do not deviate from these files.

---

## 📋 PACKAGE CONTENTS

| File | Purpose |
|------|---------|
| \`Architect_Pack.md\` | User's product vision, MVP definitions, target users |
| \`Technical_Blueprint.md\` | Tech stack, constraints, rules, custom skills |
| \`Builder_Specification.md\` | Master instruction set, file tree snapshot |
| \`Acceptance_Criteria.md\` | Definition of done per feature |
| \`Current_State.md\` | Latest health score and project status |
| \`HANDOFF_GUIDE.md\` | This file — editor-specific execution instructions |

---

## 🎯 EXECUTION PROTOCOL

### Step 1 — Load Context (Do This First)
Before writing any code, read these files in order:
1. **\`Builder_Specification.md\`** — The master instruction set and file tree snapshot.
2. **\`Architect_Pack.md\`** — The user's product vision and MVP definitions.
3. **\`Technical_Blueprint.md\`** — Stacks, rules, constraints, and custom skills.

### Step 2 — Leverage Anchored Knowledge
- **Verified Skills Reference:** ${project.intake.skillsUrl || "None (Use standard industry patterns)"}
- **Reference Projects:** ${project.intake.knowledgeUrl || "None (Implement directly from constraints)"}

If a GitHub URL is provided above, you MUST prioritize its design patterns, UI styling, and structure.

### Step 3 — Change Budget
| Metric | Limit |
|--------|-------|
| Max Modified Files | 5 |
| Max Created Files | 2 |
| Max Line Change | 500 lines |

`;

  const editorInstructions = getEditorSpecificInstructions(editor);

  const footer = `

---

### Step 5 — Implementation Flow
1. **Dry Run first:** List your intended file edits and explain *how* they solve the target task.
2. **Review:** Present the dry run to the user for approval.
3. **Execute:** Edit the files carefully. Do not write generic or placeholder code.
4. **Validation:** Write or run existing tests to verify that the implementation works 100%.

---

*Handoff generated by Shiptec Command Center — optimized for ${EDITOR_LABELS[editor]}.*
`;

  return header + editorInstructions + footer;
}

function getEditorSpecificInstructions(editor: TargetEditor): string {
  switch (editor) {
    case "antigravity":
      return `### Step 4 — Antigravity-Specific Workflow

> **Tool Usage Patterns:**
> - Use \`view_file\` to read each artifact before making any changes.
> - Use \`grep_search\` to find existing patterns in the codebase before editing.
> - Use \`replace_file_content\` for single-block edits, \`multi_replace_file_content\` for non-contiguous edits.
> - Use \`run_command\` to execute tests and build verification.

> **Subagent Delegation:**
> - For complex tasks, use \`invoke_subagent\` with the \`research\` type to explore the codebase.
> - Use \`define_subagent\` for specialized parallel work (e.g., frontend + backend simultaneously).

> **Planning Mode:**
> - Create an \`implementation_plan.md\` artifact before major changes.
> - Track progress with a \`task.md\` checklist artifact.

\`\`\`
PRIORITY: Read Builder_Specification.md → Plan → Execute → Verify with npm test
\`\`\``;

    case "claudecode":
      return `### Step 4 — Claude Code-Specific Workflow

> **Tool Patterns:**
> - Use \`Read\` to load each artifact file into context.
> - Use \`Write\` for creating new files, \`Edit\` for modifying existing ones.
> - Use \`Bash\` to execute shell commands: \`npm test\`, \`npm run build\`.

> **Memory Management:**
> - Use \`/compact\` when context gets large to summarize progress.
> - Create a \`CLAUDE.md\` file in the project root with project-specific conventions.

> **Conventions:**
> - Respect the existing project's \`.gitignore\` and code style.
> - Prefer targeted edits over full file rewrites.
> - Always verify changes with the test suite before marking complete.

\`\`\`
PRIORITY: Read Builder_Specification.md → Plan → Execute → Verify with npm test
\`\`\``;

    case "cursor":
      return `### Step 4 — Cursor-Specific Workflow

> **Composer Workflow:**
> - Open Composer (Ctrl+I) and paste the \`Builder_Specification.md\` content as the primary context.
> - Reference additional files with \`@file\` mentions: \`@Architect_Pack.md\`, \`@Technical_Blueprint.md\`.
> - Use \`@codebase\` to let Cursor search the full project for relevant patterns.

> **Rules Configuration:**
> - Create a \`.cursorrules\` file in the project root with the Technical Blueprint constraints.
> - Pin the Builder Specification as always-included context.

> **Best Practices:**
> - Use multi-file edits in Composer for coordinated changes.
> - Review diffs carefully in the Composer panel before accepting.
> - Run the integrated terminal for \`npm test\` verification.

\`\`\`
PRIORITY: Paste Builder_Specification.md into Composer → Apply → Verify with npm test
\`\`\``;

    case "opencode":
      return `### Step 4 — Open Code-Specific Workflow

> **Terminal-First Approach:**
> - Open Code operates as a terminal-first AI coding tool.
> - Provide the Builder Specification content directly in your prompt.
> - Use file references to include additional context from the handoff package.

> **Configuration:**
> - Create an \`opencode.json\` config in the project root with model preferences and context settings.
> - Set the working directory to the project root.

> **Execution Pattern:**
> - Start with a read-only exploration phase to understand existing code.
> - Make targeted edits following the change budget.
> - Use shell commands for testing: \`npm test\`, \`npm run build\`.

\`\`\`
PRIORITY: Read Builder_Specification.md → Explore codebase → Execute → Verify with npm test
\`\`\``;

    case "codex":
      return `### Step 4 — Codex CLI-Specific Workflow

> **Sandboxed Execution:**
> - Codex runs in a sandboxed environment by default.
> - Ensure all dependencies are installed: \`npm install\` before starting.
> - Use \`--full-auto\` mode cautiously; prefer \`--suggest\` for review-first workflow.

> **AGENTS.md Convention:**
> - Create an \`AGENTS.md\` file in the project root with the Builder Specification constraints.
> - Codex will automatically read and follow \`AGENTS.md\` directives.

> **Patch-Based Workflow:**
> - Codex produces patch-style diffs — review each before applying.
> - Keep changes atomic: one logical change per prompt.
> - Verify with the test suite after each patch is applied.

\`\`\`
PRIORITY: Create AGENTS.md from Builder_Specification.md → Execute → Verify with npm test
\`\`\``;
  }
}

// ─── Export Function ───────────────────────────────────────

async function collectHandoffFiles(project: ProjectRecord, editor: TargetEditor): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const artifactPath of ESSENTIAL_ARTIFACTS) {
    try {
      const artifact = await readProjectArtifact(project, artifactPath);
      files.set(path.basename(artifactPath), artifact.content);
    } catch (e) {
      console.error(`Could not include ${artifactPath} in export:`, e);
    }
  }

  // Summary file
  files.set("HANDOFF_SUMMARY.txt",
    `Project: ${project.name}\nID: ${project.id}\nGenerated: ${new Date().toISOString()}\nTarget Editor: ${EDITOR_LABELS[editor]}\n\nFiles included for external editor implementation.`
  );

  // Editor-specific guide
  files.set("HANDOFF_GUIDE.md", generateEditorGuide(project, editor));
  
  // Added specialized agent folders logic inside createHandoffPackage,
  // but to keep collectHandoffFiles simple we just use essential files here.
  // The agent-specific folders are handled directly in createHandoffPackage.

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
      await fs.writeFile(path.join(destDir, filename), content);
    }

    return {
      result: {
        format,
        editor,
        filesIncluded,
        destinationPath: destDir
      }
    };
  }

  // ZIP format — create in-memory buffer
  const zipBuffer = await createZipBuffer(files, project.name, editor);

  return {
    result: {
      format,
      editor,
      filesIncluded
    },
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
