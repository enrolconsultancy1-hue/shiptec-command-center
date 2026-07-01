import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { artifactExists, readArtifactText, readArtifactTextIfExists, writeArtifact, writeArtifactIfMissing } from "./artifactStore.js";
import { badRequest, notFound } from "./errors.js";
import { FolderTreeNode, ProjectLifecycleStatus, ProjectRecord, ProjectScan, SprintAcceptanceInput, SprintAcceptanceResult, SprintArtifacts, SprintRecord, ValidationReport } from "./types.js";
import { intakeSchema } from "./schemas/intakeSchema.js";
import { saveProject, findProject, readProjects } from "./projectStore.js";
import { commitSprint, pushSprint, gitStatus, setupRemoteRepository } from "./gitService.js";
import { calculateHealth } from "./health.js";
import { useFirestoreBackend } from "./firebase.js";
import {
  acceptanceCriteriaTemplate,
  acceptanceReportTemplate,
  architectPackTemplate,
  builderDryRunTemplate,
  currentStateTemplate,
  decisionsTemplate,
  handoffPromptTemplate,
  implementationLogTemplate,
  methodologyGuideTemplate,
  openQuestionsTemplate,
  productRequirementsTemplate,
  requiredProjectFiles,
  risksTemplate,
  sprintPlanTemplate,
  successCriteriaTemplate,
  systemToolsTemplate,
  technicalBlueprintTemplate,
  testReportTemplate,
  userRolesTemplate,
  architectureOverviewTemplate,
  databaseDesignTemplate,
  apiSpecTemplate,
  authTemplate,
  paymentsTemplate,
  securityTemplate,
  frontendTemplate,
  backendTemplate,
  testingTemplate,
  deploymentTemplate,
  userAgreementTemplate,
  privacyPolicyTemplate
} from "./templates.js";
import { validateIntake } from "./validation.js";

const initSchema = z.object({
  rootPath: z.string().min(1).optional(),
  intake: intakeSchema
});

const acceptanceSchema = z.object({
  approvedBy: z.string().min(1),
  summary: z.string().min(1),
  commit: z.boolean().optional().default(false),
  push: z.boolean().optional().default(false)
});

export async function updateCurrentState(project: ProjectRecord): Promise<string> {
  const scan = await scanProject(project);
  const status = await gitStatus(project.rootPath);
  const health = await calculateHealth(scan, status);

  const state = `# Current State
  
  ## Project
  ${project.name}
  
  ## Health Score
  ${health.score}/100
  
  ## Status
  ${health.score >= 90 ? "Healthy" : health.score >= 70 ? "Warning" : "Critical"}
  
  ## Latest Scan
  - Required files: ${scan.missingFiles.length === 0 ? "All present" : `${scan.missingFiles.length} missing`}
  - Git: ${status.isRepo ? (status.clean ? "Clean" : "Changes pending") : "Not a repo"}
  
  ## Recommended Next Actions
  ${health.recommendedActions.map((a: string) => `- ${a}`).join("\n") || "None"}
  
  ## Last Updated
  ${new Date().toISOString()}
  `;


  await writeArtifact(project, "Planning/Governance/Current_State.md", state);
  return state;
}

