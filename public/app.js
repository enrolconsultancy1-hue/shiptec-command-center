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
let selectedEditor = "antigravity"; 

function selectEditor(editor) {
  selectedEditor = editor;
  document.querySelectorAll('.target-editor-panel .editor-card').forEach(card => {
    card.classList.toggle('active', card.dataset.editor === editor);
  });
  showNotification(`Target editor set to ${editor}`, "info", 1000);
}
let currentProjectStatus = 'fresh';

const PROJECT_STATES = {
  fresh: { label: "Initialize Project", icon: "🚀", color: "#0080ff", tooltip: "No project record yet" },
  initialized: { label: "Initialize Project", icon: "🚀", color: "#0080ff", tooltip: "Project already initialized; clicking will re-provision" },
  in_progress: { label: "In Progress", icon: "⚡", color: "#f59e0b", tooltip: "Active sprint work committed or accepted" },
  handed_over: { label: "Handed Over", icon: "🏁", color: "#00f0ff", tooltip: "Handoff package created" },
  re_initializing: { label: "Re-Initialize", icon: "♻", color: "#ff8c00", tooltip: "Re-initializing existing project" }
};

function updateSubmitButton(status, statusUpdatedAt) {
  currentProjectStatus = status;
  const btn = document.querySelector("#submitIntake");
  const badge = document.querySelector("#projectStatusBadge");
  if (!btn) return;

  btn.setAttribute("data-state", status);

  const stateConfig = PROJECT_STATES[status] || PROJECT_STATES.fresh;
  btn.innerHTML = `${stateConfig.icon} ${stateConfig.label}`;

  if (status !== "fresh" && badge) {
    badge.classList.remove("hidden");
    const dateStr = statusUpdatedAt ? new Date(statusUpdatedAt).toLocaleString() : new Date().toLocaleString();
    badge.innerHTML = `<span class="icon">${stateConfig.icon}</span> <span class="label">${stateConfig.label}</span> <span class="time" title="${dateStr}">(${dateStr})</span>`;
    badge.setAttribute("data-state", status);
    badge.title = stateConfig.tooltip;
  } else if (badge) {
    badge.classList.add("hidden");
  }
}

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
      budget: data.get("budget"),
      timeline: data.get("timeline"),
      compliance: data.get("compliance"),
      generateLegalDocs: data.get("generateLegalDocs") === "on",
      brandColors: data.get("brandColors"),
      typography: data.get("typography"),
      gitUrl: data.get("gitUrl") || undefined,
      skillsUrl: lines(data.get("skillsUrl") || ""),
      knowledgeUrl: lines(data.get("knowledgeUrl") || "")
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
  updateArtifactSelectOptions();
}

function setActiveSprint(sprintId) {
  activeSprintId = sprintId;
  if (sprintSelect && sprintSelect.value !== sprintId) {
    sprintSelect.value = sprintId;
  }
  updateArtifactSelectOptions();
}

