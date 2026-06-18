import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { FieldValue } from "firebase-admin/firestore";
import { firestore, useFirestoreBackend } from "./firebase.js";
import { ProjectRecord } from "./types.js";

function registryPath(): string {
  return path.resolve(process.env.SHIPTEC_REGISTRY_PATH ?? path.join(".shiptec", "projects.json"));
}

async function ensureRegistry(): Promise<void> {
  await mkdir(path.dirname(registryPath()), { recursive: true });
}

export async function readProjects(): Promise<ProjectRecord[]> {
  if (useFirestoreBackend()) {
    const snapshot = await firestore().collection("projects").orderBy("createdAt").get();
    return snapshot.docs.map((doc) => doc.data() as ProjectRecord);
  }

  try {
    const raw = await readFile(registryPath(), "utf8");
    return JSON.parse(raw) as ProjectRecord[];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  if (useFirestoreBackend()) {
    await firestore().collection("projects").doc(project.id).set({
      ...project,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return;
  }

  await ensureRegistry();
  const projects = await readProjects();
  const next = projects.filter((item) => item.id !== project.id);
  next.push(project);
  await writeFile(registryPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function findProject(projectId: string): Promise<ProjectRecord | undefined> {
  if (useFirestoreBackend()) {
    const snapshot = await firestore().collection("projects").doc(projectId).get();
    return snapshot.exists ? snapshot.data() as ProjectRecord : undefined;
  }

  const projects = await readProjects();
  return projects.find((project) => project.id === projectId);
}
