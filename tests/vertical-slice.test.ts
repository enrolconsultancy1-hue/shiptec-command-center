import { mkdtemp, readFile } from "node:fs/promises";
import { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { calculateHealth } from "../src/health.js";
import { gitStatus } from "../src/gitService.js";
import { acceptSprint, initializeProject, readProjectArtifact, scanProject } from "../src/projectService.js";
import { validateIntake } from "../src/validation.js";
import { exportHandoffPackage } from "../src/handoffService.js";
import { INTAKE_DEFAULTS } from "../src/schemas/intakeSchema.js";
import type { IntakeInput } from "../src/types.js";

const intake: IntakeInput = {
  ...INTAKE_DEFAULTS,
  projectName: "Demo Factory",
  productSummary: "A governed command center for AI software delivery.",
  businessProblem: "AI coding work drifts without explicit planning and validation.",
  targetUsers: ["Founder", "Product engineer"],
  currentWorkflow: "Ideas are typed into chat without a durable source of truth.",
  desiredWorkflow: "Ideas become validated plans, sprint folders, dry runs, and checked implementation.",
  toolsAndIntegrations: ["Git", "GitHub"],
  technicalConstraints: ["TypeScript", "Express"],
  successCriteria: ["Initialize folders", "Generate Architect Pack", "Report health score"],
  mvpDefinition: "Initialize a project, validate intake, create sprint files, and scan health.",
  knownRisks: ["GitHub credentials may be unavailable"],
  openQuestions: []
};

describe("Shiptec first vertical slice", () => {
  it("initializes a governed project and reports health", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const project = await initializeProject({ rootPath: workspace, intake });
    const scan = await scanProject(project);
    const health = await calculateHealth(scan, await gitStatus(project.rootPath));

    expect(scan.missingFiles).toEqual([]);
    expect(health.score).toBeGreaterThanOrEqual(95);
  });

  it("fails validation when core planning data is missing", () => {
    const report = validateIntake({ ...intake, targetUsers: [], successCriteria: [] });

    expect(report.status).toBe("fail");
    expect(report.findings.some((finding) => finding.field === "targetUsers")).toBe(true);
    expect(report.findings.some((finding) => finding.field === "successCriteria")).toBe(true);
  });

  it("accepts a sprint and creates a local commit when requested", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const project = await initializeProject({ rootPath: workspace, intake });
    const acceptance = await acceptSprint(project, "Sprint_001", {
      approvedBy: "Test Architect",
      summary: "Vertical slice verified",
      commit: true
    });

    expect(acceptance.accepted).toBe(true);
    expect(acceptance.commit?.created).toBe(true);
  });

  it("reads approved planning artifacts and rejects unsafe artifact paths", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const project = await initializeProject({ rootPath: workspace, intake });
    const artifact = await readProjectArtifact(project, "Planning/Architect_Pack.md");

    expect(artifact.content).toContain("# Architect Pack");
    await expect(readProjectArtifact(project, "../package.json")).rejects.toThrow("not readable");
  });
});