export async function generateBuilderSpecification(project: ProjectRecord): Promise<string> {
  const architectPack = await readArtifactTextIfExists(project, "Planning/Architect_Pack.md") || "Missing Architect Pack";
  const blueprint = await readArtifactTextIfExists(project, "Planning/Technical_Blueprint.md") || "Missing Technical Blueprint";
  const openQuestions = await readArtifactTextIfExists(project, "Planning/Governance/Open_Questions.md") || "No unresolved open questions.";

  // Get workspace level NEXT_TASK.md
  let nextTask = "No next task defined.";
  try {
    const fs = await import("node:fs/promises");
    nextTask = await fs.readFile(path.join("C:\\Users\\hp\\projects\\Shitec", "NEXT_TASK.md"), "utf8");
  } catch {
    // Fallback to local next task if workspace level is missing
  }

  // Get Repository Snapshot & Git Metadata
  const status = await gitStatus(project.rootPath);
  const branch = status.currentBranch || "master";
  const commitHash = "INITIAL_OR_MOCKED_HASH";

  const fileTree: string[] = [];
  try {
    const fs = await import("node:fs/promises");
    const scanDir = async (dir: string, depth = 0) => {
      if (depth > 2) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".shiptec") continue;
        const fullPath = path.join(dir, entry.name);
        fileTree.push(`${"  ".repeat(depth)}- ${entry.name}`);
        if (entry.isDirectory()) {
          await scanDir(fullPath, depth + 1);
        }
      }
    };
    if (!useFirestoreBackend()) {
      await scanDir(project.rootPath);
    } else {
      fileTree.push("- Firestore Virtual Storage active; no local directory tree.");
    }
  } catch (err) {
    fileTree.push(`- Failed to scan repository: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const generationId = `gen-${Math.random().toString(36).substr(2, 9)}`;
  const spec = `# 📦 SHIPTEC HANDOFF SPEC [V2-OPTIMIZED]
  
## 🆔 METADATA
- ID: ${generationId} | Date: ${new Date().toISOString()}
- Project: ${project.id} | Branch: ${branch} | Hash: ${commitHash}
- Budget: ${project.intake.budget} | Timeline: ${project.intake.timeline}
- Compliance: ${project.intake.compliance}
- Brand: ${project.intake.brandColors} | Typo: ${project.intake.typography}

---

---

## 🎯 SOURCE-OF-TRUTH (SOT) HIERARCHY
1. Technical_Blueprint.md (Hard Constraints)
2. Architect_Pack.md (Intent)
3. NEXT_TASK.md (Immediate Goal)
4. Governance/* (Acceptance/Risks)

*MANDATE: No inventing. If SOT is silent, write to Governance/Open_Questions.md. STOP immediately if constraints are breached.*

---

## 🚀 CURRENT TARGET (NEXT_TASK)
${nextTask}

---

## 🛠 CONTEXT STACK
### [A] Architect Pack
${architectPack}

### [B] Technical Blueprint
${blueprint}

### [C] Unresolved Blockers
${openQuestions}

---

## 📂 REPO SNAPSHOT
\`\`\`text
${fileTree.join("\n")}
\`\`\`

---

## ⚠️ EXECUTION BUDGET & GUARDS
- MOD_LIMIT: Max 5 files modified / 2 files created / 500 lines total.
- FLOW: Dry Run $\rightarrow$ Architect Approval $\rightarrow$ Implementation.
- GUARD: Exceeding budget = IMMEDIATE STOP.
`;

  await writeArtifact(project, "Planning/Builder_Specification.md", spec);
  return spec;
}

export async function initializeProject(input: unknown): Promise<ProjectRecord> {
  const parsed = initSchema.parse(input);
  const id = slugify(parsed.intake.projectName);
  const rootPath = parsed.rootPath
    ? path.resolve(parsed.rootPath)
    : useFirestoreBackend() ? `firestore://projects/${id}` : path.resolve(path.join("projects", id));
  const project: ProjectRecord = {
    id,
    name: parsed.intake.projectName,
    rootPath,
    intake: parsed.intake,
    createdAt: new Date().toISOString(),
    status: "initialized",
    statusUpdatedAt: new Date().toISOString()
  };

  await provisionProjectFiles(project);
  await saveProject(project);

  if (parsed.intake.gitUrl) {
    await setupRemoteRepository(rootPath, parsed.intake.gitUrl);
  }

  return project;
}

/**
 * Update and persist the lifecycle status of a project.
 * My recommendation: always stamp `statusUpdatedAt` so the UI can show
 * a human-readable "since" time next to the button.
 */
export async function updateProjectStatus(
  project: ProjectRecord,
  status: ProjectLifecycleStatus
): Promise<ProjectRecord> {
  const updated: ProjectRecord = {
    ...project,
    status,
    statusUpdatedAt: new Date().toISOString()
  };
  await saveProject(updated);
  return updated;
}

export async function createGitHubRepository(project: ProjectRecord, token: string): Promise<{ url: string; configured: boolean }> {
  const octokit = new Octokit({ auth: token });
  const repoName = project.id;

  try {
    const { data } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: `Shiptec managed project: ${project.name}`
    });
    return { url: data.html_url, configured: true };
  } catch (error) {
    return {
      url: `https://github.com/${process.env.GITHUB_USERNAME || 'user'}/${repoName}`,
      configured: false
    };
  }
}

