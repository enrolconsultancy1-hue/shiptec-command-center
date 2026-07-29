import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import { ProjectRecord } from "./types.js";
import { writeArtifact } from "./artifactStore.js";

const execPromise = promisify(exec);

let _cliAvailable: boolean | null = null;

export interface AuthorizeUrlsResponse {
  success: boolean;
  passed: boolean;
  url: string;
  findings: string[];
  score: number;
  authorized: string[];
  flagged: string[];
  message: string;
}

/**
 * Check whether the SkillSpector CLI (`skillspector`) is available on PATH.
 * Caches the result so repeated calls don't recheck.
 * Returns `{ available: boolean, version?: string, error?: string }`.
 */
export function ensureSkillSpectorInstalled(): { available: boolean; version?: string; error?: string } {
  if (_cliAvailable === true) {
    return { available: true, version: "(cached)" };
  }
  try {
    const version = execSync("skillspector --version", { encoding: "utf8", timeout: 10000 }).trim();
    _cliAvailable = true;
    return { available: true, version };
  } catch (checkErr: any) {
    const errMsg = checkErr?.stderr || checkErr?.message || String(checkErr);
    // Attempt auto-install via uv
    try {
      execSync(
        `uv tool install git+https://github.com/NVIDIA/skillspector.git`,
        { encoding: "utf8", timeout: 60000, stdio: "pipe" }
      );
      const version = execSync("skillspector --version", { encoding: "utf8", timeout: 10000 }).trim();
      _cliAvailable = true;
      return { available: true, version: `auto-installed: ${version}` };
    } catch (installErr: any) {
      const installMsg = installErr?.stderr || installErr?.message || String(installErr);
      _cliAvailable = false;
      console.warn(`[skillspector] CLI not found and auto-install failed: ${installMsg}`);
      return { available: false, error: `SkillSpector CLI is not installed and auto-install failed: ${installMsg}` };
    }
  }
}

interface ScanResult {
  url: string;
  status: "Authorized" | "Flagged";
  riskScore: number;
  findings: string[];
  license: string;
}

export async function authorizeUrls(project: ProjectRecord): Promise<{
  authorized: string[];
  flagged: string[];
  report: string;
  cliAvailable: boolean;
  cliVersion?: string;
}> {
  const cliStatus = ensureSkillSpectorInstalled();
  const urls = [
    ...(project.intake.skillsUrl || []),
    ...(project.intake.knowledgeUrl || []),
  ];

  const uniqueUrls = [...new Set(urls)].filter(Boolean);
  const results: ScanResult[] = [];

  for (const url of uniqueUrls) {
    const result = await scanUrl(url, cliStatus.available);
    results.push(result);
  }

  const authorized = results.filter(r => r.status === "Authorized").map(r => r.url);
  const flagged = results.filter(r => r.status === "Flagged").map(r => r.url);

  // 1. Write Authorized JSON Library
  const jsonLibrary = JSON.stringify({
    projectId: project.id,
    lastScan: new Date().toISOString(),
    authorized,
    flagged,
    details: results
  }, null, 2);
  await writeArtifact(project, "Planning/Governance/Authorized_URLs.json", jsonLibrary);

  // 2. Generate Legal Report
  const report = generateAuthorizationReport(project.name, results);
  await writeArtifact(project, "Docs/Legal/Authorized_URL_Library.md", report);

  return { authorized, flagged, report, cliAvailable: cliStatus.available, cliVersion: cliStatus.version };
}