function updateArtifactSelectOptions() {
  if (!artifactSelect) return;
  
  const previousValue = artifactSelect.value;
  
  const options = [
    { value: "Planning/Architect_Pack.md", label: "Architect Pack" },
    { value: "Planning/Builder_Specification.md", label: "Builder Specification" },
    { value: "Planning/Technical_Blueprint.md", label: "Technical Blueprint" },
    { value: "Planning/Handoff_Prompt.md", label: "Handoff Prompt" },
    { value: "Planning/Validation_Report.md", label: "Validation Report" },
    { value: "Planning/Governance/Acceptance_Criteria.md", label: "Acceptance Criteria" },
    { value: "Planning/Governance/Current_State.md", label: "Current State" },
    { value: "Planning/Governance/Decisions.md", label: "Decisions" },
    { value: "Planning/Governance/Risks.md", label: "Risks" },
    { value: "Planning/Governance/Open_Questions.md", label: "Open Questions" },
    { value: `Sprints/${activeSprintId}/Sprint_Plan.md`, label: "Sprint Plan" },
    { value: `Sprints/${activeSprintId}/Builder_Dry_Run.md`, label: "Builder Dry Run" },
    { value: `Sprints/${activeSprintId}/Implementation_Log.md`, label: "Implementation Log" },
    { value: `Sprints/${activeSprintId}/Test_Report.md`, label: "Test Report" },
    { value: `Sprints/${activeSprintId}/Acceptance_Report.md`, label: "Acceptance Report" },
    { value: "Docs/Product_Requirements.md", label: "Product Requirements" },
    { value: "Docs/User_Roles.md", label: "User Roles" },
    { value: "Docs/Methodology_Guide.md", label: "Methodology Guide" },
    { value: "Docs/System_Tools.md", label: "System Tools" },
    { value: "Docs/Success_Criteria.md", label: "Success Criteria" },
    { value: "Docs/Architecture/ARCHITECTURE.md", label: "Architecture Overview" },
    { value: "Docs/Architecture/DATABASE.md", label: "Database Design" },
    { value: "Docs/Architecture/API_SPEC.md", label: "API Specification" },
    { value: "Docs/Architecture/AUTH.md", label: "Auth Specs" },
    { value: "Docs/Architecture/PAYMENTS.md", label: "Payment Specs" },
    { value: "Docs/Architecture/SECURITY.md", label: "Security Specs" },
    { value: "Docs/Architecture/FRONTEND.md", label: "Frontend Specs" },
    { value: "Docs/Architecture/BACKEND.md", label: "Backend Specs" },
    { value: "Docs/Architecture/TESTING.md", label: "Testing Strategy" },
    { value: "Docs/Architecture/DEPLOYMENT.md", label: "Deployment Config" }
  ];

  artifactSelect.innerHTML = "";
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    artifactSelect.append(option);
  }

  let restoredValue = previousValue;
  if (previousValue && previousValue.startsWith("Sprints/")) {
    const parts = previousValue.split("/");
    if (parts.length === 3) {
      restoredValue = `Sprints/${activeSprintId}/${parts[2]}`;
    }
  }
  
  artifactSelect.value = restoredValue;
  if (!artifactSelect.value) {
    artifactSelect.selectedIndex = 0;
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
    updateArtifactSelectOptions();
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
    if (payload.projectStatus) {
      updateSubmitButton(payload.projectStatus.status, payload.projectStatus.statusUpdatedAt);
    }
    
    // Update Dynamic Authorization Button State
    const authBtn = document.querySelector('[data-action="authorizeUrls"]');
    if (authBtn && payload.scan.authStatus) {
      if (payload.scan.authStatus === "authorized") {
        authBtn.innerHTML = "✅ URLs Authorized";
        authBtn.style.background = "#00ffcc";
        authBtn.style.color = "#000";
      } else if (payload.scan.authStatus === "rejected") {
        authBtn.innerHTML = "🚩 URLs Rejected";
        authBtn.style.background = "#ff4d4d";
        authBtn.style.color = "#fff";
      } else {
        authBtn.innerHTML = "🛡️ Authorize URLs";
        authBtn.style.background = "";
        authBtn.style.color = "";
      }
    }

    renderList(
      recommendedActions,
      actionCount,
      payload.health.recommendedActions,
      "No recommended actions right now.",
      payload.health.score >= 90 ? "pass" : "warning"
    );
    log("Project scan", payload);
    showNotification(`Scan completed: ${missing} missing files`, missing > 0 ? "warning" : "success", 3000);
    await loadProjectTree();
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

async function createHandoff() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/handoff`, { 
      method: "POST",
      body: JSON.stringify({ editor: selectedEditor })
    });
    log("Handoff Package Created", payload);
    showNotification("Handoff package created in .shiptec-handoff folder", "success", 3000);
    updateSubmitButton("handed_over", new Date().toISOString());
  } catch (error) {
    log("Handoff failed", String(error));
    showNotification("Handoff failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}

async function applySpec() {
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/builder/apply`, {
      method: "POST",
      body: JSON.stringify({ sprintId: activeSprintId })
    });
    log("Builder Spec Applied", payload);
    showNotification("Builder specification applied successfully", "success", 3000);
    await scan();
  } catch (error) {
    log("Apply Spec failed", String(error));
    showNotification("Apply Spec failed: " + String(error), "error", 0);
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
const totalSteps = 8;

const prevStepBtn = document.getElementById("prevStep");
const nextStepBtn = document.getElementById("nextStep");
const submitIntakeBtn = document.getElementById("submitIntake");
const submitWrapper = document.querySelector(".submit-intake-wrapper");
const stepIndicator = document.getElementById("stepIndicator");

function updateWizard() {
  document.querySelectorAll(".intake-step").forEach(step => {
    step.classList.remove("active");
    if (parseInt(step.dataset.step) === currentStep) step.classList.add("active");
  });

  if (stepIndicator) stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
  if (prevStepBtn) prevStepBtn.disabled = currentStep === 1;
  if (nextStepBtn) nextStepBtn.style.display = currentStep === totalSteps ? "none" : "block";
  if (submitWrapper) submitWrapper.style.display = currentStep === totalSteps ? "flex" : "none";
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
    
    const confirmMsg = currentProjectStatus === 'handed_over' 
      ? "This project has already been handed over. Are you sure you want to re-initialize it? This may overwrite existing scaffolding files."
      : "Are you sure you want to initialize this project? This will provision the base architecture and artifacts.";
    
    if (!confirm(confirmMsg)) return;

    try {
      showLoading("Initializing project...");
      updateSubmitButton("re_initializing");
      const payload = await request("/projects/init", {
        method: "POST",
        body: JSON.stringify(intakePayload())
      });
      setActiveProject(payload.project.id);
      log("Project initialized", payload);
      showNotification(`Project ${payload.project.name} initialized successfully`, "success", 3000);
      
      // Force the "Project Initialized" success state on the button
      const btn = document.querySelector("#submitIntake");
      if (btn) {
        btn.innerHTML = `✔ Project Initialized`;
        btn.style.background = "#00ffcc";
        btn.style.color = "#000";
      }

      await loadProjects();
      await scan();
      await validate();
      await git();
      await getGitHubStatus();
      hideLoading();

      // Revert the button to its state-based label after 3 seconds
      setTimeout(() => {
        if (btn) {
          btn.style.background = "";
          btn.style.color = "";
          updateSubmitButton("initialized");
        }
      }, 3000);
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
      if (action === "applySpec") await applySpec();
      if (action === "createHandoff") await createHandoff();
      if (action === "dryRun") await dryRun();
      if (action === "authorizeUrls") {
        setPanelLoading(document.querySelector(".panel.command-panel"), true);
        try {
          const payload = await request(`/projects/${activeProjectId}/authorize-urls`, { method: "POST" });
          log("URL Authorization", payload);
          showNotification(`Authorized ${payload.authorized.length} URLs. Flagged ${payload.flagged.length}.`, "success", 5000);
          await scan();
        } catch (error) {
          log("URL Authorization failed", String(error));
          showNotification("Authorization failed: " + String(error), "error", 0);
        } finally {
          setPanelLoading(document.querySelector(".panel.command-panel"), false);
        }
      }
      if (action === "git") await git();
      if (action === "accept") await accept(false);
      if (action === "commit") await accept(true);
      if (action === "artifact") await viewArtifact();
      if (action === "editArtifact") await editArtifact();
      if (action === "previewUpdate") await previewUpdate();
      if (action === "githubSetup") await githubSetup();
      if (action === "exportHandoff") openExportModal();
    } catch (error) {
      log("Action failed", String(error));
      showNotification(`Action failed: ${String(error)}`, "error", 0);
    }
  });
});

