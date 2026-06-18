import { ProjectScan, HealthScore, GitStatusSummary } from "./types.js";
import { readTextIfExists } from "./fileSystem.js";

function hasFile(scan: ProjectScan, relativePath: string): boolean {
  return scan.files.some((file) => file.path === relativePath && file.exists);
}

export async function calculateHealth(scan: ProjectScan, gitStatus?: GitStatusSummary): Promise<HealthScore> {
  let score = 0;
  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  const planningFiles = scan.files.filter((file) => file.path.startsWith("Planning/"));

  if (scan.missingFiles.length === 0) {
    score += 15;
    reasons.push("Required folder structure and files exist.");
  } else {
    recommendedActions.push("Create missing source-of-truth planning files.");
  }

  if (planningFiles.every((file) => file.exists)) {
    score += 15;
    reasons.push("Required planning files exist.");
  }

  const acceptance = await readTextIfExists(scan.rootPath, "Planning/Governance/Acceptance_Criteria.md");
  if (acceptance && acceptance.includes("- ") && !acceptance.includes("- TBD")) {
    score += 15;
    reasons.push("Acceptance criteria are present.");
  } else {
    recommendedActions.push("Write specific acceptance criteria.");
  }

  if (hasFile(scan, "Planning/Governance/Open_Questions.md")) {
    score += 10;
    reasons.push("Open questions are tracked.");
  }

  if (hasFile(scan, "Planning/Governance/Risks.md")) {
    score += 10;
    reasons.push("Risks are tracked.");
  }

  if (hasFile(scan, "Sprints/Sprint_001/Sprint_Plan.md")) {
    score += 10;
    reasons.push("Current sprint has a plan.");
  }

  if (hasFile(scan, "Sprints/Sprint_001/Builder_Dry_Run.md")) {
    score += 10;
    reasons.push("Builder dry run exists.");
  }

  if (hasFile(scan, "Sprints/Sprint_001/Test_Report.md")) {
    score += 10;
    reasons.push("Test report exists.");
  }

  if (gitStatus?.isRepo && gitStatus.clean) {
    score += 5;
    reasons.push("Git repository is initialized and clean.");
  } else if (gitStatus?.isRepo) {
    recommendedActions.push("Review current Git changes before sprint acceptance.");
  } else {
    recommendedActions.push("Initialize Git when ready for sprint commits.");
  }

  return {
    score,
    reasons,
    recommendedActions
  };
}