export async function getProject(projectId: string): Promise<ProjectRecord> {
  const project = await findProject(projectId);
  if (!project) {
    throw notFound(`Unknown Shiptec project: ${projectId}`, { projectId });
  }
  return project;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  return readProjects();
}

export async function provisionProjectFiles(project: ProjectRecord): Promise<void> {
  const intake = project.intake;
  const files: Record<string, string> = {
    "Planning/Architect_Pack.md": architectPackTemplate(intake),
    "Planning/Technical_Blueprint.md": technicalBlueprintTemplate(intake),
    "Planning/Handoff_Prompt.md": handoffPromptTemplate(intake),
    "Planning/Validation_Report.md": reportMarkdown(validateIntake(intake)),
    "Planning/Governance/Current_State.md": currentStateTemplate(intake),
    "Planning/Governance/Decisions.md": decisionsTemplate(),
    "Planning/Governance/Risks.md": risksTemplate(intake),
    "Planning/Governance/Open_Questions.md": openQuestionsTemplate(intake),
    "Planning/Governance/Acceptance_Criteria.md": acceptanceCriteriaTemplate(intake),
    "Sprints/Sprint_001/Sprint_Plan.md": sprintPlanTemplate("Sprint_001"),
    "Sprints/Sprint_001/Builder_Dry_Run.md": builderDryRunTemplate("Sprint_001"),
    "Sprints/Sprint_001/Implementation_Log.md": implementationLogTemplate(),
    "Sprints/Sprint_001/Test_Report.md": testReportTemplate(),
    "Sprints/Sprint_001/Acceptance_Report.md": acceptanceReportTemplate(),
    "Docs/Product_Requirements.md": productRequirementsTemplate(intake),
    "Docs/User_Roles.md": userRolesTemplate(intake),
    "Docs/Methodology_Guide.md": methodologyGuideTemplate(),
    "Docs/System_Tools.md": systemToolsTemplate(intake),
    "Docs/Success_Criteria.md": successCriteriaTemplate(intake),
    "Docs/Architecture/ARCHITECTURE.md": architectureOverviewTemplate(intake),
    "Docs/Architecture/DATABASE.md": databaseDesignTemplate(intake),
    "Docs/Architecture/API_SPEC.md": apiSpecTemplate(intake),
    "Docs/Architecture/AUTH.md": authTemplate(),
    "Docs/Architecture/PAYMENTS.md": paymentsTemplate(),
    "Docs/Architecture/SECURITY.md": securityTemplate(),
    "Docs/Architecture/FRONTEND.md": frontendTemplate(),
    "Docs/Architecture/BACKEND.md": backendTemplate(),
    "Docs/Architecture/TESTING.md": testingTemplate(),
    "Docs/Architecture/DEPLOYMENT.md": deploymentTemplate()
  };

  if (intake.generateLegalDocs) {
    files["Docs/Legal/User_Agreement.md"] = userAgreementTemplate(intake);
    files["Docs/Legal/Privacy_Policy.md"] = privacyPolicyTemplate(intake);
  }

  for (const [relativePath, content] of Object.entries(files)) {
    await writeArtifactIfMissing(project, relativePath, content);
  }
}

export async function scanProject(project: ProjectRecord): Promise<ProjectScan> {
  const files = await Promise.all(requiredProjectFiles.map(async (relativePath) => ({
    path: relativePath,
    exists: await artifactExists(project, relativePath)
  })));
  
  // Check for URL Authorization status
  let authStatus: "pending" | "authorized" | "rejected" = "pending";
  try {
    const authData = await readArtifactTextIfExists(project, "Planning/Governance/Authorized_URLs.json");
    if (authData) {
      const parsed = JSON.parse(authData);
      authStatus = parsed.flagged && parsed.flagged.length > 0 ? "rejected" : "authorized";
    }
  } catch {
    authStatus = "pending";
  }

  return {
    projectId: project.id,
    rootPath: project.rootPath,
    files,
    missingFiles: files.filter((file) => !file.exists).map((file) => file.path),
    authStatus
  };
}

