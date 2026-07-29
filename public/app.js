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

// Intake Step Navigation
let currentStep = 1;
const totalSteps = 8;
const nextBtn = document.getElementById("nextStep");
const prevBtn = document.getElementById("prevStep");
const stepIndicator = document.getElementById("stepIndicator");
const submitWrapper = document.querySelector(".submit-intake-wrapper");

function showStep(step) {
  document.querySelectorAll(".intake-step").forEach(el => el.classList.remove("active"));
  const stepEl = document.querySelector(`.intake-step[data-step="${step}"]`);
  if (stepEl) stepEl.classList.add("active");
  
  if (stepIndicator) stepIndicator.textContent = `Step ${step} of ${totalSteps}`;
  
  if (prevBtn) prevBtn.disabled = step === 1;
  
  if (step === totalSteps) {
    if (nextBtn) nextBtn.style.display = "none";
    if (submitWrapper) submitWrapper.style.display = "flex";
  } else {
    if (nextBtn) nextBtn.style.display = "inline-block";
    if (submitWrapper) submitWrapper.style.display = "none";
  }
}

if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (currentStep < totalSteps) {
      currentStep++;
      showStep(currentStep);
    }
  });
}

if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  });
}

// Remove Project Button
const removeProjectBtn = document.getElementById("removeProjectBtn");
if (removeProjectBtn) {
  removeProjectBtn.addEventListener("click", async () => {
    if (!activeProjectId) return;
    if (!confirm(`Are you sure you want to remove ${activeProjectId} from the registry?`)) return;
    
    showLoading(`Removing project ${activeProjectId}...`);
    try {
      await request(`/projects/${activeProjectId}`, { method: 'DELETE' });
      showNotification(`Removed project ${activeProjectId}`, "success", 3000);
      await loadProjects();
    } catch (error) {
      log("Failed to remove project", String(error));
      showNotification("Failed to remove project: " + String(error), "error", 0);
    } finally {
      hideLoading();
    }
  });
}

let activeProjectId = "shiptec-command-center";
let activeSprintId = "Sprint_001";
let selectedEditor = "antigravity";
let pipelineState = null;

function selectEditor(editor) {
  selectedEditor = editor;
  document.querySelectorAll('.target-editor-panel .editor-card').forEach(card => {
    card.classList.toggle('active', card.dataset.editor === editor);
  });
  showNotification(`Target editor set to ${editor}`, "info", 1000);
}

const WORKFLOW_STEPS = [
  { num: 1, key: "INTAKE_INIT", label: "Intake" },
  { num: 2, key: "PRODUCT_DEF", label: "Product" },
  { num: 3, key: "SCAN", label: "Scan" },
  { num: 4, key: "VALIDATE", label: "Validate" },
  { num: 5, key: "ARCHITECT_PACK", label: "Architect" },
  { num: 6, key: "BUILDER_SPEC", label: "Spec" },
  { num: 7, key: "SPRINT_CREATE", label: "Sprint" },
  { num: 8, key: "BUILDER_DRY_RUN", label: "Dry Run" },
  { num: 9, key: "DRY_RUN_VALIDATE", label: "V&auml;lidate" },
  { num: 10, key: "PATTERN_RESEARCH", label: "Research" },
  { num: 11, key: "BUILDER_EXECUTE", label: "Execute" },
  { num: 12, key: "ACCEPTANCE", label: "Accept" },
  { num: 13, key: "EXPORT_DELIVERY", label: "Export" }
];

const STEP_DEPENDENCIES = {
  5: [4],
  6: [5],
  7: [6],
  8: [7],
  9: [8],
  10: [9],
  11: [10],
  12: [11],
  13: [12]
};

async function loadPipelineState() {
  try {
    const payload = await request(`/projects/${activeProjectId}/pipeline`);
    pipelineState = payload.pipeline ?? null;
    renderPipelineProgress();
  } catch {
    pipelineState = null;
    renderPipelineProgress();
  }
}

