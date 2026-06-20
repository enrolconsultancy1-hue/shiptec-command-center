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
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingText = document.querySelector("#loadingText");
const notificationContainer = document.querySelector("#notificationContainer");
const sprintSelect = document.querySelector("#sprintSelect");
const artifactEditForm = document.querySelector("#artifactEditForm");
const artifactEditText = document.querySelector("#artifactEditText");
const saveArtifactEdit = document.querySelector("#saveArtifactEdit");
const cancelArtifactEdit = document.querySelector("#cancelArtifactEdit");
const toggleArtifactViewBtn = document.querySelector("#toggleArtifactView");

// Toggle Artifact View
if (toggleArtifactViewBtn && artifactView) {
  toggleArtifactViewBtn.addEventListener("click", () => {
    const isExpanded = artifactView.classList.toggle("expanded");
    toggleArtifactViewBtn.textContent = isExpanded ? "Show Less" : "Show More";
  });
}

let activeProjectId = "shiptec-command-center";
let activeSprintId = "Sprint_001";
const apiBase = window.location.protocol === "file:"
  ? "http://localhost:3000"
  : window.location.hostname.endsWith("web.app") || window.location.hostname.endsWith("firebaseapp.com")
    ? "/api"
    : "";

// Safe notification helper
function showNotification(message, type = "info", duration = 5000) {
  if (!notificationContainer) return;
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <span>${message}</span>
    <button class="notification-close" onclick="this.closest('.notification').classList.add('hide'); setTimeout(() => this.closest('.notification').remove(), 300)">&times;</button>
  `;

  notificationContainer.appendChild(notification);

  if (duration > 0) {
    setTimeout(() => {
      notification.classList.add("hide");
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, duration);
  }
}

// Safe loading helpers
function showLoading(text = "Processing...") {
  if (loadingText) loadingText.textContent = text;
  if (loadingOverlay) loadingOverlay.classList.add("active");
}

function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove("active");
}

function setPanelLoading(panel, isLoading) {
  if (!panel) return;
  if (isLoading) {
    panel.classList.add("loading");
  } else {
    panel.classList.remove("loading");
  }
}

function lines(value) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function intakePayload() {
  if (!form) return {};
  const data = new FormData(form);
  return {
    rootPath: data.get("rootPath"),
    intake: {
      projectName: data.get("projectName"),
      productSummary: data.get("productSummary"),
      businessProblem: data.get("businessProblem"),
      targetUsers: lines(data.get("targetUsers") || ""),
      currentWorkflow: data.get("currentWorkflow"),
      desiredWorkflow: data.get("desiredWorkflow"),
      toolsAndIntegrations: lines(data.get("toolsAndIntegrations") || ""),
      technicalConstraints: lines(data.get("technicalConstraints") || ""),
      successCriteria: lines(data.get("successCriteria") || ""),
      mvpDefinition: data.get("mvpDefinition"),
      knownRisks: lines(data.get("knownRisks") || ""),
      openQuestions: lines(data.get("openQuestions") || ""),
      gitUrl: data.get("gitUrl") || undefined
    }
  };
}

function log(title, payload) {
  const timestamp = new Date().toLocaleTimeString();
  if (activityLog) {
    activityLog.textContent = `[${timestamp}] ${title}\n${JSON.stringify(payload, null, 2)}`;
  }
}

function setActiveProject(projectId) {
  activeProjectId = projectId;
  if (projectIdView) projectIdView.textContent = projectId;
  if (projectSelect && projectSelect.value !== projectId) {
    projectSelect.value = projectId;
  }
}

function setActiveSprint(sprintId) {
  activeSprintId = sprintId;
  if (sprintSelect && sprintSelect.value !== sprintId) {
    sprintSelect.value = sprintId;
  }
}

function setHealth(score) {
  if (healthScore) healthScore.textContent = `${score}`;
  if (meterFill) {
    meterFill.style.width = `${Math.max(0, Math.min(100, score))}%`;
    meterFill.style.background = score >= 90 ? 
      "linear-gradient(90deg, #27ae60, #27ae60)" :
      score >= 70 ? 
      "linear-gradient(90deg, #f39c12, #f39c12)" :
      "linear-gradient(90deg, #e74c3c, #e74c3c)";
  }
}

function renderList(container, countView, items, emptyText, itemClass = "") {
  if (!container) return;
  container.innerHTML = "";
  if (countView) countView.textContent = `${items.length}`;

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
  if (!validationFindings) return;
  validationFindings.innerHTML = "";
  if (findingCount) findingCount.textContent = `${findings.length}`;

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
    if (serviceStatus) {
      serviceStatus.textContent = "Online";
      serviceStatus.classList.add("ok");
      serviceStatus.classList.remove("offline", "checking");
    }
    showNotification("API service is running", "success", 3000);
    log("Service health", payload);
  } catch (error) {
    if (serviceStatus) {
      serviceStatus.textContent = "Offline";
      serviceStatus.classList.add("offline");
      serviceStatus.classList.remove("ok", "checking");
    }
    showNotification("API service is unavailable", "error", 0);
    log("Service error", String(error));
  }
}

async function loadProjects() {
  try {
    showLoading("Loading projects...");
    const payload = await request("/projects");
    if (!payload.projects.length) return;
    if (projectSelect) {
      projectSelect.innerHTML = "";
      for (const project of payload.projects) {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.append(option);
      }
    }
    setActiveProject(payload.projects[payload.projects.length - 1].id);
    await scan();
    await git();
    await getGitHubStatus();
    hideLoading();
  } catch (error) {
    log("Project list unavailable", String(error));
    hideLoading();
  }
}

async function scan() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/scan`);
    const missing = payload.scan.missingFiles.length;
    if (fileState) {
      fileState.textContent = missing === 0 ? "All required files present" : `${missing} missing`;
    }
    setHealth(payload.health.score);
    renderList(
      recommendedActions,
      actionCount,
      payload.health.recommendedActions,
      "No recommended actions right now.",
      payload.health.score >= 90 ? "pass" : "warning"
    );
    log("Project scan", payload);
    showNotification(`Scan completed: ${missing} missing files`, missing > 0 ? "warning" : "success", 3000);
  } catch (error) {
    log("Scan failed", String(error));
    showNotification("Scan failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function validate() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/validate`, { method: "POST" });
    if (validationState) {
      validationState.textContent = payload.report.status;
    }
    renderFindings(payload.report.findings);
    log("Validation report", payload);
    
    const status = payload.report.status;
    const statusText = {
      "pass": "All validation checks passed",
      "warning": "Validation completed with warnings",
      "fail": "Validation failed - please review findings"
    };
    
    showNotification(statusText[status] || "Validation completed", status === "pass" ? "success" : status === "warning" ? "warning" : "error", 3000);
  } catch (error) {
    log("Validation failed", String(error));
    showNotification("Validation failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function generateSpecification() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/specification/generate`, { method: "POST" });
    log("Builder Specification generated", payload);
    showNotification("Builder specification generated successfully", "success", 3000);
    await scan();
  } catch (error) {
    log("Specification generation failed", String(error));
    showNotification("Specification generation failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function dryRun() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/builder-dry-run`, {
      method: "POST",
      body: JSON.stringify({ sprintNumber: 1 })
    });
    log("Builder dry run", payload);
    showNotification("Builder dry run completed successfully", "success", 3000);
  } catch (error) {
    log("Dry run failed", String(error));
    showNotification("Dry run failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function git() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/git/status`);
    if (gitState) {
      gitState.textContent = payload.status.isRepo
        ? payload.status.clean ? "Repo clean" : `${payload.status.changedFiles.length} changed files`
        : "Not initialized";
    }
    if (githubState) {
      githubState.textContent = payload.github.configured ? "Configured" : payload.github.reason;
    }
    log("Git status", payload);
    
    const statusText = payload.status.isRepo
      ? payload.status.clean ? "Git repository initialized and clean" : "Git repository has changes"
      : "Git repository not initialized";
    
    showNotification(statusText, payload.status.isRepo && payload.status.clean ? "success" : "warning", 3000);
  } catch (error) {
    log("Git status failed", String(error));
    showNotification("Git status failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function githubSetup() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/github/setup`, { method: "POST" });
    const status = payload.configured ? "configured" : "configured (setup initiated but may need manual completion)";
    
    const githubStatusEl = document.getElementById("githubStatus");
    const tokenStatusEl = document.getElementById("tokenStatus");
    const repoStatusEl = document.getElementById("repoStatus");
    
    if (githubStatusEl) githubStatusEl.textContent = `GitHub token is ${status}.`;
    if (tokenStatusEl) tokenStatusEl.textContent = status;
    if (repoStatusEl) repoStatusEl.textContent = `Repository created: ${payload.url}`;
    
    log("GitHub setup", payload);
    showNotification(`GitHub setup completed: ${payload.url}`, "success", 3000);
  } catch (error) {
    log("GitHub setup failed", String(error));
    showNotification("GitHub setup failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function getGitHubStatus() {
  try {
    const payload = await request(`/projects/${activeProjectId}/github/status`);
    const githubStatusEl = document.getElementById("githubStatus");
    const tokenStatusEl = document.getElementById("tokenStatus");
    const repoStatusEl = document.getElementById("repoStatus");

    if (githubStatusEl) {
      githubStatusEl.textContent = payload.configured 
        ? "GitHub token configured and ready for use."
        : `GitHub not configured: ${payload.reason}`;
    }
    if (tokenStatusEl) tokenStatusEl.textContent = payload.configured ? "Configured" : "Not configured";
    if (repoStatusEl) repoStatusEl.textContent = payload.configured ? "Ready for creation" : "Not created";
  } catch (error) {
    log("GitHub status check failed", String(error));
  }
}

async function accept(commit = false) {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/sprints/${activeSprintId}/accept`, {
      method: "POST",
      body: JSON.stringify({
        approvedBy: "Shiptec Command Center",
        summary: `Sprint ${activeSprintId} accepted via command center`,
        commit
      })
    });
    if (acceptanceState) {
      acceptanceState.textContent = commit
        ? payload.acceptance.commit?.created ? `Committed ${payload.acceptance.commit.hash ?? ""}` : "Accepted, no commit needed"
        : "Accepted";
    }
    log(commit ? "Sprint accepted and committed" : "Sprint accepted", payload);
    
    showNotification(
      commit && payload.acceptance.commit?.created
        ? `Sprint ${activeSprintId} accepted and committed successfully`
        : `Sprint ${activeSprintId} accepted`,
      "success",
      3000
    );
    
    await git();
    await scan();
  } catch (error) {
    log("Accept failed", String(error));
    showNotification("Accept failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function validateDryRun() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/sprints/${activeSprintId}/validate-dry-run`, { method: "POST" });
    log("Dry Run Validation", payload);
    
    const status = payload.validation.status;
    const statusText = {
      "pass": "Dry run operations align with sprint scope.",
      "warning": "Dry run may be incomplete; check findings.",
      "fail": "Dry run failed validation."
    };
    
    showNotification(statusText[status] || "Validation completed", status === "pass" ? "success" : status === "warning" ? "warning" : "error", 3000);
  } catch (error) {
    log("Dry Run Validation failed", String(error));
    showNotification("Dry Run Validation failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function viewArtifact() {
  const path = artifactSelect ? artifactSelect.value : "";
  if (!path) return;
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/artifacts?path=${encodeURIComponent(path)}`);
    if (artifactView) artifactView.textContent = payload.artifact.content;
    log("Artifact loaded", { path: payload.artifact.path });
    showNotification(`Loaded artifact: ${path}`, "success", 2000);
  } catch (error) {
    log("Artifact load failed", String(error));
    showNotification("Failed to load artifact: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function editArtifact() {
  const path = artifactSelect ? artifactSelect.value : "";
  if (!path) return;
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/artifacts?path=${encodeURIComponent(path)}`);
    if (artifactEditText) artifactEditText.value = payload.artifact.content;
    if (artifactEditForm) artifactEditForm.classList.add("active");
    if (artifactView) artifactView.style.display = "none";
    if (artifactEditForm) artifactEditForm.scrollIntoView({ behavior: "smooth" });
    showNotification("Edit mode activated", "info", 2000);
  } catch (error) {
    log("Failed to load artifact for editing", String(error));
    showNotification("Failed to load artifact: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function previewUpdate() {
  const path = artifactSelect ? artifactSelect.value : "";
  const content = artifactEditText ? artifactEditText.value : "";
  if (!path) return;
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/artifacts/preview?path=${encodeURIComponent(path)}`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    
    showNotification(
      `Preview ready: ${payload.preview.oldContent ? "File will be updated" : "New file will be created"}`, 
      "success", 
      3000
    );
    
    const changes = [];
    if (!payload.preview.oldContent) changes.push("New artifact will be created");
    else if (payload.preview.oldContent !== content) changes.push("Existing artifact will be updated");
    else changes.push("No changes detected");
    
    log("Preview update", { ...payload.preview, changes });
  } catch (error) {
    log("Preview failed", String(error));
    showNotification("Preview failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function saveEdit() {
  const path = artifactSelect ? artifactSelect.value : "";
  const content = artifactEditText ? artifactEditText.value : "";
  if (!path) return;
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/artifacts/update?path=${encodeURIComponent(path)}`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    
    if (artifactView) artifactView.textContent = content;
    if (artifactEditForm) artifactEditForm.classList.remove("active");
    if (artifactView) artifactView.style.display = "block";
    log("Artifact updated", { path, newContent: content });
    showNotification(`Artifact ${path} saved successfully`, "success", 3000);
  } catch (error) {
    log("Save failed", String(error));
    showNotification("Save failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

function closeArtifactEdit() {
  if (artifactEditForm) artifactEditForm.classList.remove("active");
  if (artifactView) artifactView.style.display = "block";
  if (artifactEditText) artifactEditText.value = "";
}

function openArtifactEdit() {
  if (artifactEditForm) {
    artifactEditForm.classList.add("active");
    artifactEditForm.scrollIntoView({ behavior: "smooth" });
  }
  if (artifactView) artifactView.style.display = "none";
}

if (saveArtifactEdit) {
  saveArtifactEdit.addEventListener("click", saveEdit);
}
if (cancelArtifactEdit) {
  cancelArtifactEdit.addEventListener("click", closeArtifactEdit);
}

// Intake Wizard logic
let currentStep = 1;
const totalSteps = 5;

const prevStepBtn = document.getElementById("prevStep");
const nextStepBtn = document.getElementById("nextStep");
const submitIntakeBtn = document.getElementById("submitIntake");
const stepIndicator = document.getElementById("stepIndicator");

function updateWizard() {
  document.querySelectorAll(".intake-step").forEach(step => {
    step.classList.remove("active");
    if (parseInt(step.dataset.step) === currentStep) step.classList.add("active");
  });

  if (stepIndicator) stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  if (prevStepBtn) prevStepBtn.disabled = currentStep === 1;
  if (nextStepBtn) nextStepBtn.style.display = currentStep === totalSteps ? "none" : "block";
  if (submitIntakeBtn) submitIntakeBtn.style.display = currentStep === totalSteps ? "block" : "none";
}

if (nextStepBtn) {
  nextStepBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      currentStep++;
      updateWizard();
    }
  });
}

if (prevStepBtn) {
  prevStepBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      updateWizard();
    }
  });
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      showLoading("Initializing project...");
      const payload = await request("/projects/init", {
        method: "POST",
        body: JSON.stringify(intakePayload())
      });
      setActiveProject(payload.project.id);
      log("Project initialized", payload);
      showNotification(`Project ${payload.project.name} initialized successfully`, "success", 3000);
      await loadProjects();
      await scan();
      await validate();
      await git();
      await getGitHubStatus();
      hideLoading();
    } catch (error) {
      log("Initialize failed", String(error));
      showNotification("Project initialization failed: " + String(error), "error", 0);
      hideLoading();
    }
  });
}

if (projectSelect) {
  projectSelect.addEventListener("change", async () => {
    setActiveProject(projectSelect.value);
    await scan();
    await git();
    await getGitHubStatus();
  });
}

if (sprintSelect) {
  sprintSelect.addEventListener("change", async () => {
    setActiveSprint(sprintSelect.value);
    await scan();
    await git();
  });
}

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      const action = button.dataset.action;
      if (action === "scan") await scan();
      if (action === "validate") await validate();
      if (action === "generateSpecification") await generateSpecification();
      if (action === "dryRun") await dryRun();
      if (action === "validateDryRun") await validateDryRun();
      if (action === "git") await git();
      if (action === "accept") await accept(false);
      if (action === "commit") await accept(true);
      if (action === "artifact") await viewArtifact();
      if (action === "editArtifact") await editArtifact();
      if (action === "previewUpdate") await previewUpdate();
      if (action === "githubSetup") await githubSetup();
    } catch (error) {
      log("Action failed", String(error));
      showNotification(`Action failed: ${String(error)}`, "error", 0);
    }
  });
});

checkHealth().then(loadProjects);