export async function readProjectArtifact(project: ProjectRecord, relativePath: string): Promise<{ path: string; content: string }> {
  if (!isArtifactReadable(relativePath)) {
    throw badRequest(`Artifact is not readable through the command center: ${relativePath}`, {
      allowedPaths: getAllowedArtifactPaths()
    });
  }

  return {
    path: relativePath,
    content: await readArtifactText(project, relativePath)
  };
}

export async function updateProjectArtifact(project: ProjectRecord, relativePath: string, content: string): Promise<string> {
  if (!isArtifactReadable(relativePath)) {
    throw badRequest(`Artifact is not updatable through the command center: ${relativePath}`, {
      allowedPaths: getAllowedArtifactPaths()
    });
  }

  // Backup existing
  const existing = await readArtifactTextIfExists(project, relativePath);
  if (existing) {
    const backupPath = `${relativePath}.bak`;
    await writeArtifact(project, backupPath, existing);
  }

  return writeArtifact(project, relativePath, content);
}

export async function previewArtifactUpdate(project: ProjectRecord, relativePath: string, newContent: string): Promise<{ oldContent: string | null; newContent: string }> {
  if (!isArtifactReadable(relativePath)) {
    throw badRequest(`Artifact is not readable through the command center: ${relativePath}`, {
      allowedPaths: getAllowedArtifactPaths()
    });
  }

  const oldContent = await readArtifactTextIfExists(project, relativePath);
  return {
    oldContent: oldContent ?? null,
    newContent
  };
}

function isArtifactReadable(relativePath: string): boolean {
  // Allow any file within the Sprints/Sprint_XXX/ directory
  if (/^Sprints\/Sprint_\d{3}\/.*\.md$/.test(relativePath)) {
    return true;
  }
  // Allow files within Proposals/Proposal_XXX/ directory
  if (/^Proposals\/Proposal_\d{3}\/.+$/.test(relativePath)) {
    return true;
  }
  return getAllowedArtifactPaths().includes(relativePath);
}

function getAllowedArtifactPaths(): string[] {
  return [
    ...requiredProjectFiles,
    "Sprints/Sprint_001/Acceptance_Report.md",
    "Planning/Governance/Current_State.md",
    "Planning/Governance/Decisions.md",
    "Planning/Governance/Risks.md",
    "Planning/Governance/Open_Questions.md",
    "Planning/Governance/Acceptance_Criteria.md",
    "Sprints/Sprint_001/Sprint_Plan.md",
    "Sprints/Sprint_001/Builder_Dry_Run.md",
    "Sprints/Sprint_001/Implementation_Log.md",
    "Sprints/Sprint_001/Test_Report.md",
    "Planning/Builder_Specification.md",
    "Docs/Architecture/ARCHITECTURE.md",
    "Docs/Architecture/DATABASE.md",
    "Docs/Architecture/API_SPEC.md",
    "Docs/Architecture/AUTH.md",
    "Docs/Architecture/PAYMENTS.md",
    "Docs/Architecture/SECURITY.md",
    "Docs/Architecture/FRONTEND.md",
    "Docs/Architecture/BACKEND.md",
    "Docs/Architecture/TESTING.md",
    "Docs/Architecture/DEPLOYMENT.md"
  ];
}

export async function researchPatterns(project: ProjectRecord, approved: boolean, query?: string): Promise<{ notes: string; source: string }> {
  if (!approved) {
    throw badRequest("Network access not approved for pattern research.");
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      notes: "Researching patterns locally (Network unavailable or token missing):\n\n- Use standard project structure.\n- Leverage TypeScript strict mode.\n- Keep service layer thin.\n- Maintain architectural separation.",
      source: "local-best-practices"
    };
  }

  const octokit = new Octokit({ auth: token });
  const search = await octokit.rest.search.repos({
    q: query || `${project.intake.technicalConstraints.join(" ")}`,
    sort: "stars",
    order: "desc",
    per_page: 3
  });

  const notes = search.data.items
    .map((repo: any) => `- Look at ${repo.html_url} for structure and patterns related to ${project.intake.toolsAndIntegrations.join(", ")}.`)
    .join("\n");

  const finalNotes = `Pattern Research Results:\n\n${notes}\n\n- Avoid direct copying.\n- Adapt patterns to Shiptec's folder structure.`;

  await writeArtifact(project, "Planning/Patterns_Notes.md", finalNotes);

  return { notes: finalNotes, source: "github-search" };
}

