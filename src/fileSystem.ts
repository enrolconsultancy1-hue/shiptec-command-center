import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function safeProjectPath(rootPath: string, relativePath: string): string {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`Refusing to access path outside project root: ${relativePath}`);
  }
  return resolvedTarget;
}

export async function writeFileIfMissing(rootPath: string, relativePath: string, content: string): Promise<"created" | "existing"> {
  const target = safeProjectPath(rootPath, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  if (await exists(target)) {
    return "existing";
  }
  await writeFile(target, content, "utf8");
  return "created";
}

export async function readTextIfExists(rootPath: string, relativePath: string): Promise<string | undefined> {
  const target = safeProjectPath(rootPath, relativePath);
  if (!(await exists(target))) {
    return undefined;
  }
  return readFile(target, "utf8");
}
