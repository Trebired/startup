import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const packageJsonPath = path.join(rootDir, "package.json");
const aliasMapDir = path.join(rootDir, ".trebired/code-discipline", "imports");
const tempDir = path.join(rootDir, ".tmp");
const backupPath = path.join(tempDir, "package.json.backup");
const command = process.argv[2];

async function main() {
  if (command === "prepare-dist") return await prepareDist();
  if (command === "prepack") return await preparePack();
  if (command === "postpack") return await restorePackageJson();
  throw new Error(`Unknown prepare-dist command: ${command}`);
}

async function prepareDist() {
  const aliasMap = await readAliasMap();
  await fs.cp(path.join(distDir, "src"), distDir, { force: true, recursive: true });
  const files = await collectDistFiles();

  for (const filePath of files) {
    const original = await fs.readFile(filePath, "utf8");
    const rewritten = rewriteAliasImports(original, filePath, aliasMap);
    if (rewritten !== original) await fs.writeFile(filePath, rewritten);
  }
}

async function preparePack() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.copyFile(packageJsonPath, backupPath);
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function restorePackageJson() {
  const original = await fs.readFile(backupPath, "utf8");
  await fs.writeFile(packageJsonPath, original);
  await fs.rm(backupPath, { force: true });
}

async function readAliasMap() {
  const aliases = {};
  try {
    const entries = await fs.readdir(aliasMapDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const raw = await fs.readFile(path.join(aliasMapDir, entry.name), "utf8");
      Object.assign(aliases, JSON.parse(raw));
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return aliases;
}

async function collectDistFiles() {
  const files = [];
  const stack = [distDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(nextPath);
      if (entry.isFile() && /\.(?:js|d\.ts)$/u.test(nextPath)) files.push(nextPath);
    }
  }
  return files;
}

function rewriteAliasImports(source, filePath, importsMap) {
  return source.replace(/(["'])(#[^"']+)\1/g, (match, quote, alias) => {
      const target = importsMap[alias];
      const compiledPath = target ? resolveCompiledTarget(String(target)) : "";
      if (!compiledPath) return match;
      const relativePath = toRelativeImport(path.relative(path.dirname(filePath), compiledPath));
      return `${quote}${relativePath}${quote}`;
  });
}

function resolveCompiledTarget(target) {
  const normalized = normalizePath(target);
  if (normalized.startsWith("src/")) {
    return path.join(distDir, replaceSourceExtension(normalized.slice(4)));
  }
  return null;
}

function replaceSourceExtension(value) {
  return value.replace(/\.(ts|tsx|js|jsx)$/u, ".js");
}

function toRelativeImport(value) {
  const normalized = normalizePath(value);
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

function normalizePath(value) {
  return value.replace(/\\/gu, "/").replace(/^\.\//u, "");
}

await main();