export async function validateDryRun(project: ProjectRecord, sprintId: string): Promise<{ status: string; findings: string[] }> {
  const planContent = await readArtifactTextIfExists(project, `Sprints/${sprintId}/Sprint_Plan.md`);
  const dryRunContent = await readArtifactTextIfExists(project, `Sprints/${sprintId}/Builder_Dry_Run.md`);

  if (!planContent || !dryRunContent) {
    return { status: "fail", findings: ["Either Sprint Plan or Builder Dry Run is missing."] };
  }

  const findings: string[] = [];
  let status = "pass";

  const scopeSection = planContent.split("## Scope")[1]?.split("##")[0] || "";
  const opsSection = dryRunContent.split("## Intended File Operations")[1]?.split("##")[0] || "";

  if (!opsSection.trim()) {
    status = "fail";
    findings.push("No intended file operations defined in the Dry Run.");
  } else if (opsSection.length < 20) {
    status = "warning";
    findings.push("Intended file operations are too brief; ensure all scope items are covered.");
  } else {
    // Simple check: ensure some keywords from scope are in the ops section
    const scopeItems = scopeSection.split("\n").filter(l => l.trim().startsWith("-"));
    const matched = scopeItems.filter(item => {
      const keyword = item.replace("-", "").trim().toLowerCase().split(" ")[0];
      return opsSection.toLowerCase().includes(keyword);
    });

    if (matched.length < scopeItems.length / 2) {
      status = "warning";
      findings.push(`Only ${matched.length}/${scopeItems.length} scope items appear to be addressed in the dry run.`);
    }
  }

  if (status === "pass") findings.push("Dry run operations align with sprint scope.");

  return { status, findings };
}

export async function listSprints(project: ProjectRecord): Promise<string[]> {
  const sprintsDir = path.join(project.rootPath, "Sprints");
  try {
    const entries = await import("node:fs/promises").then(fs => fs.readdir(sprintsDir));
    return entries.filter(name => /^Sprint_\d{3}$/.test(name)).sort();
  } catch {
    return [];
  }
}

export async function createSprint(project: ProjectRecord, sprintNumber: number): Promise<SprintRecord> {
  if (!Number.isInteger(sprintNumber) || sprintNumber < 1 || sprintNumber > 999) {
    throw badRequest("Sprint number must be an integer from 1 to 999.", { sprintNumber });
  }

  const sprintId = `Sprint_${String(sprintNumber).padStart(3, "0")}`;
  await writeArtifactIfMissing(project, `Sprints/${sprintId}/Sprint_Plan.md`, sprintPlanTemplate(sprintId));
  await writeArtifactIfMissing(project, `Sprints/${sprintId}/Builder_Dry_Run.md`, builderDryRunTemplate(sprintId));
  await writeArtifactIfMissing(project, `Sprints/${sprintId}/Implementation_Log.md`, implementationLogTemplate());
  await writeArtifactIfMissing(project, `Sprints/${sprintId}/Test_Report.md`, testReportTemplate());
  await writeArtifactIfMissing(project, `Sprints/${sprintId}/Acceptance_Report.md`, acceptanceReportTemplate());
  return {
    sprintId,
    path: path.join(project.rootPath, "Sprints", sprintId),
    createdAt: new Date().toISOString()
  };
}

