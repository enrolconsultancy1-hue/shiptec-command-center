import { Router } from "express";
import { z } from "zod";
import { badRequest } from "./errors.js";
import { calculateHealth } from "./health.js";
import { ensureGitRepository, githubConfigStatus, gitStatus } from "./gitService.js";
import { acceptSprint, createGitHubRepository, createSprint, generateBuilderSpecification, getProject, initializeProject, listProjects, previewArtifactUpdate, readProjectArtifact, readSprint, researchPatterns, scanProject, syncTestReportFromLog, updateCurrentState, updateProjectArtifact, updateValidationReport, validateDryRun } from "./projectService.js";
import { applyBuilderSpecification } from "./builderService.js";
import { createHandoffPackage } from "./handoffService.js";
import { validateIntake } from "./validation.js";

export const router = Router();

const sprintBodySchema = z.object({
  sprintNumber: z.coerce.number().int().min(1).max(999).default(1)
}).default({ sprintNumber: 1 });

router.get("/health", (_request, response) => {
  response.json({ ok: true, service: "shiptec-command-center" });
});

router.post("/projects/init", async (request, response, next) => {
  try {
    const project = await initializeProject(request.body);
    response.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

router.get("/projects", async (_request, response, next) => {
  try {
    response.json({ projects: await listProjects() });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/scan", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const scan = await scanProject(project);
    const status = await gitStatus(project.rootPath);
    const health = await calculateHealth(scan, status);
    
    // Auto-update current state whenever a scan is performed
    await updateCurrentState(project);
    
    response.json({ scan, health });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sync-state", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const state = await updateCurrentState(project);
    response.json({ state });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/artifacts", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const artifactPath = String(request.query.path ?? "");
    if (!artifactPath) {
      throw badRequest("Artifact path is required.", { query: "path" });
    }
    const artifact = await readProjectArtifact(project, artifactPath);
    response.json({ artifact });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/artifacts/preview", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const artifactPath = String(request.query.path ?? "");
    const content = String(request.body.content ?? "");
    if (!artifactPath) {
      throw badRequest("Artifact path is required.", { query: "path" });
    }
    const preview = await previewArtifactUpdate(project, artifactPath, content);
    response.json({ preview });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/artifacts/update", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const artifactPath = String(request.query.path ?? "");
    const content = String(request.body.content ?? "");
    if (!artifactPath) {
      throw badRequest("Artifact path is required.", { query: "path" });
    }
    const path = await updateProjectArtifact(project, artifactPath, content);
    response.json({ path });
  } catch (error) {
    next(error);
  }
});



router.post("/projects/:id/intake", async (request, response, next) => {
  try {
    const report = validateIntake(request.body);
    response.json({ report });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/architect-pack", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    response.json({ project, message: "Architect Pack is generated during initialization and preserved unless missing." });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/validate", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const reportMarkdown = await updateValidationReport(project);
    const report = validateIntake(project.intake);
    response.json({ report, reportMarkdown });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sprints", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const body = sprintBodySchema.parse(request.body ?? {});
    const sprint = await createSprint(project, body.sprintNumber);
    response.status(201).json({ sprint });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/sprints/:sprintId", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const sprint = await readSprint(project, request.params.sprintId);
    response.json({ projectId: project.id, sprint });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sprints/:sprintId/sync-report", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const report = await syncTestReportFromLog(project, request.params.sprintId);
    response.json({ report });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sprints/:sprintId/validate-dry-run", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const validation = await validateDryRun(project, request.params.sprintId);
    response.json({ validation });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sprints/:sprintId/accept", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const acceptance = await acceptSprint(project, request.params.sprintId, request.body);
    response.json({ acceptance });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/patterns/research", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const approved = Boolean(request.body.approved);
    const query = request.body.query;
    const result = await researchPatterns(project, approved, query);
    response.json({ result });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/builder/apply", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const sprintId = String(request.body.sprintId ?? "Sprint_002");
    const result = await applyBuilderSpecification(project, sprintId);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/handoff", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const result = await createHandoffPackage(project);
    response.json({ ...result, message: "Handoff package created in .shiptec-handoff folder." });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/specification/generate", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const spec = await generateBuilderSpecification(project);
    response.json({ spec, message: "Builder Specification compiled successfully." });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/builder-dry-run", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const body = sprintBodySchema.parse(request.body ?? {});
    const sprint = await createSprint(project, body.sprintNumber);
    response.status(201).json({ sprint });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/git/status", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    response.json({ status: await gitStatus(project.rootPath), github: githubConfigStatus() });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/github/setup", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    if (!process.env.GITHUB_TOKEN) {
      throw badRequest("GitHub token is not configured.", { env: "GITHUB_TOKEN" });
    }

    const githubConfig = githubConfigStatus();
    if (!githubConfig.configured) {
      throw badRequest(githubConfig.reason || "GitHub is not configured.", { github: githubConfig });
    }

    const result = await createGitHubRepository(project, process.env.GITHUB_TOKEN);
    response.json({ ...result, message: "GitHub repository setup initiated." });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/github/status", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const githubConfig = githubConfigStatus();
    response.json({
      configured: githubConfig.configured,
      reason: githubConfig.reason,
      projectId: project.id
    });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/git/commit", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const status = await ensureGitRepository(project.rootPath);
    response.json({ status, message: "Repository is initialized. Commit creation requires an explicit sprint approval step." });
  } catch (error) {
    next(error);
  }
});