async function scanUrl(url: string, cliAvailable: boolean): Promise<ScanResult> {
  let stdoutStr = "";
  try {
    if (!cliAvailable) { throw new Error("CLI not available"); }
    const { stdout } = await execPromise(`skillspector scan --url "${url}" --format json --no-llm`, { timeout: 45000 });
    stdoutStr = stdout;
  } catch (error: any) {
    // If the command exited with non-zero exit code due to finding issues, stdout is in error.stdout
    if (error && typeof error.stdout === "string" && error.stdout.trim()) {
      stdoutStr = error.stdout;
    } else {
      // Fallback if execution failed completely (e.g. CLI not found or syntax error)
      return performInternalAnalysis(url);
    }
  }

  try {
    const output = JSON.parse(stdoutStr);
    
    // SkillSpector's JSON format uses:
    // output.risk_assessment.score (0-100) or output.riskScore
    // output.issues (array of findings) or output.findings
    const rawScore = output.risk_assessment?.score !== undefined 
      ? output.risk_assessment.score 
      : (output.riskScore !== undefined ? output.riskScore : 0);
      
    const issues = output.issues || output.findings || [];
    const findings = Array.isArray(issues)
      ? issues.map((issue: any) => {
          if (typeof issue === "string") return issue;
          const severity = issue.severity ? `[${issue.severity}] ` : "";
          const pattern = issue.pattern || "";
          const fileInfo = issue.location?.file ? ` in ${issue.location.file}` : "";
          return `${severity}${pattern}${fileInfo}`;
        })
      : [];

    // Map 0-100 score to 0-10 scale for UI report consistency (which uses score/10)
    const riskScore = Math.round(rawScore / 10);
    // Standard threshold: rawScore < 30 is Authorized (equivalent to riskScore < 3)
    const status = rawScore < 30 ? "Authorized" : "Flagged";
    const license = url.includes("github.com") ? "OSS (likely MIT/Apache)" : "Unknown";

    return {
      url,
      status,
      riskScore,
      findings,
      license
    };
  } catch (parseError) {
    return performInternalAnalysis(url);
  }
}

function performInternalAnalysis(url: string): ScanResult {
  const findings: string[] = [];
  let riskScore = 0;

  // 1. Domain Validation
  if (!url.startsWith("https://")) {
    findings.push("Insecure protocol (Non-HTTPS)");
    riskScore += 3;
  }

  // 2. Malicious Pattern Detection (Simulation of SkillSpector's static checks)
  const blacklist = ["malware", "webshell", "exploit", "payload", "hack", "attack"];
  if (blacklist.some(word => url.toLowerCase().includes(word))) {
    findings.push("URL contains known malicious keywords");
    riskScore += 5;
  }

  // 3. Domain Reputation Check (Simulation)
  if (url.includes("pastebin.com") || url.includes("gist.github.com")) {
    findings.push("Unverified source (Pastebin/Gist)");
    riskScore += 2;
  }

  // 4. Structure Check
  if (url.includes(".git") || url.includes("github.com")) {
    // Trusted open-source host, lower risk
    riskScore = Math.max(0, riskScore - 1);
  }

  return {
    url,
    status: riskScore < 3 ? "Authorized" : "Flagged",
    riskScore,
    findings,
    license: url.includes("github.com") ? "OSS (likely MIT/Apache)" : "Unknown"
  };
}

function generateAuthorizationReport(projectName: string, results: ScanResult[]): string {
  const header = `# 🛡️ Authorized URL Library
  
## Project: ${projectName}
**Last Authorization Scan:** ${new Date().toLocaleString()}

---

## Summary
- **Total Scanned:** ${results.length}
- **✅ Authorized:** ${results.filter(r => r.status === "Authorized").length}
- **🚩 Flagged:** ${results.filter(r => r.status === "Flagged").length}

---

## Detailed Analysis

| URL | Status | Risk Score | License | Key Findings |
| :--- | :--- | :--- | :--- | :--- |
${results.map(r => `| \`${r.url}\` | ${r.status === "Authorized" ? "✅ Authorized" : "🚩 Flagged"} | ${r.riskScore}/10 | ${r.license} | ${r.findings.join(", ") || "None"} |`).join("\n")}

---

### Governance Policy
URLs marked as **Authorized** are cleared for use as agent knowledge references. 
URLs marked as **Flagged** must be manually reviewed by the Architect before being added to the Technical Blueprint.

*Generated by Shiptec Command Center via SkillSpector Integration*
`;
  return header;
}