export async function readSprint(project: ProjectRecord, sprintId: string): Promise<SprintArtifacts> {
  if (!/^Sprint_\d{3}$/.test(sprintId)) {
    throw badRequest("Sprint ID must use the format Sprint_001.", { sprintId });
  }

  const files = [
    "Sprint_Plan.md",
    "Builder_Dry_Run.md",
    "Implementation_Log.md",
    "Test_Report.md",
    "Acceptance_Report.md"
  ];

  const artifacts = await Promise.all(files.map(async (fileName) => {
    const relativePath = `Sprints/${sprintId}/${fileName}`;
    const content = await readArtifactTextIfExists(project, relativePath);
    if (content === undefined) {
      throw notFound(`Sprint artifact is missing: ${relativePath}`, { sprintId, relativePath });
    }

    return {
      path: relativePath,
      content
    };
  }));

  return {
    sprintId,
    path: path.join(project.rootPath, "Sprints", sprintId),
    artifacts
  };
}

export async function acceptSprint(project: ProjectRecord, sprintId: string, input: unknown): Promise<SprintAcceptanceResult> {
  if (!/^Sprint_\d{3}$/.test(sprintId)) {
    throw badRequest("Sprint ID must use the format Sprint_001.", { sprintId });
  }

  const parsed: SprintAcceptanceInput = acceptanceSchema.parse(input);
  const reportRelativePath = `Sprints/${sprintId}/Acceptance_Report.md`;
  const acceptedAt = new Date().toISOString();
  const report = `# Acceptance Report

## Status
accepted

## Sprint
${sprintId}

## Approved By
${parsed.approvedBy}

## Accepted At
${acceptedAt}

## Summary
${parsed.summary}

## Commit Requested
${parsed.commit ? "yes" : "no"}
`;

  const reportPath = await writeArtifact(project, reportRelativePath, report);

  const result: SprintAcceptanceResult = {
    sprintId,
    accepted: true,
    reportPath
  };

  if (parsed.commit && !useFirestoreBackend()) {
    const commit = await commitSprint(project.rootPath, `Accept ${sprintId}: ${parsed.summary}`);
    result.commit = {
      created: Boolean(commit.hash),
      hash: commit.hash,
      message: commit.message
    };

    if (parsed.push) {
      try {
        const push = await pushSprint(project.rootPath);
        result.push = {
          pushed: true,
          message: push.message
        };
      } catch (error) {
        result.push = {
          pushed: false,
          message: `Failed to push: ${error instanceof Error ? error.message : "Unknown error"}`
        };
      }
    }

    const logPath = await updateProjectArtifact(project, `Sprints/${sprintId}/Implementation_Log.md`, `
${new Date().toISOString()} - Commit created (hash: ${commit.hash}), Push ${parsed.push ? "attempted" : "skipped"}${result.push?.pushed ? " (success)" : result.push?.pushed === false ? " (failed)" : ""}`);
    result.logPath = logPath;
  } else if (parsed.commit) {
    result.commit = {
      created: false,
      message: "Local Git commits are disabled for the Firestore backend."
    };
  } else if (parsed.push && !useFirestoreBackend()) {
    try {
      const push = await pushSprint(project.rootPath);
      result.push = {
        pushed: true,
        message: push.message
      };
      const logPath = await updateProjectArtifact(project, `Sprints/${sprintId}/Implementation_Log.md`, `${new Date().toISOString()} - Push ${result.push.pushed ? "success" : "failed"}`);
      result.logPath = logPath;
    } catch (error) {
      result.push = {
        pushed: false,
        message: `Failed to push: ${error instanceof Error ? error.message : "Unknown error"}`
      };
      const logPath = await updateProjectArtifact(project, `Sprints/${sprintId}/Implementation_Log.md`, `${new Date().toISOString()} - Push failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      result.logPath = logPath;
    }
  } else if (parsed.push) {
    result.push = {
      pushed: false,
      message: "Local Git pushes are disabled for the Firestore backend."
    };
  }

  return result;
}

export async function validateProject(project: ProjectRecord): Promise<ValidationReport> {
  const report = validateIntake(project.intake);
  
  // Check for URL Authorization status
  let authStatus: "pending" | "authorized" | "rejected" = "pending";
  let flaggedUrls: string[] = [];
  const skillsUrls = project.intake.skillsUrl || [];
  const knowledgeUrls = project.intake.knowledgeUrl || [];
  const totalUrls = skillsUrls.length + knowledgeUrls.length;
  
  if (totalUrls > 0) {
    try {
      const authData = await readArtifactTextIfExists(project, "Planning/Governance/Authorized_URLs.json");
      if (authData) {
        const parsed = JSON.parse(authData);
        authStatus = parsed.flagged && parsed.flagged.length > 0 ? "rejected" : "authorized";
        flaggedUrls = parsed.flagged || [];
      }
    } catch {
      authStatus = "pending";
    }

    if (authStatus === "pending") {
      report.findings.push({
        status: "warning",
        field: "urlAuthorization",
        message: `URL Authorization scan is pending. Run URL scan to verify safety for ${totalUrls} configured URL(s).`
      });
      if (report.status === "pass") {
        report.status = "warning";
      }
    } else if (authStatus === "rejected") {
      report.findings.push({
        status: "fail",
        field: "urlAuthorization",
        message: `SkillSpector flagged security risks in the following URL(s): ${flaggedUrls.join(", ")}. Please review or replace them.`
      });
      report.status = "fail";
    } else if (authStatus === "authorized") {
      report.findings.push({
        status: "pass",
        field: "urlAuthorization",
        message: `All ${totalUrls} URL(s) scanned and authorized by SkillSpector.`
      });
    }
  }

  return report;
}

export async function updateValidationReport(project: ProjectRecord, report?: ValidationReport): Promise<string> {
  const finalReport = report || await validateProject(project);
  const markdown = reportMarkdown(finalReport);
  await writeArtifact(project, "Planning/Validation_Report.md", markdown);
  return markdown;
}

export async function syncTestReportFromLog(project: ProjectRecord, sprintId: string): Promise<string> {
  const logContent = await readArtifactTextIfExists(project, `Sprints/${sprintId}/Implementation_Log.md`);
  if (!logContent) {
    throw notFound(`Implementation log not found for sprint: ${sprintId}`);
  }

  const lines = logContent.split("\n");
  const reportLines = ["# Test Report", "", "## Summary", ""];
  
  let passed = 0;
  let failed = 0;

  for (const line of lines) {
    if (line.includes("- STATUS: pass")) {
      passed++;
      const task = line.split("- TASK:")[1]?.split("- STATUS:")[0]?.trim() || line;
      reportLines.push(`- [PASS] ${task}`);
    } else if (line.includes("- STATUS: fail")) {
      failed++;
      const task = line.split("- TASK:")[1]?.split("- STATUS:")[0]?.trim() || line;
      reportLines.push(`- [FAIL] ${task}`);
    }
  }

  reportLines.push("", `## Result`, `${passed} passed, ${failed} failed.`);

  const report = reportLines.join("\n");
  await writeArtifact(project, `Sprints/${sprintId}/Test_Report.md`, report);
  return report;
}

function reportMarkdown(report: ReturnType<typeof validateIntake>): string {
  return `# Validation Report

## Status
${report.status}

## Generated At
${report.generatedAt}

## Findings
${report.findings.map((finding) => `- [${finding.status}] ${finding.field}: ${finding.message}`).join("\n")}
`;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shiptec-project";
}

export async function getProjectTree(project: ProjectRecord, maxDepth: number = 8): Promise<FolderTreeNode[]> {
  if (useFirestoreBackend()) {
    return [{ name: project.id, type: "directory", relativePath: ".", children: [{ name: "(Firestore virtual storage)", type: "file", relativePath: "virtual" }] }];
  }

  const IGNORED = new Set(["node_modules", ".git", ".shiptec-handoff", "dist", "coverage"]);

  async function walk(dirPath: string, relativeTo: string, depth: number): Promise<FolderTreeNode[]> {
    if (depth > maxDepth) return [];
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FolderTreeNode[] = [];
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      if (IGNORED.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const children = await walk(fullPath, relativeTo, depth + 1);
        nodes.push({ name: entry.name, type: "directory", relativePath: relPath, children });
      } else {
        let size: number | undefined;
        try {
          const stats = await stat(fullPath);
          size = stats.size;
        } catch { /* ignore */ }
        nodes.push({ name: entry.name, type: "file", relativePath: relPath, size });
      }
    }

    return nodes;
  }

  return walk(project.rootPath, project.rootPath, 0);
}