function renderPipelineProgress() {
  const container = document.getElementById("pipelineSteps");
  const statusEl = document.getElementById("pipelineStatus");
  if (!container) return;

  const steps = container.querySelectorAll(".pipeline-step");
  let completedCount = 0;
  let runningStep = null;

  if (pipelineState && pipelineState.stepStatuses) {
    WORKFLOW_STEPS.forEach(ws => {
      const stepEl = container.querySelector(`[data-step="${ws.num}"]`);
      if (!stepEl) return;
      const status = pipelineState.stepStatuses[ws.num];
      stepEl.classList.remove("pipeline-completed", "pipeline-running", "pipeline-failed", "pipeline-idle", "pipeline-blocked", "pipeline-active");

      if (status === "completed") {
        stepEl.classList.add("pipeline-completed");
        completedCount++;
      } else if (status === "running") {
        stepEl.classList.add("pipeline-running");
        runningStep = ws.num;
      } else if (status === "failed") {
        stepEl.classList.add("pipeline-failed");
      } else {
        stepEl.classList.add("pipeline-idle");
      }
    });

    if (statusEl) {
      statusEl.textContent = `${completedCount}/13 completed`;
    }
  } else {
    steps.forEach(stepEl => stepEl.classList.add("pipeline-idle"));
    if (statusEl) {
      statusEl.textContent = "13 Steps";
    }
  }

  if (runningStep) {
    const stepEl = container.querySelector(`[data-step="${runningStep}"]`);
    if (stepEl) stepEl.classList.add("pipeline-active");
  }

  const activeStep = pipelineState?.currentStep ?? runningStep ?? 1;
  steps.forEach(stepEl => {
    const stepNum = parseInt(stepEl.dataset.step);
    if (stepNum > activeStep && pipelineState && pipelineState.stepStatuses[activeStep] === "failed") {
      stepEl.classList.add("pipeline-blocked");
    }
  });
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

  // FIXED: Properly verifying DOM elements using instanceof instead of incorrect typeof string matches
  const legalCheck = form.querySelector(`[name="generateLegalDocs"]`);
  if (legalCheck && legalCheck instanceof HTMLInputElement) {
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

async function loadProposals(projectId) {
  const proposalSelect = document.getElementById("proposalSelect");
  const qualityContainer = document.getElementById("proposalQualityContainer");
  const qualityGrid = document.getElementById("qualityGrid");
  const overallScore = document.getElementById("proposalOverallScore");
  const exportToolbar = document.getElementById("proposalExportToolbar");
  if (!proposalSelect) return;
  try {
    const payload = await request(`/projects/${projectId}/proposals`);
    const proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
    proposalSelect.innerHTML = "";
    if (proposals.length === 0) {
      proposalSelect.innerHTML = '<option value="">No proposals</option>';
      if (qualityContainer) qualityContainer.style.display = "none";
      if (exportToolbar) exportToolbar.style.display = "none";
      return;
    }
    for (const p of proposals) {
      const option = document.createElement("option");
      option.value = p.id;
      const date = p.createdAt ? new Date(p.createdAt).toLocaleString() : "";
      option.textContent = p.version ? `Proposal v${p.version} - ${date}` : `${p.id} - ${date}`;
      proposalSelect.append(option);
    }
    const latest = proposals[proposals.length - 1];
    proposalSelect.value = latest.id;
    if (latest.overallScore != null) {
      if (overallScore) overallScore.textContent = latest.overallScore.toFixed(1);
      if (qualityContainer) qualityContainer.style.display = "block";
      if (qualityGrid) {
        try {
          const detail = await request(`/projects/${projectId}/proposals/${latest.id}`);
          renderQaGauges(detail.proposal.quality, qualityGrid);
        } catch { /* non-blocking */ }
      }
    } else {
      if (qualityContainer) qualityContainer.style.display = "none";
    }
    if (exportToolbar) exportToolbar.style.display = "flex";
  } catch (error) {
    log("Failed to load proposals", String(error));
    proposalSelect.innerHTML = '<option value="">No proposals</option>';
  }
}

function renderQaGauges(quality, gridEl) {
  if (!quality || !gridEl) return;
  const dims = Array.isArray(quality.dimensions) ? quality.dimensions : [];
  gridEl.innerHTML = "";
  if (dims.length === 0) {
    gridEl.innerHTML = '<span style="grid-column:1/-1;color:#94a3b8;font-size:10px;">No quality dimensions available</span>';
    return;
  }
  for (const d of dims) {
    const pct = Math.round((d.score / d.maxScore) * 100);
    const hue = pct >= 80 ? 142 : pct >= 50 ? 38 : 0;
    const card = document.createElement("div");
    card.style.cssText = "background:rgba(255,255,255,0.03);border-radius:4px;padding:4px;text-align:center;";
    card.innerHTML = `
      <div style="font-size:9px;color:#94a3b8;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${d.label}">${d.label}</div>
      <div style="position:relative;width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:hsl(${hue},70%,50%);border-radius:2px;transition:width .4s;"></div>
      </div>
      <div style="font-size:9px;font-weight:bold;color:hsl(${hue},70%,60%);margin-top:2px;">${d.score.toFixed(1)}</div>
    `;
    gridEl.append(card);
  }
}

async function loadProjects() {
  showLoading("Loading projects...");
  try {
    const payload = await request("/projects");
    const projects = Array.isArray(payload?.projects) ? payload.projects : [];

    if (projectSelect) {
      projectSelect.innerHTML = "";
      for (const project of projects) {
        const option = document.createElement("option");
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.append(option);
      }
    }

    if (projects.length > 0) {
      const activeProject = projects[projects.length - 1];
      setActiveProject(activeProject.id);
      populateIntakeForm(activeProject.intake);
      updateArtifactSelectOptions();
      await loadSprints();
      await loadProposals(activeProjectId);
      await scan();
      await git();
      await getGitHubStatus();
    }
    await loadPipelineState();
  } catch (error) {
    log("Project list unavailable", String(error));
  } finally {
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
    
    // Update Dynamic Authorization Button State from scan
    const authBtn = document.querySelector('[data-action="authorizeUrls"]');
    if (authBtn && payload.scan.authStatus) {
      if (payload.scan.authStatus === "authorized") {
        authBtn.innerHTML = "Filter URL \u2713";
        authBtn.style.background = "#00ffcc";
        authBtn.style.color = "#000";
        authBtn.title = "URLs already authorized. Click to re-scan.";
      } else if (payload.scan.authStatus === "rejected") {
        authBtn.innerHTML = "Filter URL \u2717";
        authBtn.style.background = "#ff4d4d";
        authBtn.style.color = "#fff";
        authBtn.title = "Previously flagged URLs found. Click to re-scan.";
      } else {
        authBtn.innerHTML = "Filter URL";
        authBtn.style.background = "";
        authBtn.style.color = "";
        authBtn.title = "Scan open-source URLs for security risks";
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
    await loadSprints(); 
    if (typeof loadProjectTree === 'function') await loadProjectTree();
    
    // Refresh graph if graph tab is active
    const graphTab = document.getElementById("graphViewTab");
    if (graphTab && graphTab.classList.contains("active") && typeof renderProjectGraph === 'function') {
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

// Dropdown context switcher
if (projectSelect) {
  projectSelect.addEventListener("change", async (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    
    showLoading(`Switching project context to ${selectedId}...`);
    
    try {
      setActiveProject(selectedId);
      
      if (form) {
        form.reset();
        currentStep = 1;
        showStep(currentStep);
      }

      const payload = await request(`/projects/${selectedId}/details`);

      if (payload) {
        const nameInput = form.querySelector('[name="projectName"]');
        if (nameInput) nameInput.value = payload.name || "";
        
        const folderInput = form.querySelector('[name="rootPath"]');
        if (folderInput) folderInput.value = payload.folder || "";
        
        const gitInput = form.querySelector('[name="gitUrl"]');
        if (gitInput) gitInput.value = payload.gitUrl || "";

        if (payload.intake) {
          populateIntakeForm(payload.intake);
        }
      }

      await scan();
      await git();
      await getGitHubStatus();
      await loadSprints();
      await loadProposals(selectedId);
      await loadPipelineState();
      
      showNotification(`Switched context to ${selectedId}`, "success", 3000);
    } catch (error) {
      log("Context switch failed", String(error));
      showNotification("Error changing project configuration profile: " + String(error), "error", 0);
    } finally {
      hideLoading();
    }
  });
}

if (saveArtifactEdit) {
  saveArtifactEdit.addEventListener("click", (e) => {
    e.preventDefault();
    saveEdit();
  });
}

if (cancelArtifactEdit) {
  cancelArtifactEdit.addEventListener("click", (e) => {
    e.preventDefault();
    closeArtifactEdit();
  });
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function loadProjectTree() {
  const container = document.getElementById("folderTreeContainer");
  const dirCountEl = document.getElementById("treeDirCount");
  const fileCountEl = document.getElementById("treeFileCount");
  const sizeEl = document.getElementById("treeTotalSize");
  
  if (!container) return;
  
  container.innerHTML = '<div class="tree-placeholder">Loading tree...</div>';
  
  try {
    const payload = await request(`/projects/${activeProjectId}/tree`);
    
    let dirCount = 0;
    let fileCount = 0;
    let totalSize = 0;
    
    function renderNode(node) {
      if (node.type === 'directory') {
        dirCount++;
        const el = document.createElement('div');
        el.className = 'tree-node dir-node';
        
        const summary = document.createElement('div');
        summary.className = 'tree-item';
        summary.innerHTML = `<span class="icon">📁</span> <span class="name">${node.name}</span>`;
        summary.onclick = (e) => {
          e.stopPropagation();
          el.classList.toggle('collapsed');
        };
        
        el.appendChild(summary);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        if (node.children) {
          for (const child of node.children) {
            childrenContainer.appendChild(renderNode(child));
          }
        }
        el.appendChild(childrenContainer);
        return el;
      } else {
        fileCount++;
        if (node.size) totalSize += node.size;
        
        const el = document.createElement('div');
        el.className = 'tree-node file-node tree-item';
        el.innerHTML = `<span class="icon" style="margin-right: 4px;">📄</span> <span class="name">${node.name}</span> <span class="size" style="color:#666;font-size:0.8em;margin-left:auto;">${formatSize(node.size || 0)}</span>`;
        
        return el;
      }
    }
    
    container.innerHTML = '';
    if (!payload.tree || payload.tree.length === 0) {
      container.innerHTML = '<div class="tree-placeholder">Project folder is empty or not found.</div>';
    } else {
      for (const node of payload.tree) {
        container.appendChild(renderNode(node));
      }
    }
    
    if (dirCountEl) dirCountEl.textContent = dirCount;
    if (fileCountEl) fileCountEl.textContent = fileCount;
    if (sizeEl) sizeEl.textContent = formatSize(totalSize);
    
  } catch (error) {
    log("Failed to load project tree", String(error));
    container.innerHTML = `<div class="tree-placeholder">Failed to load tree: ${error.message}</div>`;
  }
}

const refreshTreeBtn = document.getElementById("refreshTree");
const collapseAllTreeBtn = document.getElementById("collapseAllTree");
const expandAllTreeBtn = document.getElementById("expandAllTree");

if (refreshTreeBtn) refreshTreeBtn.addEventListener("click", () => loadProjectTree());
if (collapseAllTreeBtn) collapseAllTreeBtn.addEventListener("click", () => {
  document.querySelectorAll('.dir-node').forEach(n => n.classList.add('collapsed'));
});
if (expandAllTreeBtn) expandAllTreeBtn.addEventListener("click", () => {
  document.querySelectorAll('.dir-node').forEach(n => n.classList.remove('collapsed'));
});

// Delegate data-action buttons through the command panel
const commandPanel = document.querySelector(".panel.command-panel");
if (commandPanel) {
  commandPanel.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (!action) return;

    showLoading(`Running ${action}...`);
    try {
      switch (action) {
        case "scan": await scan(); break;
        case "validate": await validate(); break;
        case "generateSpecification": await generateSpecification(); break;
        case "applySpec": await applySpec(); break;
        case "createHandoff": await createHandoff(); break;
        case "exportHandoff": await exportHandoff(); break;
        case "dryRun": await dryRun(); break;
        case "authorizeUrls": await authorizeUrls(); break;
        case "git": await git(); break;
        case "accept": await accept(); break;
        case "commit": await commit(); break;
        case "githubSetup": await githubSetup(); break;
        case "artifact": await viewArtifact(); break;
        case "editArtifact": await editArtifact(); break;
        case "previewUpdate": await previewUpdate(); break;
        case "openRefineModal": await openRefineModal(); break;
        case "newProject": await newProject(); break;
        case "removeProject": break;
        default: showNotification(`Unknown action: ${action}`, "error", 5000);
      }
      await loadPipelineState();
    } catch (error) {
      log(`Action ${action} failed`, String(error));
      showNotification(`${action} failed: ${String(error)}`, "error", 0);
    } finally {
      hideLoading();
    }
  });
}

// ── SkillSpector URL Scan Action ──
async function authorizeUrls() {
  const authBtn = document.querySelector('[data-action="authorizeUrls"]');
  // Set loading state
  if (authBtn) {
    authBtn.disabled = true;
    authBtn.innerHTML = "Filtering...";
    authBtn.style.background = "#555";
    authBtn.style.color = "#aaa";
  }
  try {
    const payload = await request(`/projects/${activeProjectId}/authorize-urls`, { method: "POST" });
    if (authBtn) {
      if (payload.passed) {
        authBtn.innerHTML = "URL Passed \u2713";
        authBtn.style.background = "#27ae60";
        authBtn.style.color = "#fff";
        authBtn.title = "All URLs passed SkillSpector security scan.";
        authBtn.classList.add("btn-success");
        authBtn.classList.remove("btn-danger");
      } else {
        authBtn.innerHTML = "URL Failed \u2717";
        authBtn.style.background = "#e74c3c";
        authBtn.style.color = "#fff";
        authBtn.title = "Flagged URLs found. Check report for details.";
        authBtn.classList.add("btn-danger");
        authBtn.classList.remove("btn-success");
      }
    }
    if (payload.flagged && payload.flagged.length > 0) {
      showNotification(`SkillSpector flagged ${payload.flagged.length} URL(s)`, "warning", 5000);
    } else if (payload.passed) {
      showNotification("All URLs passed SkillSpector security scan", "success", 3000);
    }
    log("URL Authorization", payload);
  } catch (error) {
    if (authBtn) {
      authBtn.innerHTML = "URL Failed \u2717";
      authBtn.style.background = "#e74c3c";
      authBtn.style.color = "#fff";
      authBtn.title = "Authorization scan failed.";
      authBtn.classList.add("btn-danger");
      authBtn.classList.remove("btn-success");
    }
    showNotification("URL Authorization failed: " + String(error), "error", 0);
    log("URL Authorization failed", String(error));
  } finally {
    if (authBtn) {
      authBtn.disabled = false;
    }
  }
}

// ── Placeholder actions for unbound data-action buttons ──
async function openRefineModal() { showNotification("Refine: select an artifact first", "info", 3000); }
// ── Export Handoff Action ──
async function exportHandoff() {
  const exportBtn = document.querySelector('[data-action="exportHandoff"]');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.textContent = "Exporting Package...";
    exportBtn.classList.remove("btn-success", "btn-danger");
  }
  showLoading("Exporting handoff package...");
  try {
    const payload = await request(`/projects/${activeProjectId}/handoff/export`, {
      method: "POST",
      body: JSON.stringify({ format: "zip", editor: selectedEditor })
    });
    if (payload.zipBuffer) {
      const byteChars = atob(payload.zipBuffer);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNums);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeProjectId}-handoff-${selectedEditor}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    if (exportBtn) {
      exportBtn.textContent = "Export Complete \u2713";
      exportBtn.classList.add("btn-success");
    }
    showNotification("Handoff package exported successfully", "success", 3000);
    log("Handoff export", payload);
  } catch (error) {
    if (exportBtn) {
      exportBtn.textContent = "Export Failed \u2717";
      exportBtn.classList.add("btn-danger");
    }
    showNotification("Handoff export failed: " + String(error), "error", 0);
    log("Handoff export failed", String(error));
  } finally {
    if (exportBtn) {
      exportBtn.disabled = false;
      setTimeout(() => {
        if (exportBtn) {
          exportBtn.textContent = "Export Handoff Package";
          exportBtn.classList.remove("btn-success", "btn-danger");
        }
      }, 3000);
    }
    hideLoading();
  }
}
async function commit() { showNotification("Commit: no repo action configured", "info", 3000); }
async function newProject() { showNotification("New project picker not yet bound", "info", 3000); }

// ── Proposal Factory Button Handlers ──

async function generateProposal() {
  if (!activeProjectId) return;
  showLoading("Generating Proposal from Architect Intelligence...");
  try {
    const payload = await request(`/projects/${activeProjectId}/proposals/generate`, { method: "POST" });
    showNotification("Proposal generated successfully", "success", 3000);
    log("Proposal generated", payload);
    await loadProposals(activeProjectId);
    const proposal = payload.proposal;
    if (proposal && proposal.quality) {
      const qualityGrid = document.getElementById("qualityGrid");
      const overallScore = document.getElementById("proposalOverallScore");
      if (overallScore) overallScore.textContent = proposal.quality.overallScore.toFixed(1);
      if (qualityGrid) renderQaGauges(proposal.quality, qualityGrid);
      document.getElementById("proposalQualityContainer").style.display = "block";
      document.getElementById("proposalExportToolbar").style.display = "flex";
    }
  } catch (error) {
    log("Generate proposal failed", String(error));
    showNotification("Proposal generation failed: " + String(error), "error", 0);
  } finally {
    hideLoading();
  }
}

async function viewProposal() {
  const proposalSelect = document.getElementById("proposalSelect");
  const qualityGrid = document.getElementById("qualityGrid");
  const overallScore = document.getElementById("proposalOverallScore");
  if (!proposalSelect || !proposalSelect.value) return;
  const proposalId = proposalSelect.value;
  showLoading(`Loading proposal ${proposalId}...`);
  try {
    const payload = await request(`/projects/${activeProjectId}/proposals/${proposalId}`);
    const proposal = payload.proposal;
    if (proposal.fullMarkdown && artifactView) {
      artifactView.value = proposal.fullMarkdown;
      artifactView.readOnly = true;
    }
    if (proposal.quality) {
      if (overallScore) overallScore.textContent = proposal.quality.overallScore.toFixed(1);
      if (qualityGrid) renderQaGauges(proposal.quality, qualityGrid);
      document.getElementById("proposalQualityContainer").style.display = "block";
    }
    if (proposal.quality && proposal.quality.dimensions && proposal.quality.dimensions.length > 0) {
      document.getElementById("proposalExportToolbar").style.display = "flex";
    }
    showNotification(`Loaded proposal ${proposalId}`, "success", 3000);
    log("View proposal", payload);
  } catch (error) {
    log("View proposal failed", String(error));
    showNotification("Failed to load proposal: " + String(error), "error", 0);
  } finally {
    hideLoading();
  }
}

async function exportProposalAction(format) {
  const proposalSelect = document.getElementById("proposalSelect");
  if (!proposalSelect || !proposalSelect.value) {
    showNotification("Select a proposal first", "warning", 3000);
    return;
  }
  const proposalId = proposalSelect.value;
  showLoading(`Exporting proposal as ${format.toUpperCase()}...`);
  try {
    const payload = await request(`/projects/${activeProjectId}/proposals/${proposalId}/export`, {
      method: "POST",
      body: JSON.stringify({ format, options: { force: true } })
    });
    if (payload.url) {
      window.open(payload.url, "_blank");
      showNotification(`Proposal exported — opened ${payload.filename || format}`, "success", 3000);
    } else if (payload.buffer) {
      const byteChars = atob(payload.buffer);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNums)], { type: payload.mimeType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = payload.filename || `${proposalId}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showNotification(`Downloaded ${a.download}`, "success", 3000);
    } else {
      showNotification(`Proposal exported as ${format}`, "success", 3000);
    }
    log("Proposal export", payload);
  } catch (error) {
    log("Export proposal failed", String(error));
    showNotification("Export failed: " + String(error), "error", 0);
  } finally {
    hideLoading();
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  loadProjects();

  // ── Proposal Factory Button Wiring ──
  const generateBtn = document.getElementById("generateProposalBtn");
  if (generateBtn) {
    generateBtn.addEventListener("click", generateProposal);
  }

  const viewBtn = document.getElementById("viewProposalBtn");
  if (viewBtn) {
    viewBtn.addEventListener("click", viewProposal);
  }

  document.querySelectorAll(".export-btn[data-format]").forEach(btn => {
    btn.addEventListener("click", () => {
      const format = btn.dataset.format;
      if (format) exportProposalAction(format);
    });
  });
});

// ── Export Modal Wiring ──
const exportModalOverlay = document.getElementById("exportModalOverlay");
const exportModalClose = document.getElementById("exportModalClose");
const exportCancelBtn = document.getElementById("exportCancelBtn");
const exportExecuteBtn = document.getElementById("exportExecuteBtn");

if (exportModalClose) {
  exportModalClose.addEventListener("click", () => {
    if (exportModalOverlay) exportModalOverlay.classList.remove("active");
  });
}
if (exportCancelBtn) {
  exportCancelBtn.addEventListener("click", () => {
    if (exportModalOverlay) exportModalOverlay.classList.remove("active");
  });
}
if (exportModalOverlay) {
  exportModalOverlay.addEventListener("click", (e) => {
    if (e.target === exportModalOverlay) exportModalOverlay.classList.remove("active");
  });
}

// Format/editor card selection in modal
document.querySelectorAll(".export-card").forEach(card => {
  card.addEventListener("click", () => {
    card.closest(".export-format-grid")?.querySelectorAll(".export-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
    const destSection = document.getElementById("exportDestSection");
    if (destSection) {
      destSection.style.display = card.dataset.format === "folder" ? "block" : "none";
    }
  });
});

document.querySelectorAll(".export-editor-grid .editor-card").forEach(card => {
  card.addEventListener("click", () => {
    card.closest(".export-editor-grid")?.querySelectorAll(".editor-card").forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  });
});

// Modal execute handler — wraps the same export logic
if (exportExecuteBtn) {
  exportExecuteBtn.addEventListener("click", async () => {
    const formatRadio = document.querySelector('input[name="exportFormat"]:checked');
    const editorRadio = document.querySelector('input[name="targetEditor"]:checked');
    const format = formatRadio ? formatRadio.value : "zip";
    const editor = editorRadio ? editorRadio.value : selectedEditor;
    const destPathInput = document.getElementById("exportDestPath");
    const destPath = destPathInput ? destPathInput.value : undefined;

    exportExecuteBtn.disabled = true;
    const btnText = exportExecuteBtn.querySelector(".export-btn-text");
    const btnIcon = exportExecuteBtn.querySelector(".export-btn-icon");
    if (btnText) btnText.textContent = "Exporting...";
    if (btnIcon) btnIcon.textContent = "\u23F3";
    showLoading("Exporting handoff package...");

    try {
      const body = { format, editor };
      if (format === "folder" && destPath) body.destinationPath = destPath;

      const payload = await request(`/projects/${activeProjectId}/handoff/export`, {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (format === "zip" && payload.zipBuffer) {
        const byteChars = atob(payload.zipBuffer);
        const byteNums = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNums)], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${activeProjectId}-handoff-${editor}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }

      if (btnText) btnText.textContent = "Exported \u2713";
      exportExecuteBtn.style.background = "#27ae60";
      showNotification(`Handoff exported as ${format} for ${editor}`, "success", 3000);
      log("Modal handoff export", payload);
    } catch (error) {
      if (btnText) btnText.textContent = "Failed \u2717";
      exportExecuteBtn.style.background = "#e74c3c";
      showNotification("Export failed: " + String(error), "error", 0);
      log("Modal handoff export failed", String(error));
    } finally {
      exportExecuteBtn.disabled = false;
      setTimeout(() => {
        if (btnText) btnText.textContent = "Export Package";
        if (btnIcon) btnIcon.textContent = "\u26A1";
        exportExecuteBtn.style.background = "";
      }, 3000);
      hideLoading();
    }
  });
}