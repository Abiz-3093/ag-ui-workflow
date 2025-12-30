import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, "..");
const NODES_DIR = path.join(ROOT, "nodes");
const OUT_FILE = path.join(ROOT, "src", "nodes", "generatedN8nNodes.ts");
const ICON_OUT_DIR = path.join(ROOT, "public", "n8n-icons");

const IGNORE_PARTS = new Set([
  "v1",
  "v2",
  "v3",
  "v4",
  "v5",
  "v6",
  "v7",
  "v8",
  "v9",
  "test",
  "tests",
  "__tests__",
  "__mocks__",
  "descriptions",
  "helpers",
  "shared",
  "utils",
  "transport",
  "types",
  "interfaces",
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isIgnored(part) {
  const normalized = part.toLowerCase();
  return IGNORE_PARTS.has(normalized) || /^v\d/.test(normalized);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isIgnored(entry.name)) continue;
      files = files.concat(walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".node.ts")) {
      if (isIgnored(path.basename(dir))) continue;
      files.push(full);
    }
  }
  return files;
}

function extractField(content, fieldName) {
  const regex = new RegExp(`\\b${fieldName}\\b\\s*:\\s*(['"\`])([\\s\\S]*?)\\1`, "i");
  const match = content.match(regex);
  if (!match) return "";
  return match[2].replace(/\s+/g, " ").trim();
}

function resolveIcon(filePath, iconField) {
  if (!iconField || !iconField.startsWith("file:")) return undefined;
  const iconRel = iconField.replace(/^file:/, "");
  const iconAbs = path.join(path.dirname(filePath), iconRel);
  if (!fs.existsSync(iconAbs)) return undefined;
  const ext = path.extname(iconAbs) || ".svg";
  const slug = path.basename(filePath, ".node.ts").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const outName = `${slug}${ext}`;
  ensureDir(ICON_OUT_DIR);
  const outPath = path.join(ICON_OUT_DIR, outName);
  try {
    fs.copyFileSync(iconAbs, outPath);
    return `/n8n-icons/${outName}`;
  } catch (err) {
    console.warn(`Failed to copy icon for ${filePath}:`, err.message);
    return undefined;
  }
}

function readCategories(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    const categories = parsed?.categories;
    if (Array.isArray(categories) && categories.length) {
      return String(categories[0]);
    }
  } catch (err) {
    // ignore malformed docs
  }
  return undefined;
}

function readDocs(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw);
    const primary = parsed?.resources?.primaryDocumentation;
    if (Array.isArray(primary) && primary.length && primary[0]?.url) {
      return String(primary[0].url);
    }
  } catch (err) {
    // ignore malformed docs
  }
  return undefined;
}

function collectNodes() {
  if (!fs.existsSync(NODES_DIR)) {
    throw new Error(`nodes directory not found at ${NODES_DIR}`);
  }

  const files = walk(NODES_DIR);
  const seen = new Map();

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, "utf8");
    const displayName = extractField(content, "displayName") || path.basename(filePath, ".node.ts");
    const type = extractField(content, "name") || displayName.toLowerCase().replace(/\s+/g, "-");
    const description = extractField(content, "description") || "n8n node";
    const iconField = extractField(content, "icon");
    const icon = resolveIcon(filePath, iconField);

    const jsonPath = filePath.replace(/\.ts$/, ".json");
    const category = fs.existsSync(jsonPath) ? readCategories(jsonPath) : undefined;
    const docUrl = fs.existsSync(jsonPath) ? readDocs(jsonPath) : undefined;

    if (seen.has(type)) continue;

    seen.set(type, {
      type,
      label: displayName,
      description,
      ...(category ? { category } : {}),
      ...(icon ? { icon } : {}),
      ...(docUrl ? { docUrl } : {}),
    });
  }

  return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function formatNode(node) {
  const { type, label, description, category, icon, docUrl } = node;
  const extras = [];
  if (category) extras.push(`category: ${JSON.stringify(category)}`);
  if (icon) extras.push(`icon: ${JSON.stringify(icon)}`);
  if (docUrl) extras.push(`docUrl: ${JSON.stringify(docUrl)}`);
  const extrasLine = extras.length ? `, ${extras.join(", ")}` : "";
  return `  { type: ${JSON.stringify(type)}, label: ${JSON.stringify(label)}, description: ${JSON.stringify(description)}${extrasLine} }`;
}

function main() {
  const nodes = collectNodes();
  const header = `// Auto-generated from /nodes by scripts/generate-n8n-node-templates.js\n// Generated at ${new Date().toISOString()}\nimport type { NodeTemplate } from "./nodeBase";\n\nexport const N8N_NODE_TEMPLATES: NodeTemplate[] = [\n`;
  const body = nodes.map(formatNode).join(",\n");
  const footer = `\n];\n`;

  const outDir = path.dirname(OUT_FILE);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_FILE, header + body + footer, "utf8");
  console.log(`Wrote ${nodes.length} nodes to ${OUT_FILE}`);
}

main();