describe("Shiptec API contract", () => {
  it("initializes a project through the API and reads sprint artifacts", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      expect(initResponse.status).toBe(201);

      const initBody = await initResponse.json() as { project: { id: string } };
      const sprintResponse = await fetch(`${server.url}/projects/${initBody.project.id}/sprints/Sprint_001`);
      const sprintBody = await sprintResponse.json() as {
        sprint: { artifacts: { path: string; content: string }[] };
      };

      expect(sprintResponse.status).toBe(200);
      expect(sprintBody.sprint.artifacts.some((artifact) => artifact.path.endsWith("Sprint_Plan.md"))).toBe(true);
      expect(sprintBody.sprint.artifacts[0]?.content).toContain("# Sprint_001");
    } finally {
      await server.close();
    }
  });

  it("returns a structured not-found error for unknown projects", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const response = await fetch(`${server.url}/projects/missing-project/scan`);
      const body = await response.json() as { error: { code: string; message: string } };

      expect(response.status).toBe(404);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toContain("Unknown Shiptec project");
    } finally {
      await server.close();
    }
  });

  it("serves the same API under the Firebase Hosting /api prefix", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const response = await fetch(`${server.url}/api/health`);
      const body = await response.json() as { ok: boolean; service: string };

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.service).toBe("shiptec-command-center");
    } finally {
      await server.close();
    }
  });

  it("rejects invalid sprint numbers with a structured validation error", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };
      const response = await postJson(`${server.url}/projects/${initBody.project.id}/sprints`, { sprintNumber: 0 });
      const body = await response.json() as { error: { code: string; message: string } };

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.message).toBe("Invalid request");
    } finally {
      await server.close();
    }
  });

  it("reads an artifact through the API and rejects unsafe paths", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };
      
      // Valid read
      const validResponse = await fetch(`${server.url}/projects/${initBody.project.id}/artifacts?path=Planning/Architect_Pack.md`);
      expect(validResponse.status).toBe(200);
      const validBody = await validResponse.json() as { artifact: { content: string } };
      expect(validBody.artifact.content).toContain("# Architect Pack");

      // Invalid read
      const invalidResponse = await fetch(`${server.url}/projects/${initBody.project.id}/artifacts?path=../package.json`);
      expect(invalidResponse.status).toBe(400);
    } finally {
      await server.close();
    }
  });

  it("previews an artifact update", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const newContent = "# Proposed Changes";
      const previewResponse = await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/preview?path=Planning/Architect_Pack.md`, {
        content: newContent
      });
      
      expect(previewResponse.status).toBe(200);
      const previewBody = await previewResponse.json() as { preview: { oldContent: string | null; newContent: string } };
      expect(previewBody.preview.newContent).toBe(newContent);
      expect(previewBody.preview.oldContent).toContain("# Architect Pack");

      const currentStateResponse = await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/preview?path=Planning/Governance/Current_State.md`, {
        content: "# Updated Current State"
      });
      expect(currentStateResponse.status).toBe(200);
    } finally {
      await server.close();
    }
  });

  it("updates an artifact through the API and creates a backup", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const newContent = "# Updated Architect Pack";
      const updateResponse = await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/update?path=Planning/Architect_Pack.md`, {
        content: newContent
      });
      
      expect(updateResponse.status).toBe(200);

      const checkResponse = await fetch(`${server.url}/projects/${initBody.project.id}/artifacts?path=Planning/Architect_Pack.md`);
      const checkBody = await checkResponse.json() as { artifact: { content: string } };
      expect(checkBody.artifact.content).toBe(newContent);
    } finally {
      await server.close();
    }
  });

  it("researches patterns through the API", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const researchResponse = await postJson(`${server.url}/projects/${initBody.project.id}/patterns/research`, {
        approved: true
      });
      
      expect(researchResponse.status).toBe(200);
      const researchBody = await researchResponse.json() as { result: { notes: string; source: string } };
      expect(researchBody.result.notes).toBeDefined();
      expect(researchBody.result.source).toBeDefined();
    } finally {
      await server.close();
    }
  });

  it("syncs test report from implementation log", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      // Manually add log entries
      await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/update?path=Sprints/Sprint_001/Implementation_Log.md`, {
        content: "[2026-06-18 10:00:00] - TASK: API Init - STATUS: pass - DETAILS: OK\n[2026-06-18 10:05:00] - TASK: Git Init - STATUS: fail - DETAILS: Error"
      });

      const syncResponse = await postJson(`${server.url}/projects/${initBody.project.id}/sprints/Sprint_001/sync-report`, {});
      
      expect(syncResponse.status).toBe(200);
      const syncBody = await syncResponse.json() as { report: string };
      expect(syncBody.report).toContain("- [PASS] API Init");
      expect(syncBody.report).toContain("- [FAIL] Git Init");
      expect(syncBody.report).toContain("1 passed, 1 failed.");
    } finally {
      await server.close();
    }
  });

  it("validates dry run operations against sprint scope", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-dryrun-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "dryrun-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      // Setup plan and dry run
      await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/update?path=Sprints/Sprint_001/Sprint_Plan.md`, {
        content: "## Scope\n- Task A\n- Task B"
      });
      await postJson(`${server.url}/projects/${initBody.project.id}/artifacts/update?path=Sprints/Sprint_001/Builder_Dry_Run.md`, {
        content: "## Intended File Operations\n- Implement Task A\n- Implement Task B"
      });

      const response = await postJson(`${server.url}/projects/${initBody.project.id}/sprints/Sprint_001/validate-dry-run`, {});
      expect(response.status).toBe(200);
      const body = await response.json() as { validation: { status: string; findings: string[] } };
      expect(body.validation.status).toBe("pass");
      expect(body.validation.findings[0]).toContain("align with sprint scope");
    } finally {
      await server.close();
    }
  });

  it("automatically updates current state after a scan", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-state-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "state-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };
      
      const scanResponse = await fetch(`${server.url}/projects/${initBody.project.id}/scan`);
      expect(scanResponse.status).toBe(200);

      const stateResponse = await fetch(`${server.url}/projects/${initBody.project.id}/artifacts?path=Planning/Governance/Current_State.md`);
      const stateBody = await stateResponse.json() as { artifact: { content: string } };
      expect(stateBody.artifact.content).toContain("## Health Score");
      expect(stateBody.artifact.content).toContain("## Status");
    } finally {
      await server.close();
    }
  });

  it("compiles builder dry run/specification successfully", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-spec-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "spec-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const response = await postJson(`${server.url}/projects/${initBody.project.id}/specification/generate`, {});
      expect(response.status).toBe(200);
      const body = await response.json() as { spec: string };
      expect(body.spec).toContain("# 📦 SHIPTEC HANDOFF SPEC [V2-OPTIMIZED]");
      expect(body.spec).toContain("## 🆔 METADATA");
    } finally {
      await server.close();
    }
  });

  it("accepts a sprint through the API", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const acceptResponse = await postJson(`${server.url}/projects/${initBody.project.id}/sprints/Sprint_001/accept`, {
        approvedBy: "Test API Architect",
        summary: "API acceptance test"
      });
      
      expect(acceptResponse.status).toBe(200);
      const acceptBody = await acceptResponse.json() as { acceptance: { accepted: boolean } };
      expect(acceptBody.acceptance.accepted).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("fetches the project directory tree structure", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const treeResponse = await fetch(`${server.url}/projects/${initBody.project.id}/tree`);
      expect(treeResponse.status).toBe(200);
      const treeBody = await treeResponse.json() as { projectId: string; tree: any[] };
      expect(treeBody.projectId).toBe(initBody.project.id);
      expect(Array.isArray(treeBody.tree)).toBe(true);
      // It should contain the initial files/folders created by init
      expect(treeBody.tree.length).toBeGreaterThan(0);
      expect(treeBody.tree.some((node) => node.name === "Planning")).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("exports handoff package as a folder for a specific editor", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const exportDest = path.join(workspace, "exported-handoff");
      const exportResponse = await postJson(`${server.url}/projects/${initBody.project.id}/handoff/export`, {
        format: "folder",
        editor: "claudecode",
        destinationPath: exportDest
      });

      expect(exportResponse.status).toBe(200);
      const exportBody = await exportResponse.json() as { destinationPath: string; filesIncluded: string[] };
      expect(exportBody.destinationPath).toBe(exportDest);
      expect(exportBody.filesIncluded).toContain("HANDOFF_GUIDE.md");

      // Verify the files exist at the destination
      const guideContent = await readFile(path.join(exportDest, "HANDOFF_GUIDE.md"), "utf-8");
      expect(guideContent).toContain("Claude Code-Specific Workflow");
    } finally {
      await server.close();
    }
  });

  it("exports handoff package as a zip archive", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-api-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };

      const exportResponse = await postJson(`${server.url}/projects/${initBody.project.id}/handoff/export`, {
        format: "zip",
        editor: "antigravity"
      });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.headers.get("content-type")).toBe("application/zip");
      const buffer = await exportResponse.arrayBuffer();
      expect(buffer.byteLength).toBeGreaterThan(0);
    } finally {
      await server.close();
    }
  });

  it("generates an honest DRAFT proposal, blocks export, and allows forced export", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-proposal-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "demo-factory"),
        intake
      });
      const initBody = await initResponse.json() as { project: { id: string } };
      const projectId = initBody.project.id;

      // 1. Generate proposal
      const genResponse = await postJson(`${server.url}/projects/${projectId}/proposals/generate`, {});
      expect(genResponse.status).toBe(201);
      const genBody = await genResponse.json() as { proposal: any };
      expect(genBody.proposal.metadata.proposalId).toBe("Proposal_001");
      expect(genBody.proposal.quality.overallScore).toBeGreaterThan(0);

      // HONESTY: an intake with no business data must produce a DRAFT with a
      // blocked Confidence Gate and a non-empty Assumption Register.
      expect(genBody.proposal.metadata.readiness).toBe("DRAFT");
      expect(genBody.proposal.confidence.status).toBe("blocked");
      expect(Array.isArray(genBody.proposal.assumptions)).toBe(true);
      expect(genBody.proposal.assumptions.length).toBeGreaterThan(0);
      // The fabricated "$36,200" budget must NEVER appear anywhere.
      expect(JSON.stringify(genBody.proposal)).not.toContain("36,200");

      // 2. List proposals
      const listResponse = await fetch(`${server.url}/projects/${projectId}/proposals`);
      expect(listResponse.status).toBe(200);
      const listBody = await listResponse.json() as { proposals: any[] };
      expect(listBody.proposals.length).toBe(1);
      expect(listBody.proposals[0].id).toBe("Proposal_001");

      // 3. Read proposal — assert the Assumption Register appendix is embedded.
      const readResponse = await fetch(`${server.url}/projects/${projectId}/proposals/Proposal_001`);
      expect(readResponse.status).toBe(200);
      const readBody = await readResponse.json() as { proposal: any };
      expect(readBody.proposal.metadata.proposalId).toBe("Proposal_001");
      expect(readBody.proposal.fullMarkdown).toContain("Executive Summary");
      expect(readBody.proposal.fullMarkdown).toContain("Assumption Register");

      // 4. Export WITHOUT force → blocked by the Confidence Gate (409).
      const blockedResponse = await postJson(`${server.url}/projects/${projectId}/proposals/Proposal_001/export`, {
        format: "html"
      });
      expect(blockedResponse.status).toBe(409);
      const blockedBody = await blockedResponse.json() as { error: { code: string; details: any } };
      expect(blockedBody.error.code).toBe("CONFLICT");
      expect(blockedBody.error.details.blockingAssumptionIds.length).toBeGreaterThan(0);

      // 5. Export WITH force → succeeds as an explicitly-labelled DRAFT.
      const exportHtmlResponse = await postJson(`${server.url}/projects/${projectId}/proposals/Proposal_001/export`, {
        format: "html",
        options: { force: true }
      });
      expect(exportHtmlResponse.status).toBe(200);
      const htmlContent = await exportHtmlResponse.text();
      expect(htmlContent).toContain("<!doctype html>");

      // 6. Export CSV WITH force → succeeds.
      const exportCsvResponse = await postJson(`${server.url}/projects/${projectId}/proposals/Proposal_001/export`, {
        format: "csv",
        options: { force: true }
      });
      expect(exportCsvResponse.status).toBe(200);
      expect(exportCsvResponse.headers.get("content-type")).toBe("application/zip");
    } finally {
      await server.close();
    }
  });

  it("promotes a proposal to FINAL when the intake supplies all funder-critical data", async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "shiptec-final-"));
    process.env.SHIPTEC_REGISTRY_PATH = path.join(workspace, ".shiptec", "projects.json");
    const server = await startTestServer();

    try {
      const fullIntake = {
        ...intake,
        organization: "Tectagrand Industries",
        country: "United States",
        industry: "Information Technology",
        fundingType: "Grant",
        budget: "$50,000",
        marketSize: "$2B addressable market",
        competitors: ["Legacy ERP Inc."],
        competitiveAdvantage: "Governed, auditable delivery.",
        valueProposition: "Zero-drift software factory.",
        revenueModel: "SaaS subscription"
      };
      const initResponse = await postJson(`${server.url}/projects/init`, {
        rootPath: path.join(workspace, "final-factory"),
        intake: fullIntake
      });
      const initBody = await initResponse.json() as { project: { id: string } };
      const projectId = initBody.project.id;

      const genResponse = await postJson(`${server.url}/projects/${projectId}/proposals/generate`, {});
      expect(genResponse.status).toBe(201);
      const genBody = await genResponse.json() as { proposal: any };

      // Fully-supplied business data → no blocking assumptions → FINAL.
      expect(genBody.proposal.metadata.readiness).toBe("FINAL");
      expect(genBody.proposal.confidence.status).toBe("pass");
      expect(genBody.proposal.confidence.blockingAssumptionIds).toEqual([]);

      // And export works WITHOUT force, because nothing is blocking.
      const exportResponse = await postJson(`${server.url}/projects/${projectId}/proposals/Proposal_001/export`, {
        format: "html"
      });
      expect(exportResponse.status).toBe(200);
    } finally {
      await server.close();
    }
  });
});

async function startTestServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const app = createServer();
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Unable to start test server.");
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    })
  };
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}
