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

function populateIntakeForm(intake) {
  if (!form || !intake) return;
  
  const fields = {
    projectName: "projectName",
    productSummary: "productSummary",
    businessProblem: "businessProblem",
    currentWorkflow: "currentWorkflow",
    desiredWorkflow: "desiredWorkflow",
    mvpDefinition: "mvpDefinition",
    gitUrl: "gitUrl",
    skillsUrl: "skillsUrl",
    knowledgeUrl: "knowledgeUrl",
    budget: "budget",
    timeline: "timeline",
    compliance: "compliance",
    brandColors: "brandColors",
    typography: "typography",
  };

  for (const [key, name] of Object.entries(fields)) {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) {
      const value = intake[key];
      if (Array.isArray(value)) {
        input.value = value.join("\n");
      } else {
        input.value = value || "";
      }
    }
  }

  const legalCheck = form.querySelector(`[name="generateLegalDocs"]`);
  if (legalCheck && typeof legalCheck === 'HTMLInputElement') {
    legalCheck.checked = !!intake.generateLegalDocs;
  }

  const arrayFields = ["targetUsers", "toolsAndIntegrations", "technicalConstraints", "successCriteria", "knownRisks", "openQuestions"];
  arrayFields.forEach(field => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input && intake[field]) {
      input.value = Array.isArray(intake[field]) ? intake[field].join("\n") : intake[field];
    }
  });
}

