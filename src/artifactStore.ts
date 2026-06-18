import { FieldValue } from "firebase-admin/firestore";
import { exists, readTextIfExists, safeProjectPath, writeFileIfMissing } from "./fileSystem.js";
import { firestore, useFirestoreBackend } from "./firebase.js";
import { ProjectRecord } from "./types.js";
import { readFile, writeFile } from "node:fs/promises";

function artifactDocId(relativePath: string): string {
  return encodeURIComponent(relativePath);
}

function artifactCollection(projectId: string) {
  return firestore().collection("projects").doc(projectId).collection("artifacts");
}

export async function artifactExists(project: ProjectRecord, relativePath: string): Promise<boolean> {
  if (!useFirestoreBackend()) {
    return exists(safeProjectPath(project.rootPath, relativePath));
  }

  const snapshot = await artifactCollection(project.id).doc(artifactDocId(relativePath)).get();
  return snapshot.exists;
}

export async function readArtifactText(project: ProjectRecord, relativePath: string): Promise<string> {
  if (!useFirestoreBackend()) {
    return readFile(safeProjectPath(project.rootPath, relativePath), "utf8");
  }

  const snapshot = await artifactCollection(project.id).doc(artifactDocId(relativePath)).get();
  if (!snapshot.exists) {
    throw new Error(`Artifact does not exist: ${relativePath}`);
  }

  const content = snapshot.get("content");
  if (typeof content !== "string") {
    throw new Error(`Artifact content is invalid: ${relativePath}`);
  }
  return content;
}

export async function readArtifactTextIfExists(project: ProjectRecord, relativePath: string): Promise<string | undefined> {
  if (!useFirestoreBackend()) {
    return readTextIfExists(project.rootPath, relativePath);
  }

  const snapshot = await artifactCollection(project.id).doc(artifactDocId(relativePath)).get();
  if (!snapshot.exists) {
    return undefined;
  }

  const content = snapshot.get("content");
  return typeof content === "string" ? content : undefined;
}

export async function writeArtifactIfMissing(project: ProjectRecord, relativePath: string, content: string): Promise<"created" | "existing"> {
  if (!useFirestoreBackend()) {
    return writeFileIfMissing(project.rootPath, relativePath, content);
  }

  const doc = artifactCollection(project.id).doc(artifactDocId(relativePath));
  const snapshot = await doc.get();
  if (snapshot.exists) {
    return "existing";
  }

  await doc.set({
    path: relativePath,
    content,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return "created";
}

export async function writeArtifact(project: ProjectRecord, relativePath: string, content: string): Promise<string> {
  if (!useFirestoreBackend()) {
    const target = safeProjectPath(project.rootPath, relativePath);
    await writeFile(target, content, "utf8");
    return target;
  }

  await artifactCollection(project.id).doc(artifactDocId(relativePath)).set({
    path: relativePath,
    content,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return `firestore://projects/${project.id}/artifacts/${relativePath}`;
}
