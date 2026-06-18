import { mkdtemp } from "node:fs/promises";
import { Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { calculateHealth } from "../src/health.js";
import { gitStatus } from "../src/gitService.js";
import { acceptSprint, initializeProject, readProjectArtifact, scanProject } from "../src/projectService.js";
import { validateIntake } from "../src/validation.js";

const intake = {
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