function setActiveProject(projectId) {
  activeProjectId = projectId;
  if (projectIdView) projectIdView.textContent = projectId;
  if (projectSelect && projectSelect.value !== projectId) {
    projectSelect.value = projectId;
  }
  updateArtifactSelectOptions();
  
  // Refresh graph if graph tab is active
  const graphTab = document.getElementById("graphViewTab");
  if (graphTab && graphTab.classList.contains("active")) {
    renderProjectGraph(projectId);
  }
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
    { value: "Docs/Google_OKF_Specification.md", label: "Google OKF Spec" },
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

async function loadSprints() {
  if (!sprintSelect) return;
  try {
    const payload = await request(`/projects/${activeProjectId}/sprints`);
    sprintSelect.innerHTML = "";
    for (const sprintId of payload.sprints) {
      const option = document.createElement("option");
      option.value = sprintId;
      option.textContent = sprintId.replace("_", " ");
      sprintSelect.append(option);
    }
    if (payload.sprints.includes(activeSprintId)) {
        sprintSelect.value = activeSprintId;
    } else if (payload.sprints.length > 0) {
        setActiveSprint(payload.sprints[payload.sprints.length - 1]);
    }
  } catch (error) {
    log("Failed to load sprints", String(error));
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
    const activeProject = payload.projects[payload.projects.length - 1];
    setActiveProject(activeProject.id);
    populateIntakeForm(activeProject.intake);
    updateArtifactSelectOptions();
    await loadSprints(); // Load dynamic sprints
    await loadProposals(); // Load proposals
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
    await loadSprints(); // Automatically refresh the sprint dropdown on scan
    await loadProjectTree();
    
    // Refresh graph if graph tab is active
    const graphTab = document.getElementById("graphViewTab");
    if (graphTab && graphTab.classList.contains("active")) {
      await renderProjectGraph(activeProjectId);
    }
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

const newProjectBtn = document.getElementById("newProjectBtn");
if (newProjectBtn) {
  newProjectBtn.addEventListener("click", () => {
    const intakeForm = document.getElementById("intakeForm");
    if (intakeForm) intakeForm.reset();
    currentStep = 1;
    updateWizard();
    
    activeProjectId = null;
    const projectIdView = document.getElementById("projectId");
    if (projectIdView) projectIdView.textContent = "New Project";
    
    if (submitIntakeBtn) {
      submitIntakeBtn.textContent = "Initialize Project";
    }
    
    showNotification("Form cleared for new project", "success", 3000);
  });
}

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
    const projectId = projectSelect.value;
    setActiveProject(projectId);
    
    try {
      // Fetch project details to populate the intake form
      const project = await request(`/projects/${projectId}`);
      populateIntakeForm(project.project.intake);
    } catch (e) {
      log("Failed to populate form", String(e));
    }

    await scan();
    await git();
    await getGitHubStatus();
    await loadProposals();
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
      if (action === "openRefineModal") openRefineModal();
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

// AI Refine Modal
const refineModalOverlay = document.getElementById('refineModalOverlay');
const refineModalClose = document.getElementById('refineModalClose');
const refineCancelBtn = document.getElementById('refineCancelBtn');
const refineExecuteBtn = document.getElementById('refineExecuteBtn');
const refineVibe = document.getElementById('refineVibe');

function openRefineModal() {
  if (refineModalOverlay) {
    refineModalOverlay.classList.add('active');
  }
}

function closeRefineModal() {
  if (refineModalOverlay) {
    refineModalOverlay.classList.remove('active');
  }
}

if (refineModalClose) refineModalClose.addEventListener('click', closeRefineModal);
if (refineCancelBtn) refineCancelBtn.addEventListener('click', closeRefineModal);

async function executeRefinement() {
  const path = artifactSelect ? artifactSelect.value : "";
  const vibe = refineVibe ? refineVibe.value : "";
  if (!path || !vibe) {
    showNotification('Please select an artifact and provide a vibe.', 'warning', 3000);
    return;
  }
  
  setPanelLoading(document.querySelector(".panel.command-panel"), true);
  try {
    const payload = await request(`/projects/${activeProjectId}/artifacts/refine`, {
      method: "POST",
      body: JSON.stringify({ path, vibe })
    });
    
    showNotification("Refinement applied & specification re-compiled.", "success", 3000);
    closeRefineModal();
    await viewArtifact(); // Reload view
    await scan(); // Refresh health
  } catch (error) {
    log("Refinement failed", String(error));
    showNotification("Refinement failed: " + String(error), "error", 0);
  } finally {
    setPanelLoading(document.querySelector(".panel.command-panel"), false);
  }
}
if (refineExecuteBtn) refineExecuteBtn.addEventListener('click', executeRefinement);

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

// Tab switching logic for Tree/Graph View
const treeViewTab = document.getElementById("treeViewTab");
const graphViewTab = document.getElementById("graphViewTab");
const treeControls = document.getElementById("treeControls");
const treeStats = document.getElementById("treeStats");
const folderTreeContainer = document.getElementById("folderTreeContainer");
const graphWrapper = document.getElementById("graphWrapper");
const graphContainer = document.getElementById("graph-container");

// Graph view state
let graphViewState = 'normal'; // 'minimized' | 'normal' | 'maximized' | 'fullscreen'
let graphInstance = null;
let graphMode = '2d'; // '2d' | '3d'

function setGraphViewState(state) {
  if (!graphWrapper) return;
  graphWrapper.classList.remove('minimized', 'maximized', 'fullscreen');
  
  // Clear active states on buttons
  const minBtn = document.getElementById('graphMinimize');
  const maxBtn = document.getElementById('graphMaximize');
  const fsBtn = document.getElementById('graphFullscreen');
  [minBtn, maxBtn, fsBtn].forEach(b => { if (b) b.classList.remove('active'); });

  graphViewState = state;

  if (state === 'minimized') {
    graphWrapper.classList.add('minimized');
    if (minBtn) minBtn.classList.add('active');
  } else if (state === 'maximized') {
    graphWrapper.classList.add('maximized');
    if (maxBtn) maxBtn.classList.add('active');
    resizeGraph();
  } else if (state === 'fullscreen') {
    graphWrapper.classList.add('fullscreen');
    if (fsBtn) fsBtn.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Must delay resize so DOM layout settles
    setTimeout(() => resizeGraph(), 50);
  } else {
    // Normal
    document.body.style.overflow = '';
    resizeGraph();
  }
}

function resizeGraph() {
  if (!graphInstance) return;
  const container = document.getElementById('graph-container');
  if (!container) return;
  try {
    if (graphMode === '3d') {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        graphInstance.width(w).height(h);
      }
    } else {
      graphInstance.setSize('100%', '100%');
      graphInstance.redraw();
      graphInstance.fit();
    }
  } catch (e) {
    console.warn('Error resizing graphInstance:', e);
  }
}

// Graph control buttons
const graphMinimizeBtn = document.getElementById('graphMinimize');
const graphMaximizeBtn = document.getElementById('graphMaximize');
const graphFullscreenBtn = document.getElementById('graphFullscreen');

if (graphMinimizeBtn) {
  graphMinimizeBtn.addEventListener('click', () => {
    setGraphViewState(graphViewState === 'minimized' ? 'normal' : 'minimized');
  });
}

if (graphMaximizeBtn) {
  graphMaximizeBtn.addEventListener('click', () => {
    setGraphViewState(graphViewState === 'maximized' ? 'normal' : 'maximized');
  });
}

if (graphFullscreenBtn) {
  graphFullscreenBtn.addEventListener('click', () => {
    setGraphViewState(graphViewState === 'fullscreen' ? 'normal' : 'fullscreen');
  });
}

// ESC key exits fullscreen
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && graphViewState === 'fullscreen') {
    setGraphViewState('normal');
  }
});

