const form = document.querySelector("#intakeForm");
const serviceStatus = document.querySelector("#serviceStatus");
const projectIdView = document.querySelector("#projectId");
const projectSelect = document.querySelector("#projectSelect");
const artifactSelect = document.querySelector("#artifactSelect");
const artifactView = document.querySelector("#artifactView");
const healthScore = document.querySelector("#healthScore");
const meterFill = document.querySelector("#meterFill");
const fileState = document.querySelector("#fileState");
const validationState = document.querySelector("#validationState");
const gitState = document.querySelector("#gitState");
const githubState = document.querySelector("#githubState");
const acceptanceState = document.querySelector("#acceptanceState");
const activityLog = document.querySelector("#activityLog");
const validationFindings = document.querySelector("#validationFindings");
const recommendedActions = document.querySelector("#recommendedActions");
const findingCount = document.querySelector("#findingCount");
const actionCount = document.querySelector("#actionCount");

let activeProjectId = "shiptec-command-center";
const apiBase = window.location.protocol === "file:"
  ? "http://localhost:3000"
  : window.location.hostname.endsWith("web.app") || window.location.hostname.endsWith("firebaseapp.com")
    ? "/api"
    : "";

function lines(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function intakePayload() {
  const data = new FormData(form);
  return {
    rootPath: data.get("rootPath"),
    intake: {
      projectName: data.get("projectName"),
      productSummary: data.get("productSummary"),
      businessProblem: data.get("businessProblem"),
      targetUsers: lines(data.get("targetUsers")),
      currentWorkflow: data.get("currentWorkflow"),
      desiredWorkflow: data.get("desiredWorkflow"),
      toolsAndIntegrations: lines(data.get("toolsAndIntegrations")),
      technicalConstraints: lines(data.get("technicalConstraints")),
      successCriteria: lines(data.get("successCriteria")),
      mvpDefinition: data.get("mvpDefinition"),
      knownRisks: lines(data.get("knownRisks")),
      openQuestions: lines(data.get("openQuestions"))
    }
  };
}

function log(title, payload) {
  activityLog.textContent = `${title}\n${JSON.stringify(payload, null, 2)}`;
}

function setActiveProject(projectId) {
  activeProjectId = projectId;
  projectIdView.textContent = projectId;
  if (projectSelect.value !== projectId) {
    projectSelect.value = projectId;
  }
}

function setHealth(score) {
  healthScore.textContent = `${score}`;
  meterFill.style.width = `${Math.max(0, Math.min(100, score))}%`;
}

function renderList(container, countView, items, emptyText, itemClass = "") {
  container.innerHTML = "";
  countView.textContent = `${items.length}`;

  if (!items.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = emptyText;
    container.append(item);
    return;
  }

  for (const text of items) {
    const item = document.createElement("li");
    item.className = itemClass;
    item.textContent = text;
    container.append(item);
  }
}

function renderFindings(findings) {
  validationFindings.innerHTML = "";
  findingCount.textContent = `${findings.length}`;

  if (!findings.length) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = "No validation findings yet.";
    validationFindings.append(item);
    return;
  }

  for (const finding of findings) {
    const item = document.createElement("li");
    item.className = finding.status;
    item.textContent = `${finding.field}: ${finding.message}`;
    validationFindings.append(item);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    const preview = text.trim().slice(0, 120);
    throw new Error(`Expected JSON from ${path}, but received ${contentType || "unknown content"}. ${preview}`);
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(payload, null, 2));
  }
  return payload;
}

async function checkHealth() {
  try {
    const payload = await request("/health");
    serviceStatus.textContent = "Online";
    serviceStatus.classList.add("ok");
    log("Service health", payload);
  } catch (error) {
    serviceStatus.textContent = "Offline";
    log("Service error", String(error));
  }
}

async function loadProjects() {
  try {
    const payload = await request("/projects");
    if (!payload.projects.length) return;
    projectSelect.innerHTML = "";
    for (const project of payload.projects) {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      projectSelect.append(option);
    }
    setActiveProject(payload.projects[payload.projects.length - 1].id);
    await scan();
    await git();
  } catch (error) {
    log("Project list unavailable", String(error));
  }
}

async function scan() {
  const payload = await request(`/projects/${activeProjectId}/scan`);
  const missing = payload.scan.missingFiles.length;
  fileState.textContent = missing === 0 ? "All required files present" : `${missing} missing`;
  setHealth(payload.health.score);
  renderList(
    recommendedActions,
    actionCount,
    payload.health.recommendedActions,
    "No recommended actions right now.",
    payload.health.score >= 90 ? "pass" : "warning"
  );
  log("Project scan", payload);
}

async function validate() {
  const payload = await request(`/projects/${activeProjectId}/validate`, { method: "POST" });
  validationState.textContent = payload.report.status;
  renderFindings(payload.report.findings);
  log("Validation report", payload);
}

async function dryRun() {
  const payload = await request(`/projects/${activeProjectId}/builder-dry-run`, {
    method: "POST",
    body: JSON.stringify({ sprintNumber: 1 })
  });
  log("Builder dry run", payload);
}

async function git() {
  const payload = await request(`/projects/${activeProjectId}/git/status`);
  gitState.textContent = payload.status.isRepo
    ? payload.status.clean ? "Repo clean" : `${payload.status.changedFiles.length} changed files`
    : "Not initialized";
  githubState.textContent = payload.github.configured ? "Configured" : payload.github.reason;
  log("Git status", payload);
}

async function accept(commit = false) {
  const payload = await request(`/projects/${activeProjectId}/sprints/Sprint_001/accept`, {
    method: "POST",
    body: JSON.stringify({
      approvedBy: "Shiptec Command Center",
      summary: "First governed vertical slice accepted",
      commit
    })
  });
  acceptanceState.textContent = commit
    ? payload.acceptance.commit?.created ? `Committed ${payload.acceptance.commit.hash ?? ""}` : "Accepted, no commit needed"
    : "Accepted";
  log(commit ? "Sprint accepted and committed" : "Sprint accepted", payload);
  await git();
  await scan();
}

async function viewArtifact() {
  const path = artifactSelect.value;
  const payload = await request(`/projects/${activeProjectId}/artifacts?path=${encodeURIComponent(path)}`);
  artifactView.textContent = payload.artifact.content;
  log("Artifact loaded", { path: payload.artifact.path });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await request("/projects/init", {
      method: "POST",
      body: JSON.stringify(intakePayload())
    });
    setActiveProject(payload.project.id);
    log("Project initialized", payload);
    await loadProjects();
    await scan();
    await validate();
    await git();
  } catch (error) {
    log("Initialize failed", String(error));
  }
});

projectSelect.addEventListener("change", async () => {
  setActiveProject(projectSelect.value);
  await scan();
  await git();
});

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      const action = button.dataset.action;
      if (action === "scan") await scan();
      if (action === "validate") await validate();
      if (action === "dryRun") await dryRun();
      if (action === "git") await git();
      if (action === "accept") await accept(false);
      if (action === "commit") await accept(true);
      if (action === "artifact") await viewArtifact();
    } catch (error) {
      log("Action failed", String(error));
    }
  });
});

checkHealth().then(loadProjects);
