import { Router } from "express";
import { z } from "zod";
import { badRequest, conflict } from "./errors.js";
import { calculateHealth } from "./health.js";
import { ensureGitRepository, githubConfigStatus, gitStatus } from "./gitService.js";
import { acceptSprint, createGitHubRepository, createSprint, generateBuilderSpecification, getProject, getProjectTree, initializeProject, listProjects, listSprints, previewArtifactUpdate, readProjectArtifact, readSprint, researchPatterns, scanProject, syncTestReportFromLog, updateCurrentState, updateProjectArtifact, updateProjectStatus, updateValidationReport, validateDryRun, validateProject } from "./projectService.js";
import { authorizeUrls } from "./skillSpectorService.js";
import { applyBuilderSpecification } from "./builderService.js";
import { createHandoffPackage, exportHandoffPackage } from "./handoffService.js";
import { refineArtifact } from "./refinementService.js";
import { validateIntake } from "./validation.js";
import type { ExportFormat, TargetEditor } from "./types.js";
import { generateProposal, listProposals, readProposal } from "./services/proposalService.js";
// readProposal is used directly in the export route to enforce the Confidence Gate.
import { exportProposal } from "./services/proposalExportService.js";

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
    
    response.json({
      scan,
      health,
      projectStatus: {
        status: project.status ?? "initialized",
        statusUpdatedAt: project.statusUpdatedAt ?? project.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/tree", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const tree = await getProjectTree(project);
    response.json({ projectId: project.id, tree });
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


import { generateProjectGraph } from "./services/graphService.js";

router.get("/projects/:id/graph", async (request, response, next) => {
  try {
    const { nodes, edges, stats } = await generateProjectGraph(request.params.id);
    response.json({ graph: { nodes, edges }, stats });
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
    const report = await validateProject(project);
    const reportMarkdown = await updateValidationReport(project, report);
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

router.get("/projects/:id/sprints", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const sprints = await listSprints(project);
    response.json({ sprints });
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

router.post("/projects/:id/authorize-urls", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const result = await authorizeUrls(project);
    response.json({ ...result, message: "URL Authorization scan complete. Library updated." });
  } catch (error) {
    next(error);
  }
});

router.post("/projects/:id/sprints/:sprintId/accept", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const acceptance = await acceptSprint(project, request.params.sprintId, request.body);
    // My recommendation: stamp in_progress on every accepted sprint so the
    // button always reflects that real sprint work has been acknowledged.
    await updateProjectStatus(project, "in_progress");
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
    // My recommendation: treat handoff creation as a terminal lifecycle event
    // and persist it immediately so any subsequent scan reflects 'handed_over'.
    await updateProjectStatus(project, "handed_over");
    response.json({ ...result, message: "Handoff package created in .shiptec-handoff folder." });
  } catch (error) {
    next(error);
  }
});

const exportBodySchema = z.object({
  format: z.enum(["zip", "folder"]),
  editor: z.enum(["antigravity", "opencode", "codex", "claudecode", "cursor"]),
  destinationPath: z.string().optional()
});

router.post("/projects/:id/handoff/export", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const body = exportBodySchema.parse(request.body);

    const { result, zipBuffer } = await exportHandoffPackage(
      project,
      body.format as ExportFormat,
      body.editor as TargetEditor,
      body.destinationPath
    );

    await updateProjectStatus(project, "handed_over");

    if (body.format === "zip" && zipBuffer) {
      const filename = `${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-handoff-${body.editor}.zip`;
      response.setHeader("Content-Type", "application/zip");
      response.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      response.setHeader("Content-Length", zipBuffer.length);
      response.end(zipBuffer);
    } else {
      response.json({ ...result, message: `Handoff package exported as folder to ${result.destinationPath}` });
    }
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

router.post("/projects/:id/proposals/generate", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const proposal = await generateProposal(project);
    response.status(201).json({ proposal });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/proposals", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const proposals = await listProposals(project);
    response.json({ proposals });
  } catch (error) {
    next(error);
  }
});

router.get("/projects/:id/proposals/:proposalId", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const proposal = await readProposal(project, request.params.proposalId);
    response.json({ proposal });
  } catch (error) {
    next(error);
  }
});

const proposalExportBodySchema = z.object({
  format: z.enum(["pdf", "docx", "xlsx", "pptx", "html", "csv", "rtf", "odp", "google-sheets"]),
  options: z.object({
    brandColors: z.string().optional(),
    typography: z.string().optional(),
    includeAppendices: z.boolean().optional(),
    googleCredentials: z.object({
      type: z.enum(["service_account", "oauth2"]),
      keyFilePath: z.string().optional(),
      accessToken: z.string().optional()
    }).optional(),
    shareWith: z.array(z.string().email()).optional(),
    /** Explicit opt-in to export a DRAFT proposal despite blocking assumptions. */
    force: z.boolean().optional()
  }).optional()
});

router.post("/projects/:id/proposals/:proposalId/export", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const body = proposalExportBodySchema.parse(request.body);
    const force = body.options?.force === true;

    // Confidence Gate: refuse to produce a funder-facing document while
    // funder-critical business data is still ASSUMED, unless the caller
    // explicitly opts in with options.force (acknowledging it is a DRAFT).
    const proposal = await readProposal(project, request.params.proposalId);
    if (proposal.confidence.status === "blocked" && !force) {
      throw conflict(
        "Proposal is DRAFT: unresolved blocking assumptions prevent export.",
        {
          readiness: proposal.metadata.readiness,
          blockingAssumptionIds: proposal.confidence.blockingAssumptionIds,
          reasons: proposal.confidence.reasons,
          resolution: "Resolve the blocking assumptions and regenerate, or re-send the request with options.force=true to export an explicitly-labelled DRAFT."
        }
      );
    }

    const result = await exportProposal(project, request.params.proposalId, body.format as any, body.options);

    if (result.url) {
      response.json({ url: result.url, filename: result.filename });
    } else if (result.buffer) {
      response.setHeader("Content-Type", result.mimeType);
      response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      response.setHeader("Content-Length", result.buffer.length);
      response.end(result.buffer);
    } else {
      response.setHeader("Content-Type", result.mimeType);
      response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      response.end(result.content);
    }
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

router.post("/projects/:id/artifacts/refine", async (request, response, next) => {
  try {
    const project = await getProject(request.params.id);
    const artifactPath = String(request.body.path ?? "");
    const vibe = String(request.body.vibe ?? "");
    
    if (!artifactPath || !vibe) {
      throw badRequest("Artifact path and Vibe prompt are required.");
    }
    
    await refineArtifact(project, artifactPath, vibe);
    // Auto-trigger re-compile
    await generateBuilderSpecification(project);
    
    response.json({ message: "Refinement applied and specification re-compiled." });
  } catch (error) {
    next(error);
  }
});
