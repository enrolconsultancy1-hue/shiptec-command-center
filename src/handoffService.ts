import { ProjectRecord } from "./types.js";
import { readProjectArtifact } from "./projectService.js";
import path from "node:path";
import fs from "node:fs/promises";

export async function createHandoffPackage(project: ProjectRecord): Promise<{ packagePath: string; filesIncluded: string[] }> {
  const handoffDir = path.join(project.rootPath, ".shiptec-handoff");
  
  // Ensure directory exists
  await fs.mkdir(handoffDir, { recursive: true });
  
  const essentialArtifacts = [
    "Planning/Architect_Pack.md",
    "Planning/Technical_Blueprint.md",
    "Planning/Builder_Specification.md",
    "Planning/Governance/Acceptance_Criteria.md",
    "Planning/Governance/Current_State.md"
  ];
  
  const filesIncluded: string[] = [];
  
  for (const artifactPath of essentialArtifacts) {
    try {
      const artifact = await readProjectArtifact(project, artifactPath);
      const destPath = path.join(handoffDir, path.basename(artifactPath));
      await fs.writeFile(destPath, artifact.content);
      filesIncluded.push(artifactPath);
    } catch (e) {
      console.error(`Could not include ${artifactPath} in handoff:`, e);
    }
  }
  
  // Also include the current state as a summary file
  await fs.writeFile(
    path.join(handoffDir, "HANDOFF_SUMMARY.txt"), 
    `Project: ${project.name}\nID: ${project.id}\nGenerated: ${new Date().toISOString()}\n\nFiles included for external editor implementation.`
  );

  // Generate the ultimate HANDOFF_GUIDE.md for external AI Editors
  const handoffGuideContent = `# 🧭 SHIPTEC HANDOFF GUIDE (Instructions for external AI Editors)

> **FOR CO-PILOT, CURSOR, ANTIGRAVITY, OPEN CODE, OR CLAUDE CODE**
> This directory represents a fully governed Architect Handoff. Do not deviate from these files.

---

## 🎯 HOW TO EXECUTE THIS SPRINT WITH MAXIMUM TOKEN EFFICIENCY

### 1. Read the Context (Do this first)
Before writing any code, open and read these files to load the full architectural context:
- **\`Builder_Specification.md\`**: The master instruction set and file tree snapshot.
- **\`Architect_Pack.md\`**: The user's product vision and MVP definitions.
- **\`Technical_Blueprint.md\`**: Stacks, rules, constraints, and custom skills.

### 2. Leverage Anchored Skills & Knowledge
The Architect has anchored this project to verified external sources:
- **Verified Skills Reference:** ${project.intake.skillsUrl || "None (Use standard industry patterns)"}
- **Reference Projects Knowledge:** ${project.intake.knowledgeUrl || "None (Implement directly from constraints)"}

*Command:* If a GitHub URL is provided above, you MUST prioritize its design patterns, UI styling, and structure.

### 3. Change Budget (Critical!)
To optimize tokens and prevent code bloat, respect these limits:
- **Max Modified Files:** 5
- **Max Created Files:** 2
- **Max Line Count Change:** 500 lines

### 4. Implementation Flow
1. **Dry Run first:** List your intended file edits and explain *how* they solve the target task.
2. **Review:** Present the dry run to the user for approval.
3. **Execute:** Edit the files carefully. Do not write generic or placeholder code.
4. **Validation:** Write or run existing tests to verify that the implementation works 100%.

---

*Handoff generated successfully by Shiptec Command Center.*
`;

  await fs.writeFile(
    path.join(handoffDir, "HANDOFF_GUIDE.md"),
    handoffGuideContent
  );
  
  filesIncluded.push("HANDOFF_GUIDE.md");

  return {
    packagePath: handoffDir,
    filesIncluded
  };
}