// ─── Folder Tree ───────────────────
function getFileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase();
  const icons = {
    'md': '📝', 'ts': '🔷', 'js': '🟨', 'json': '📋',
    'css': '🎨', 'html': '🌐', 'yml': '⚙️', 'yaml': '⚙️',
    'txt': '📄', 'log': '📜', 'env': '🔒', 'bak': '💾'
  };
  return icons[ext] || '📄';
}

function formatFileSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function countTreeStats(nodes) {
  let dirs = 0, files = 0, totalSize = 0;
  function walk(list) {
    for (const node of list) {
      if (node.type === 'directory') {
        dirs++;
        if (node.children) walk(node.children);
      } else {
        files++;
        if (node.size) totalSize += node.size;
      }
    }
  }
  walk(nodes);
  return { dirs, files, totalSize };
}

function renderTreeNode(node, depth = 0) {
  const div = document.createElement('div');
  div.className = 'tree-node';
  div.dataset.depth = depth;

  const content = document.createElement('div');
  content.className = 'tree-node-content';
  content.style.paddingLeft = (depth * 4) + 'px';

  const isDir = node.type === 'directory';
  const hasChildren = isDir && node.children && node.children.length > 0;

  // Toggle arrow
  const toggle = document.createElement('span');
  toggle.className = 'tree-toggle' + (hasChildren ? ' expanded' : ' empty');
  toggle.textContent = '▶';
  content.appendChild(toggle);

  // Icon
  const icon = document.createElement('span');
  icon.className = 'tree-node-icon';
  icon.textContent = getFileIcon(node.name, isDir);
  content.appendChild(icon);

  // Name
  const name = document.createElement('span');
  name.className = 'tree-node-name' + (isDir ? ' directory' : '');
  name.textContent = node.name;
  name.title = node.relativePath;
  content.appendChild(name);

  // Size (files only)
  if (!isDir && node.size != null) {
    const size = document.createElement('span');
    size.className = 'tree-node-size';
    size.textContent = formatFileSize(node.size);
    content.appendChild(size);
  }

  div.appendChild(content);

  // Children container
  if (isDir) {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children expanded';

    if (node.children) {
      for (const child of node.children) {
        childrenContainer.appendChild(renderTreeNode(child, depth + 1));
      }
    }

    // Set initial max-height for animation
    div.appendChild(childrenContainer);

    // Toggle click handler
    content.addEventListener('click', (e) => {
      e.stopPropagation();
      const isExpanded = childrenContainer.classList.contains('expanded');
      if (isExpanded) {
        childrenContainer.classList.remove('expanded');
        childrenContainer.classList.add('collapsed');
        toggle.classList.remove('expanded');
      } else {
        childrenContainer.classList.remove('collapsed');
        childrenContainer.classList.add('expanded');
        toggle.classList.add('expanded');
      }
    });
  } else {
    // File click: try to load the artifact if it's an .md file
    content.addEventListener('click', () => {
      if (node.name.endsWith('.md') && artifactSelect) {
        const matchOption = Array.from(artifactSelect.options).find(o => o.value === node.relativePath);
        if (matchOption) {
          artifactSelect.value = node.relativePath;
          viewArtifact();
          showNotification('Loading artifact: ' + node.name, 'info', 2000);
        }
      }
    });
  }

  return div;
}

