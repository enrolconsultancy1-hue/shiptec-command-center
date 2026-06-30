/**
 * graphService.ts
 *
 * Graphify-inspired knowledge graph builder for Shiptec projects.
 *
 * Inspired by: https://github.com/safishamsi/graphify
 *
 * Walks the project folder tree and builds a rich knowledge graph of:
 *   Root → Governance docs → Sprints → Sprint artifacts
 *          → Docs (Architecture, Planning, etc.)
 *          → Planning artifacts
 *          → Top-level files
 *
 * Node types mirror graphify's file_type taxonomy:
 *   "Root"        — the project itself
 *   "Group"       — a folder grouping (Docs, Planning, Sprints, Governance)
 *   "Module"      — named architecture modules (Modules/*.md)
 *   "Sprint"      — a sprint folder
 *   "File"        — any .md artifact (blueprint, governance, plan, etc.)
 *   "Config"      — config files (*.json, *.ts, *.js at root level)
 *
 * Edge relations mirror graphify's relation vocabulary:
 *   "contains"    — parent group → child group or artifact
 *   "defines"     — sprint → sprint plan
 *   "blueprint"   — root/group → architecture file
 *   "governs"     — governance doc → project
 *   "component"   — root → named module
 *   "plans"       — planning doc → sprint or feature
 */

import { getProject } from "../projectService.js";
import fs from "fs/promises";
import path from "path";

export type NodeType =
  | "Root"
  | "Group"
  | "Module"
  | "Sprint"
  | "File"
  | "Config";

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  source_file?: string;
  status?: "completed" | "in_progress" | "pending";
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface ProjectGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    totalNodes: number;
    totalEdges: number;
    sprintCount: number;
    docCount: number;
    moduleCount: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Make a safe node id from a path segment */