if (treeViewTab && graphViewTab) {
  treeViewTab.addEventListener("click", () => {
    treeViewTab.classList.add("active");
    graphViewTab.classList.remove("active");
    
    if (treeControls) treeControls.style.display = "flex";
    if (treeStats) treeStats.style.display = "flex";
    if (folderTreeContainer) folderTreeContainer.style.display = "block";
    if (graphWrapper) graphWrapper.classList.remove("visible");
  });

  graphViewTab.addEventListener("click", async () => {
    graphViewTab.classList.add("active");
    treeViewTab.classList.remove("active");
    
    if (treeControls) treeControls.style.display = "none";
    if (treeStats) treeStats.style.display = "none";
    if (folderTreeContainer) folderTreeContainer.style.display = "none";
    if (graphWrapper) {
      graphWrapper.classList.add("visible");
      try {
        await scan(); // Auto-trigger scan to ensure graph data exists
      } catch (e) {
        console.warn('Auto-scan failed before graph render', e);
      }
      await renderProjectGraph(activeProjectId);
    }
  });
}

checkHealth().then(async () => {
  await loadProjects();
  updateArtifactSelectOptions();
});

async function renderProjectGraph(projectId) {
  const container = document.getElementById('graph-container');
  if (!container) return;

  // Show stabilization overlay
  const stabilizing = document.getElementById('graphStabilizing');
  if (stabilizing) stabilizing.classList.remove('hidden');

  try {
    const response = await fetch(`${apiBase}/projects/${projectId}/graph`);
    const data = await response.json();
    const { nodes, edges } = data.graph;

    // Update stats counters
    const nodeCountEl = document.getElementById('graphNodeCount');
    const edgeCountEl = document.getElementById('graphEdgeCount');
    if (nodeCountEl) nodeCountEl.textContent = nodes.length;
    if (edgeCountEl) edgeCountEl.textContent = edges.length;

    // Branch: 3D mode uses ForceGraph3D
    if (graphMode === '3d') {
      return render3DGraph(container, nodes, edges, stabilizing);
    }

    // ── Node type → visual style mapping ──
    function getNodeStyle(type) {
      switch (type) {
        case 'Root':
          return {
            background: '#4c1d95',
            border: '#a855f7',
            highlight: { background: '#6d28d9', border: '#c084fc' },
            hover: { background: '#5b21b6', border: '#c084fc' },
            fontSize: 16,
            fontStyle: 'bold',
            shape: 'box',
            margin: { top: 12, bottom: 12, left: 18, right: 18 },
            borderWidth: 3,
            shadow: { enabled: true, color: 'rgba(168, 85, 247, 0.35)', size: 14, x: 0, y: 0 },
            mass: 3
          };
        case 'Group':
          return {
            background: '#1e1b4b',
            border: '#6366f1',
            highlight: { background: '#312e81', border: '#818cf8' },
            hover: { background: '#2e1065', border: '#818cf8' },
            fontSize: 13,
            fontStyle: 'bold',
            shape: 'box',
            margin: { top: 10, bottom: 10, left: 14, right: 14 },
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(99, 102, 241, 0.2)', size: 8, x: 0, y: 2 },
            mass: 2
          };
        case 'Module':
          return {
            background: '#064e3b',
            border: '#10b981',
            highlight: { background: '#065f46', border: '#34d399' },
            hover: { background: '#065f46', border: '#34d399' },
            fontSize: 12,
            fontStyle: 'normal',
            shape: 'box',
            margin: { top: 8, bottom: 8, left: 12, right: 12 },
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(16, 185, 129, 0.15)', size: 6, x: 0, y: 2 },
            mass: 1.5
          };
        case 'Sprint':
          return {
            background: '#78350f',
            border: '#fbbf24',
            highlight: { background: '#92400e', border: '#fcd34d' },
            hover: { background: '#92400e', border: '#fcd34d' },
            fontSize: 12,
            fontStyle: 'normal',
            shape: 'box',
            margin: { top: 8, bottom: 8, left: 12, right: 12 },
            borderWidth: 2,
            shadow: { enabled: true, color: 'rgba(251, 191, 36, 0.15)', size: 6, x: 0, y: 2 },
            mass: 1.5
          };
        case 'File':
          return {
            background: '#083344',
            border: '#22d3ee',
            highlight: { background: '#0e4a5e', border: '#67e8f9' },
            hover: { background: '#0e4a5e', border: '#67e8f9' },
            fontSize: 11,
            fontStyle: 'normal',
            shape: 'box',
            margin: { top: 6, bottom: 6, left: 10, right: 10 },
            borderWidth: 1.5,
            shadow: { enabled: true, color: 'rgba(34, 211, 238, 0.1)', size: 4, x: 0, y: 1 },
            mass: 1
          };
        case 'Config':
          return {
            background: '#18181b',
            border: '#71717a',
            highlight: { background: '#27272a', border: '#a1a1aa' },
            hover: { background: '#27272a', border: '#a1a1aa' },
            fontSize: 11,
            fontStyle: 'normal',
            shape: 'box',
            margin: { top: 6, bottom: 6, left: 10, right: 10 },
            borderWidth: 1.5,
            shadow: { enabled: false },
            mass: 1
          };
        default:
          return {
            background: '#27272a',
            border: '#71717a',
            highlight: { background: '#3f3f46', border: '#a1a1aa' },
            hover: { background: '#3f3f46', border: '#a1a1aa' },
            fontSize: 11,
            fontStyle: 'normal',
            shape: 'box',
            margin: { top: 6, bottom: 6, left: 10, right: 10 },
            borderWidth: 1.5,
            shadow: { enabled: false },
            mass: 1
          };
      }
    }

    // Type-prefix icons for label clarity
    const typeIcon = {
      Root: '◈  ',
      Group: '▸  ',
      Module: '◆  ',
      Sprint: '⚑  ',
      File: '',
      Config: '⚙  '
    };

    const visNodes = nodes.map(n => {
      const style = getNodeStyle(n.type);
      return {
        id: n.id,
        label: (typeIcon[n.type] || '') + n.label,
        title: `<div style="font-family:Space Grotesk,sans-serif;font-size:12px;padding:4px 0;"><strong>${n.type}</strong>: ${n.label}${n.source_file ? '<br><span style="color:#9ca3af;font-size:10px;">' + n.source_file + '</span>' : ''}</div>`,
        shape: style.shape,
        shapeProperties: { borderRadius: n.type === 'Root' ? 10 : 6 },
        margin: style.margin,
        borderWidth: style.borderWidth,
        borderWidthSelected: style.borderWidth + 1.5,
        color: {
          background: style.background,
          border: style.border,
          highlight: style.highlight,
          hover: style.hover
        },
        font: {
          color: '#f1f5f9',
          size: style.fontSize,
          face: 'Space Grotesk, sans-serif',
          vadjust: 0,
          bold: style.fontStyle === 'bold' ? { color: '#ffffff', size: style.fontSize + 1 } : undefined
        },
        shadow: style.shadow,
        mass: style.mass,
        type: n.type,
        source_file: n.source_file
      };
    });

    // ── Edge relation → color mapping ──
    function getEdgeColor(label) {
      switch (label) {
        case 'governs':   return { color: 'rgba(168, 85, 247, 0.25)', highlight: '#a855f7', hover: '#a855f7' };
        case 'defines':   return { color: 'rgba(251, 191, 36, 0.25)', highlight: '#fbbf24', hover: '#fbbf24' };
        case 'blueprint': return { color: 'rgba(34, 211, 238, 0.25)', highlight: '#22d3ee', hover: '#22d3ee' };
        case 'component': return { color: 'rgba(16, 185, 129, 0.25)', highlight: '#10b981', hover: '#10b981' };
        case 'plans':     return { color: 'rgba(99, 102, 241, 0.25)', highlight: '#6366f1', hover: '#6366f1' };
        default:          return { color: 'rgba(255, 255, 255, 0.08)', highlight: '#00f0ff', hover: '#00f0ff' };
      }
    }

    const visEdges = edges.map(e => {
      const edgeColor = getEdgeColor(e.label);
      return {
        from: e.from,
        to: e.to,
        label: '',
        title: e.label || '',
        font: {
          align: 'middle',
          color: '#94a3b8',
          size: 9,
          face: 'DM Sans, sans-serif',
          strokeWidth: 0,
          background: 'rgba(5, 6, 16, 0.8)'
        },
        color: edgeColor,
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.45,
            type: 'arrow'
          }
        },
        smooth: {
          enabled: true,
          type: 'continuous',
          roundness: 0.35
        },
        width: 1.2,
        hoverWidth: 0.5,
        selectionWidth: 1
      };
    });

    // Clear previous stabilization overlay and re-inject
    const existingStab = container.querySelector('.graph-stabilizing');
    container.innerHTML = '';
    if (existingStab) container.appendChild(existingStab);

    // Destroy previous instance
    if (graphInstance) {
      try {
        graphInstance.destroy();
      } catch (e) {
        console.warn('Error destroying graphInstance:', e);
      }
      graphInstance = null;
    }

    const graphData = {
      nodes: visNodes,
      edges: visEdges
    };

    const options = {
      nodes: {
        chosen: {
          node: function(values) {
            values.borderWidth = values.borderWidth + 1;
          }
        }
      },
      edges: {
        width: 1.2,
        hoverWidth: 0.5,
        selectionWidth: 1,
        chosen: {
          edge: function(values) {
            values.width = 2.5;
          },
          label: function(values) {
            values.size = 10;
          }
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        selectable: true,
        selectConnectedEdges: true,
        zoomView: true,
        dragView: true,
        dragNodes: true,
        multiselect: false,
        navigationButtons: false,
        keyboard: false
      },
      physics: {
        enabled: true,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -80,
          centralGravity: 0.012,
          springLength: 140,
          springConstant: 0.06,
          damping: 0.45,
          avoidOverlap: 0.8
        },
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 20,
          fit: true
        },
        maxVelocity: 50,
        minVelocity: 0.1,
        timestep: 0.35
      },
      layout: {
        improvedLayout: true,
        clusterThreshold: 150
      }
    };

    // Instantiate vis-network
    graphInstance = new vis.Network(container, graphData, options);

    // Show edge labels only on hover
    graphInstance.on('hoverEdge', (params) => {
      const edgeId = params.edge;
      const edgeData = visEdges.find(e => (e.from + '-' + e.to) === edgeId);
      if (!edgeData && edges.length > 0) {
        // vis.js uses auto-generated edge IDs; update the edge's label on hover
        graphInstance.body.data.edges.update({ id: edgeId, label: graphInstance.body.data.edges.get(edgeId)?.title || '' });
      }
    });

    graphInstance.on('blurEdge', (params) => {
      graphInstance.body.data.edges.update({ id: params.edge, label: '' });
    });

    // Hide stabilization overlay when physics settles
    graphInstance.on('stabilizationIterationsDone', () => {
      graphInstance.setOptions({ physics: { stabilization: { enabled: false } } });
      setTimeout(() => {
        if (stabilizing) stabilizing.classList.add('hidden');
        graphInstance.fit({ animation: { duration: 600, easingFunction: 'easeOutQuad' } });
      }, 200);
    });

    // Sync selection with artifacts panel
    graphInstance.on('selectNode', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = visNodes.find(n => n.id === nodeId);
        if (node) {
          console.log('Node selected:', node.id, node.label, node.type);

          // Zoom to selected node
          graphInstance.focus(nodeId, {
            scale: 1.2,
            animation: { duration: 500, easingFunction: 'easeInOutCubic' }
          });
          
          if (node.source_file && (node.type === 'File' || node.type === 'Module')) {
            const absPath = node.source_file.replace(/\\/g, '/');
            const projectDirToken = `/projects/${activeProjectId}/`;
            const index = absPath.indexOf(projectDirToken);
            
            if (index !== -1) {
              const relativePath = absPath.substring(index + projectDirToken.length);
              if (artifactSelect) {
                let found = false;
                for (let i = 0; i < artifactSelect.options.length; i++) {
                  const opt = artifactSelect.options[i];
                  if (opt.value.replace(/\\/g, '/').toLowerCase() === relativePath.toLowerCase() ||
                      relativePath.toLowerCase().endsWith(opt.value.replace(/\\/g, '/').toLowerCase())) {
                    artifactSelect.selectedIndex = i;
                    viewArtifact();
                    found = true;
                    break;
                  }
                }
                if (found) {
                  showNotification(`Selected artifact: ${artifactSelect.value}`, 'success', 2000);
                }
              }
            }
          }
        }
      }
    });

    graphInstance.on('hoverNode', () => {
      container.style.cursor = 'pointer';
    });

    graphInstance.on('blurNode', () => {
      container.style.cursor = 'default';
    });

    // Double-click to zoom to node
    graphInstance.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        graphInstance.focus(params.nodes[0], {
          scale: 1.5,
          animation: { duration: 400, easingFunction: 'easeInOutCubic' }
        });
      } else {
        graphInstance.fit({ animation: { duration: 400, easingFunction: 'easeOutQuad' } });
      }
    });

  } catch (err) {
    console.error('Graph rendering failed:', err);
    if (stabilizing) stabilizing.classList.add('hidden');
    if (container) {
      container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#ef4444;font-family:Space Grotesk,sans-serif;font-size:14px;padding:20px;text-align:center;">
        <div>Graph data unavailable — run Scan first</div>
        <div style="font-size:12px;margin-top:10px;color:#9ca3af;font-family:monospace;">${err.message || String(err)}</div>
      </div>`;
    }
  }
}

// Fit-to-view button — mode-aware
const graphFitViewBtn = document.getElementById('graphFitView');
if (graphFitViewBtn) {
  graphFitViewBtn.addEventListener('click', () => {
    if (!graphInstance) return;
    if (graphMode === '3d') {
      graphInstance.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 800);
    } else {
      graphInstance.fit({ animation: { duration: 500, easingFunction: 'easeOutQuad' } });
    }
  });
}

// Handle window resize for graph
window.addEventListener('resize', () => {
  if (graphInstance && graphViewTab && graphViewTab.classList.contains('active')) {
    resizeGraph();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// 3D FORCE GRAPH RENDERER
// ══════════════════════════════════════════════════════════════════════════════

function render3DGraph(container, nodes, edges, stabilizing) {
  // Node type → color map
  const typeColors = {
    Root:   { bg: '#a855f7', border: '#c084fc' },
    Group:  { bg: '#6366f1', border: '#818cf8' },
    Module: { bg: '#10b981', border: '#34d399' },
    Sprint: { bg: '#fbbf24', border: '#fcd34d' },
    File:   { bg: '#22d3ee', border: '#67e8f9' },
    Config: { bg: '#71717a', border: '#a1a1aa' }
  };

  // Edge relation → color map
  const edgeColors = {
    governs:   'rgba(168, 85, 247, 0.45)',
    defines:   'rgba(251, 191, 36, 0.45)',
    blueprint: 'rgba(34, 211, 238, 0.45)',
    component: 'rgba(16, 185, 129, 0.45)',
    plans:     'rgba(99, 102, 241, 0.45)',
    contains:  'rgba(255, 255, 255, 0.12)'
  };

  const particleColors = {
    governs:   '#a855f7',
    defines:   '#fbbf24',
    blueprint: '#22d3ee',
    component: '#10b981',
    plans:     '#6366f1',
    contains:  '#00ffcc'
  };

  // Build 3D graph data
  const graphNodes = nodes.map(n => {
    const colors = typeColors[n.type] || typeColors.Config;
    return {
      id: n.id,
      label: n.label,
      type: n.type,
      color: colors.bg,
      border: colors.border,
      source_file: n.source_file || null,
      val: n.type === 'Root' ? 12 : n.type === 'Group' ? 6 : n.type === 'Sprint' ? 5 : 3
    };
  });

  const graphLinks = edges.map(e => ({
    source: e.from,
    target: e.to,
    label: e.label || '',
    color: edgeColors[e.label] || edgeColors.contains,
    particleColor: particleColors[e.label] || particleColors.contains
  }));

  // Clear previous canvas
  const existingStab = container.querySelector('.graph-stabilizing');
  container.innerHTML = '';
  if (existingStab) container.appendChild(existingStab);

  // Destroy previous instance
  if (graphInstance) {
    try {
      if (typeof graphInstance.destroy === 'function') graphInstance.destroy();
      else if (typeof graphInstance._destructor === 'function') graphInstance._destructor();
    } catch (e) {
      console.warn('Error destroying graph instance:', e);
    }
    graphInstance = null;
  }

  // Hide stabilization overlay immediately (3D stabilizes live)
  if (stabilizing) stabilizing.classList.add('hidden');

  const width = container.clientWidth;
  const height = container.clientHeight;

  // Instantiate ForceGraph3D
  graphInstance = ForceGraph3D()(container)
    .width(width)
    .height(height)
    .backgroundColor('#020308')
    .graphData({ nodes: graphNodes, links: graphLinks })

    // ── Node rendering ──
    .nodeThreeObject(node => {
      const sprite = new SpriteText(node.label);
      sprite.material.depthWrite = false;
      sprite.color = node.color;
      sprite.textHeight = node.type === 'Root' ? 6 : node.type === 'Group' ? 4 : 3;
      sprite.fontFace = 'Space Grotesk, sans-serif';
      sprite.fontWeight = (node.type === 'Root' || node.type === 'Group') ? '700' : '500';
      sprite.backgroundColor = 'rgba(5, 6, 16, 0.82)';
      sprite.borderColor = node.border;
      sprite.borderWidth = 0.5;
      sprite.borderRadius = 4;
      sprite.padding = [3, 6];
      return sprite;
    })
    .nodeThreeObjectExtend(false)

    // ── Link rendering ──
    .linkColor(link => link.color)
    .linkWidth(0.4)
    .linkOpacity(0.7)

    // ── Directional arrows ──
    .linkDirectionalArrowLength(4)
    .linkDirectionalArrowRelPos(1)
    .linkDirectionalArrowColor(link => link.particleColor)

    // ── Directional flow particles ──
    .linkDirectionalParticles(3)
    .linkDirectionalParticleWidth(1.5)
    .linkDirectionalParticleSpeed(0.006)
    .linkDirectionalParticleColor(link => link.particleColor)

    // ── Physics ──
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)

    // ── Interactions ──
    .onNodeClick(node => {
      if (!node) return;
      // Zoom camera to node
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      graphInstance.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1000
      );

      // Sync artifacts panel
      if (node.source_file && (node.type === 'File' || node.type === 'Module')) {
        const absPath = node.source_file.replace(/\\/g, '/');
        const projectDirToken = `/projects/${activeProjectId}/`;
        const index = absPath.indexOf(projectDirToken);
        if (index !== -1) {
          const relativePath = absPath.substring(index + projectDirToken.length);
          if (artifactSelect) {
            for (let i = 0; i < artifactSelect.options.length; i++) {
              const opt = artifactSelect.options[i];
              if (opt.value.replace(/\\/g, '/').toLowerCase() === relativePath.toLowerCase() ||
                  relativePath.toLowerCase().endsWith(opt.value.replace(/\\/g, '/').toLowerCase())) {
                artifactSelect.selectedIndex = i;
                viewArtifact();
                showNotification(`Selected artifact: ${artifactSelect.value}`, 'success', 2000);
                break;
              }
            }
          }
        }
      }
    })
    .onNodeHover(node => {
      container.style.cursor = node ? 'pointer' : 'default';
    });

  // Initial camera sweep
  setTimeout(() => {
    if (graphInstance) {
      graphInstance.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1500);
    }
  }, 500);
}

// ══════════════════════════════════════════════════════════════════════════════
// MODE TOGGLE HANDLER
// ══════════════════════════════════════════════════════════════════════════════

const graphModeToggleBtn = document.getElementById('graphModeToggle');
if (graphModeToggleBtn) {
  graphModeToggleBtn.addEventListener('click', async () => {
    // Toggle mode
    graphMode = graphMode === '2d' ? '3d' : '2d';

    // Update button text and state
    graphModeToggleBtn.textContent = graphMode === '3d' ? '2D' : '3D';
    graphModeToggleBtn.title = graphMode === '3d' ? 'Switch to 2D View' : 'Switch to 3D View';
    graphModeToggleBtn.classList.toggle('active', graphMode === '3d');

    // Destroy current instance
    if (graphInstance) {
      try {
        if (typeof graphInstance.destroy === 'function') graphInstance.destroy();
        else if (typeof graphInstance._destructor === 'function') graphInstance._destructor();
      } catch (e) {
        console.warn('Error destroying graph instance on toggle:', e);
      }
      graphInstance = null;
    }

    // Clear the container
    const container = document.getElementById('graph-container');
    if (container) {
      // Preserve stabilization overlay
      const stab = container.querySelector('.graph-stabilizing');
      container.innerHTML = '';
      if (stab) container.appendChild(stab);
    }

    // Re-render in the new mode
    if (activeProjectId) {
      await renderProjectGraph(activeProjectId);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PROPOSAL FACTORY COCKPIT HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

const proposalSelect = document.getElementById("proposalSelect");
const generateProposalBtn = document.getElementById("generateProposalBtn");
const viewProposalBtn = document.getElementById("viewProposalBtn");
const proposalQualityContainer = document.getElementById("proposalQualityContainer");
const proposalOverallScore = document.getElementById("proposalOverallScore");
const qualityGrid = document.getElementById("qualityGrid");
const proposalExportToolbar = document.getElementById("proposalExportToolbar");

async function loadProposals() {
  if (!proposalSelect) return;
  try {
    const payload = await request(`/projects/${activeProjectId}/proposals`);
    proposalSelect.innerHTML = '<option value="">No proposals</option>';
    
    if (payload.proposals && payload.proposals.length > 0) {
      proposalSelect.innerHTML = "";
      for (const prop of payload.proposals) {
        const option = document.createElement("option");
        option.value = prop.id;
        // overallScore is null when metadata.json is missing/unreadable — render
        // "unknown" rather than a fabricated number.
        option.textContent = `${prop.id} (${prop.overallScore === null ? "unknown" : prop.overallScore + "/10"})`;
        proposalSelect.append(option);
      }
      if (proposalExportToolbar) proposalExportToolbar.style.display = "flex";
      if (proposalQualityContainer) proposalQualityContainer.style.display = "block";
      await loadProposalDetails(proposalSelect.value);
    } else {
      if (proposalExportToolbar) proposalExportToolbar.style.display = "none";
      if (proposalQualityContainer) proposalQualityContainer.style.display = "none";
    }
  } catch (error) {
    log("Failed to load proposals", String(error));
  }
}

async function loadProposalDetails(proposalId) {
  if (!proposalId) return;
  try {
    const payload = await request(`/projects/${activeProjectId}/proposals/${proposalId}`);
    const quality = payload.proposal.quality;
    
    if (proposalOverallScore) proposalOverallScore.textContent = quality.overallScore;
    
    if (qualityGrid) {
      qualityGrid.innerHTML = "";
      quality.dimensions.forEach(dim => {
        const item = document.createElement("div");
        item.style.textAlign = "center";
        item.style.padding = "4px";
        item.style.background = "rgba(255,255,255,0.02)";
        item.style.border = "1px solid rgba(255,255,255,0.05)";
        item.style.borderRadius = "4px";
        item.title = `${dim.label}: ${dim.score}/10\n${dim.weakness || "Passed threshold"}`;
        
        const scoreColor = dim.score >= 9 ? "#4ade80" : dim.score >= 7.5 ? "#f97316" : "#fb7185";
        
        item.innerHTML = `
          <div style="font-size: 8px; text-transform: uppercase; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dim.label.split(" ")[0]}</div>
          <div style="font-size: 11px; font-weight: bold; color: ${scoreColor}; margin-top: 2px;">${dim.score}</div>
        `;
        qualityGrid.appendChild(item);
      });
    }
  } catch (error) {
    log("Failed to load proposal details", String(error));
  }
}

if (proposalSelect) {
  proposalSelect.addEventListener("change", async () => {
    await loadProposalDetails(proposalSelect.value);
  });
}

if (generateProposalBtn) {
  generateProposalBtn.addEventListener("click", async () => {
    showLoading("Generating proposal and validating quality dimensions...");
    try {
      const payload = await request(`/projects/${activeProjectId}/proposals/generate`, { method: "POST" });
      log("Proposal generated", payload.proposal);
      showNotification(`Proposal ${payload.proposal.metadata.proposalId} generated successfully. Quality Score: ${payload.proposal.quality.overallScore}`, "success", 4000);
      await loadProposals();
      
      // Select the new proposal
      if (proposalSelect) {
        proposalSelect.value = payload.proposal.metadata.proposalId;
        await loadProposalDetails(payload.proposal.metadata.proposalId);
      }
      
      // Auto-display proposal content in the artifact panel
      if (artifactView) {
        const filePayload = await request(`/projects/${activeProjectId}/artifacts?path=Proposals/${payload.proposal.metadata.proposalId}/Proposal.md`);
        artifactView.textContent = filePayload.artifact.content;
        showNotification(`Displaying Proposal.md`, "success", 2000);
      }
    } catch (error) {
      log("Proposal generation failed", String(error));
      showNotification("Failed to generate proposal: " + String(error), "error", 0);
    } finally {
      hideLoading();
    }
  });
}

if (viewProposalBtn) {
  viewProposalBtn.addEventListener("click", async () => {
    const propId = proposalSelect ? proposalSelect.value : "";
    if (!propId) {
      showNotification("No proposal generated yet. Click Generate first.", "warning", 3000);
      return;
    }
    setPanelLoading(document.querySelector(".panel.command-panel"), true);
    try {
      const filePayload = await request(`/projects/${activeProjectId}/artifacts?path=Proposals/${propId}/Proposal.md`);
      if (artifactView) artifactView.textContent = filePayload.artifact.content;
      log("Proposal view loaded", { proposalId: propId });
      showNotification(`Loaded Proposal: Proposals/${propId}/Proposal.md`, "success", 2000);
    } catch (error) {
      log("Proposal view load failed", String(error));
      showNotification("Failed to load proposal file: " + String(error), "error", 0);
    } finally {
      setPanelLoading(document.querySelector(".panel.command-panel"), false);
    }
  });
}

// Export Proposal Event Handlers
document.querySelectorAll("#proposalExportToolbar .export-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const propId = proposalSelect ? proposalSelect.value : "";
    if (!propId) {
      showNotification("Select or generate a proposal first.", "warning", 3000);
      return;
    }
    const format = btn.dataset.format;
    
    // Setup credentials for google-sheets
    let options = {};
    if (format === "google-sheets") {
      options = {
        googleCredentials: {
          type: "service_account",
          keyFilePath: "dummy-key.json"
        },
        shareWith: ["owner@example.com"]
      };
    }

    showLoading(`Exporting proposal as ${format.toUpperCase()}...`);
    try {
      const response = await fetch(`${apiBase}/projects/${activeProjectId}/proposals/${propId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, options })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      if (format === "google-sheets") {
        const json = await response.json();
        showNotification(`Cloud Sheet Exported! Opening Google Sheet: ${json.filename}`, "success", 5000);
        window.open(json.url, "_blank");
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        
        const disposition = response.headers.get("content-disposition");
        let filename = `${activeProjectId}_${propId}.${format}`;
        if (disposition && disposition.indexOf("filename=") !== -1) {
          filename = disposition.split("filename=")[1].replace(/"/g, "");
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showNotification(`Exported as ${format.toUpperCase()} successfully`, "success", 3000);
      }
    } catch (error) {
      log(`Export to ${format} failed`, String(error));
      showNotification(`Export failed: ${error.message || error}`, "error", 0);
    } finally {
      hideLoading();
    }
  });
});

