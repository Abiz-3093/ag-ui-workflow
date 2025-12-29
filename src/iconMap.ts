const ICONS: Record<string, string> = {
  "ai-agent": "🤖",
  model: "🧠",
  memory: "🧠",
  tool: "🛠️",
  "ai-tool": "🛠️",
  "mcp-tool": "🛰️",
  trigger: "🔔",
  "webhook-trigger": "📥",
  cron: "⏱️",
  http: "🌐",
  "webhook-call": "📤",
  "slack-send": "💬",
  "db-query": "🗄️",
  "file-read": "📄",
  "file-write": "📝",
  transform: "🔀",
  if: "🔀",
  merge: "➕",
  delay: "⏳",
  email: "✉️",
};

export function iconForType(type?: string): string {
  if (!type) return "🔹";
  return ICONS[type] ?? "🔹";
}
