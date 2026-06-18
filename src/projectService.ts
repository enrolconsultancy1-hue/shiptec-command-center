import path from "node:path";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { artifactExists, readArtifactText, readArtifactTextIfExists, writeArtifact, writeArtifactIfMissing } from "./artifactStore.js";
import { badRequest, notFound } from "./errors.js";
import { ProjectRecord, ProjectScan, SprintAcceptanceInput, SprintAcceptanceResult, SprintArtifacts, SprintRecord } from "./types.js";
import { saveProject, findProject, readProjects } from "./projectStore.js";
import { commitSprint, pushSprint } from "./gitService.js";
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
  userRolesTemplate
} from "./templates.js";
import { validateIntake } from "./validation.js";

export const intakeSchema = z.object({
  projectName: z.string().min(1),
  productSummary: z.string().min(1),
  businessProblem: z.string().min(1),
  targetUsers: z.array(z.string().min(1)),
  currentWorkflow: z.string().min(1),
  desiredWorkflow: z.string().min(1),
  toolsAndIntegrations: z.array(z.string()).default([]),
  technicalConstraints: z.array(z.string()).default([]),
  successCriteria: z.array(z.string().min(1)),
  mvpDefinition: z.string().min(1),
  knownRisks: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([])
});

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
    createdAt: new Date().toISOString()
  };

  await provisionProjectFiles(project);
  await saveProject(project);
  return project;
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
    "Docs/Success_Criteria.md": successCriteriaTemplate(intake)
  };

  for (const [relativePath, content] of Object.entries(files)) {
    await writeArtifactIfMissing(project, relativePath, content);
  }
}

export async function scanProject(project: ProjectRecord): Promise<ProjectScan> {
  const files = await Promise.all(requiredProjectFiles.map(async (relativePath) => ({
    path: relativePath,
    exists: await artifactExists(project, relativePath)
  })));

  return {
    projectId: project.id,
    rootPath: project.rootPath,
    files,
    missingFiles: files.filter((file) => !file.exists).map((file) => file.path)
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
    "Sprints/Sprint_001/Test_Report.md"
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

export async function createSprint(project: ProjectRecord, sprintNumber: number): Promise<SprintRecord> {  if (!Number.isInteger(sprintNumber) || sprintNumber < 1 || sprintNumber > 999) {
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

export async function updateValidationReport(project: ProjectRecord): Promise<string> {
  const markdown = reportMarkdown(validateIntake(project.intake));
  await writeArtifact(project, "Planning/Validation_Report.md", markdown);
  return markdown;
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