function makeId(...parts: string[]): string {
  return parts
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** List directory entries, returning [] on missing dir */
async function safeReaddir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

/** Check if a path exists */
async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ─── Main Graph Generator ─────────────────────────────────────────────────────

export async function generateProjectGraph(projectId: string): Promise<ProjectGraph> {
  const project = await getProject(projectId);
  const root = project.rootPath;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const seenIds = new Set<string>();

  function addNode(node: GraphNode): void {
    if (!seenIds.has(node.id)) {
      seenIds.add(node.id);
      nodes.push(node);
    }
  }

  function addEdge(from: string, to: string, label: string): void {
    // Avoid duplicate edges
    const key = `${from}→${to}→${label}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      edges.push({ from, to, label });
    }
  }

  // ── 1. Root node ────────────────────────────────────────────────────────────
  const rootId = "root";
  addNode({ id: rootId, label: project.name, type: "Root", source_file: root });

  // ── 2. Governance folder ────────────────────────────────────────────────────
  const govPath = path.join(root, "Planning", "Governance");
  const govFiles = await safeReaddir(govPath);

  if (govFiles.length > 0) {
    const govGroupId = "governance";
    addNode({ id: govGroupId, label: "Governance", type: "Group", source_file: govPath });
    addEdge(rootId, govGroupId, "contains");

    for (const f of govFiles) {
      if (f.endsWith(".md")) {
        const fileId = makeId("gov", f.replace(/\.md$/i, ""));
        addNode({
          id: fileId,
          label: f.replace(/\.md$/i, "").replace(/_/g, " "),
          type: "File",
          source_file: path.join(govPath, f),
        });
        addEdge(govGroupId, fileId, "governs");
      }
    }
  }

  // ── 3. Sprints ───────────────────────────────────────────────────────────────
  const sprintPath = path.join(root, "Sprints");
  const sprints = (await safeReaddir(sprintPath)).filter(
    (s) => !s.startsWith(".")
  );

  if (sprints.length > 0) {
    const sprintsGroupId = "sprints_group";
    addNode({ id: sprintsGroupId, label: "Sprints", type: "Group", source_file: sprintPath });
    addEdge(rootId, sprintsGroupId, "contains");

    for (const sprint of sprints) {
      const sprintDir = path.join(sprintPath, sprint);
      let stat;
      try {
        stat = await fs.stat(sprintDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const sprintId = makeId("sprint", sprint);
      addNode({ id: sprintId, label: sprint, type: "Sprint", source_file: sprintDir });
      addEdge(sprintsGroupId, sprintId, "contains");

      // Sprint artifacts
      const sprintFiles = await safeReaddir(sprintDir);
      for (const sf of sprintFiles) {
        if (!sf.endsWith(".md")) continue;
        const sfId = makeId(sprintId, sf.replace(/\.md$/i, ""));
        const isSprintPlan = sf.toLowerCase().includes("sprint_plan");
        addNode({
          id: sfId,
          label: sf.replace(/\.md$/i, "").replace(/_/g, " "),
          type: "File",
          source_file: path.join(sprintDir, sf),
        });
        addEdge(sprintId, sfId, isSprintPlan ? "defines" : "contains");
      }
    }
  }

  // ── 4. Docs / Architecture ────────────────────────────────────────────────
  const docsPath = path.join(root, "Docs");
  const docDirs = await safeReaddir(docsPath);

  if (docDirs.length > 0) {
    const docsGroupId = "docs_group";
    addNode({ id: docsGroupId, label: "Docs", type: "Group", source_file: docsPath });
    addEdge(rootId, docsGroupId, "contains");

    for (const docDir of docDirs) {
      const docDirPath = path.join(docsPath, docDir);
      let dstat;
      try {
        dstat = await fs.stat(docDirPath);
      } catch {
        continue;
      }

      if (dstat.isDirectory()) {
        const subGroupId = makeId("docs", docDir);
        addNode({
          id: subGroupId,
          label: docDir,
          type: "Group",
          source_file: docDirPath,
        });
        addEdge(docsGroupId, subGroupId, "contains");

        const subFiles = await safeReaddir(docDirPath);
        for (const sf of subFiles) {
          const sfPath = path.join(docDirPath, sf);

          let sfstat;
          try {
            sfstat = await fs.stat(sfPath);
          } catch {
            continue;
          }

          if (sfstat.isDirectory()) {
            // Nested subdir (e.g. Modules/)
            const nestedGroupId = makeId("docs", docDir, sf);
            addNode({
              id: nestedGroupId,
              label: sf,
              type: "Group",
              source_file: sfPath,
            });
            addEdge(subGroupId, nestedGroupId, "contains");

            const nestedFiles = await safeReaddir(sfPath);
            for (const nf of nestedFiles) {
              if (!nf.endsWith(".md")) continue;
              const nfId = makeId("docs", docDir, sf, nf.replace(/\.md$/i, ""));
              addNode({
                id: nfId,
                label: nf.replace(/\.md$/i, "").replace(/_/g, " "),
                type: "Module",
                source_file: path.join(sfPath, nf),
              });
              addEdge(nestedGroupId, nfId, "component");
            }
          } else if (sf.endsWith(".md")) {
            const sfId = makeId("docs", docDir, sf.replace(/\.md$/i, ""));
            addNode({
              id: sfId,
              label: sf.replace(/\.md$/i, "").replace(/_/g, " "),
              type: "File",
              source_file: sfPath,
            });
            addEdge(subGroupId, sfId, "blueprint");
          }
        }
      } else if (docDir.endsWith(".md")) {
        // Top-level doc file
        const fileId = makeId("docs", docDir.replace(/\.md$/i, ""));
        addNode({
          id: fileId,
          label: docDir.replace(/\.md$/i, "").replace(/_/g, " "),
          type: "File",
          source_file: docDirPath,
        });
        addEdge(docsGroupId, fileId, "blueprint");
      }
    }
  }

  // ── 5. Planning folder ────────────────────────────────────────────────────
  const planPath = path.join(root, "Planning");
  const planEntries = await safeReaddir(planPath);

  if (planEntries.length > 0) {
    const planGroupId = "planning_group";
    addNode({ id: planGroupId, label: "Planning", type: "Group", source_file: planPath });
    addEdge(rootId, planGroupId, "contains");

    for (const pe of planEntries) {
      const pePath = path.join(planPath, pe);
      let pestat;
      try {
        pestat = await fs.stat(pePath);
      } catch {
        continue;
      }

      if (pestat.isDirectory()) {
        // Already handled Governance above; skip re-adding
        if (pe === "Governance") continue;
        const subId = makeId("planning", pe);
        addNode({ id: subId, label: pe, type: "Group", source_file: pePath });
        addEdge(planGroupId, subId, "contains");

        const subFiles = await safeReaddir(pePath);
        for (const sf of subFiles) {
          if (!sf.endsWith(".md")) continue;
          const sfId = makeId("planning", pe, sf.replace(/\.md$/i, ""));
          addNode({
            id: sfId,
            label: sf.replace(/\.md$/i, "").replace(/_/g, " "),
            type: "File",
            source_file: path.join(pePath, sf),
          });
          addEdge(subId, sfId, "plans");
        }
      } else if (pe.endsWith(".md")) {
        const fileId = makeId("planning", pe.replace(/\.md$/i, ""));
        addNode({
          id: fileId,
          label: pe.replace(/\.md$/i, "").replace(/_/g, " "),
          type: "File",
          source_file: pePath,
        });
        addEdge(planGroupId, fileId, "plans");
      }
    }
  }

  // ── 6. Top-level config / key files ───────────────────────────────────────
  const topLevel = await safeReaddir(root);
  const keyExts = [".md", ".json"];
  const skipDirs = new Set(["Sprints", "Docs", "Planning", "node_modules", ".git", ".github"]);

  for (const entry of topLevel) {
    if (skipDirs.has(entry)) continue;
    const entryPath = path.join(root, entry);
    let estat;
    try {
      estat = await fs.stat(entryPath);
    } catch {
      continue;
    }
    if (estat.isDirectory()) continue;

    const ext = path.extname(entry).toLowerCase();
    if (!keyExts.includes(ext)) continue;

    const fileId = makeId("root_file", entry.replace(/\.[^.]+$/, ""));
    addNode({
      id: fileId,
      label: entry,
      type: ext === ".json" ? "Config" : "File",
      source_file: entryPath,
    });
    addEdge(rootId, fileId, "contains");
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    sprintCount: nodes.filter((n) => n.type === "Sprint").length,
    docCount: nodes.filter((n) => n.type === "File").length,
    moduleCount: nodes.filter((n) => n.type === "Module").length,
  };

  return { nodes, edges, stats };
}
