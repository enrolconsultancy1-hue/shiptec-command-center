import { Octokit } from "@octokit/rest";
import { simpleGit, StatusResult } from "simple-git";
import { useFirestoreBackend } from "./firebase.js";
import { GitHubConfigStatus, GitStatusSummary } from "./types.js";

export async function ensureGitRepository(rootPath: string): Promise<GitStatusSummary> {
  if (useFirestoreBackend()) {
    return { isRepo: false, clean: true, changedFiles: [] };
  }

  const git = simpleGit(rootPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
  }
  return gitStatus(rootPath);
}

export async function gitStatus(rootPath: string): Promise<GitStatusSummary> {
  if (useFirestoreBackend()) {
    return { isRepo: false, clean: true, changedFiles: [] };
  }

  const git = simpleGit(rootPath);
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    return { isRepo: false, clean: false, changedFiles: [] };
  }
  const status: StatusResult = await git.status();
  return {
    isRepo: true,
    currentBranch: status.current ?? undefined,
    clean: status.isClean(),
    changedFiles: status.files.map((file) => file.path)
  };
}

export async function commitSprint(rootPath: string, message: string): Promise<{ hash?: string; message: string }> {
  const git = simpleGit(rootPath);
  if (!(await git.checkIsRepo())) {
    await git.init();
  }

  await git.add(".");
  const status = await git.status();
  if (status.isClean()) {
    return { message: "No changes to commit." };
  }

  const result = await git.raw([
    "-c",
    "user.name=Shiptec",
    "-c",
    "user.email=shiptec@example.local",
    "commit",
    "-m",
    message
  ]);
  const hash = (await git.revparse(["HEAD"])).trim();
  return { hash, message: result.trim() };
}

export async function setupRemoteRepository(rootPath: string, gitUrl: string): Promise<void> {
  const git = simpleGit(rootPath);
  if (!(await git.checkIsRepo())) {
    await git.init();
  }

  const remotes = await git.getRemotes();
  if (!remotes.some(r => r.name === 'origin')) {
    await git.addRemote('origin', gitUrl);
  }

  await git.add(".");
  await git.commit('Factory Initialization: Shiptec managed project');
  await git.branch(['-M', 'main']);
  
  try {
    await git.push('origin', 'main', ['-u']);
  } catch (error) {
    console.error("Failed to push to remote, manual push required:", error);
  }
}

export async function pushSprint(rootPath: string): Promise<{ message: string }> {
  const git = simpleGit(rootPath);
  if (!(await git.checkIsRepo())) {
    throw new Error("Not a git repository");
  }

  await git.push();
  return { message: "Pushed to origin." };
}

export function githubConfigStatus(): GitHubConfigStatus {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { configured: false, reason: "GITHUB_TOKEN is not configured." };
  }
  new Octokit({ auth: token });
  return { configured: true };
}