function renderTree(treeData) {
  const container = document.getElementById('folderTreeContainer');
  if (!container) return;

  container.innerHTML = '';

  if (!treeData || treeData.length === 0) {
    container.innerHTML = '<div class="tree-placeholder">No files found in project directory.</div>';
    return;
  }

  for (const node of treeData) {
    container.appendChild(renderTreeNode(node));
  }

  // Update stats
  const stats = countTreeStats(treeData);
  const dirCountEl = document.getElementById('treeDirCount');
  const fileCountEl = document.getElementById('treeFileCount');
  const totalSizeEl = document.getElementById('treeTotalSize');
  if (dirCountEl) dirCountEl.textContent = stats.dirs;
  if (fileCountEl) fileCountEl.textContent = stats.files;
  if (totalSizeEl) totalSizeEl.textContent = formatFileSize(stats.totalSize);
}

function showTreeLoading() {
  const container = document.getElementById('folderTreeContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="tree-loading">
      <div class="tree-loading-line"></div>
      <div class="tree-loading-line"></div>
      <div class="tree-loading-line"></div>
      <div class="tree-loading-line"></div>
      <div class="tree-loading-line"></div>
    </div>
  `;
}

async function loadProjectTree() {
  showTreeLoading();
  try {
    const payload = await request(`/projects/${activeProjectId}/tree`);
    renderTree(payload.tree);
  } catch (error) {
    const container = document.getElementById('folderTreeContainer');
    if (container) {
      container.innerHTML = '<div class="tree-placeholder">Failed to load project structure.</div>';
    }
  }
}

function collapseAllTree() {
  const container = document.getElementById('folderTreeContainer');
  if (!container) return;
  container.querySelectorAll('.tree-children').forEach(el => {
    el.classList.remove('expanded');
    el.classList.add('collapsed');
  });
  container.querySelectorAll('.tree-toggle').forEach(el => {
    el.classList.remove('expanded');
  });
}

function expandAllTree() {
  const container = document.getElementById('folderTreeContainer');
  if (!container) return;
  container.querySelectorAll('.tree-children').forEach(el => {
    el.classList.remove('collapsed');
    el.classList.add('expanded');
  });
  container.querySelectorAll('.tree-toggle:not(.empty)').forEach(el => {
    el.classList.add('expanded');
  });
}

// Tree control buttons
const refreshTreeBtn = document.getElementById('refreshTree');
const collapseAllTreeBtn = document.getElementById('collapseAllTree');
const expandAllTreeBtn = document.getElementById('expandAllTree');

if (refreshTreeBtn) refreshTreeBtn.addEventListener('click', loadProjectTree);
if (collapseAllTreeBtn) collapseAllTreeBtn.addEventListener('click', collapseAllTree);
if (expandAllTreeBtn) expandAllTreeBtn.addEventListener('click', expandAllTree);

// ─── Export Handoff Modal ──────────────────────────────────

const exportModalOverlay = document.getElementById('exportModalOverlay');
const exportModalClose = document.getElementById('exportModalClose');
const exportCancelBtn = document.getElementById('exportCancelBtn');
const exportExecuteBtn = document.getElementById('exportExecuteBtn');
const exportDestSection = document.getElementById('exportDestSection');
const exportDestPath = document.getElementById('exportDestPath');

function openExportModal() {
  if (exportModalOverlay) {
    exportModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Pre-select the currently selected editor in the export modal
    document.querySelectorAll('.export-editor-grid .editor-card').forEach(card => {
      const isSelected = card.dataset.editor === selectedEditor;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });
  }
}

function closeExportModal() {
  if (exportModalOverlay) {
    exportModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

if (exportModalClose) exportModalClose.addEventListener('click', closeExportModal);
if (exportCancelBtn) exportCancelBtn.addEventListener('click', closeExportModal);
if (exportModalOverlay) {
  exportModalOverlay.addEventListener('click', (e) => {
    if (e.target === exportModalOverlay) closeExportModal();
  });
}

// Format card selection
document.querySelectorAll('.export-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.export-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    // Show/hide destination path
    const format = card.dataset.format;
    if (exportDestSection) {
      exportDestSection.style.display = format === 'folder' ? 'block' : 'none';
    }
  });
});

// Editor card selection
document.querySelectorAll('.export-editor-grid .editor-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.export-editor-grid .editor-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    // Sync selection back to main dashboard
    const editor = card.dataset.editor;
    if (editor) {
      selectEditor(editor);
    }
  });
});

// Execute export
async function executeExport() {
  const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
  const editorRadio = document.querySelector('input[name="targetEditor"]:checked');
  
  if (!formatRadio || !editorRadio) {
    showNotification('Please select a format and editor', 'warning', 3000);
    return;
  }

  const format = formatRadio.value;
  const editor = editorRadio.value;
  const destPath = exportDestPath ? exportDestPath.value.trim() : '';

  if (format === 'folder' && !destPath) {
    showNotification('Please enter a destination path for folder export', 'warning', 3000);
    return;
  }

  // Set loading state
  if (exportExecuteBtn) {
    exportExecuteBtn.disabled = true;
    exportExecuteBtn.querySelector('.export-btn-text').textContent = 'Exporting...';
    exportExecuteBtn.classList.add('loading');
  }

  try {
    const body = { format, editor };
    if (format === 'folder' && destPath) body.destinationPath = destPath;

    if (format === 'zip') {
      // Fetch as blob for download
      const response = await fetch(`${apiBase}/projects/${activeProjectId}/handoff/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] 
        || `handoff-${editor}.zip`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      log('Export completed (ZIP)', { format, editor, filename });
      showNotification(`📦 Handoff ZIP downloaded: ${filename}`, 'success', 5000);
    } else {
      // Folder export via JSON
      const payload = await request(`/projects/${activeProjectId}/handoff/export`, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      log('Export completed (Folder)', payload);
      showNotification(`📂 Handoff exported to: ${payload.destinationPath}`, 'success', 5000);
    }

    updateSubmitButton('handed_over', new Date().toISOString());
    closeExportModal();
  } catch (error) {
    log('Export failed', String(error));
    showNotification('Export failed: ' + String(error), 'error', 0);
  } finally {
    if (exportExecuteBtn) {
      exportExecuteBtn.disabled = false;
      exportExecuteBtn.querySelector('.export-btn-text').textContent = 'Export Package';
      exportExecuteBtn.classList.remove('loading');
    }
  }
}

if (exportExecuteBtn) exportExecuteBtn.addEventListener('click', executeExport);

checkHealth().then(async () => {
  await loadProjects();
  updateArtifactSelectOptions();
});
