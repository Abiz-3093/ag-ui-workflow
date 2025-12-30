import { N8N_NODE_TEMPLATES } from "./generatedN8nNodes";

export type NodeTemplate = {
  type: string;
  label: string;
  description: string;
  category?: string;
  icon?: string;
  docUrl?: string;
  defaults?: {
    config?: Record<string, unknown>;
  };
};

const CORE_NODE_TEMPLATES: NodeTemplate[] = [
  { type: "trigger", label: "Trigger", description: "Start the workflow", category: "Core" },
  { type: "webhook-trigger", label: "Webhook Trigger", description: "Start from inbound HTTP call", category: "Triggers" },
  { type: "cron", label: "Schedule", description: "Run on an interval or cron", category: "Triggers" },
  { type: "ai-agent", label: "AI Agent", description: "LLM with model/memory/tools", category: "AI" },
  {
    type: "model",
    label: "Chat Model",
    description: "Connect a model endpoint",
    category: "AI",
    defaults: { config: { model: "gpt-4o-mini", guardrail: "", endpoint: "", apiKey: "" } },
  },
  {
    type: "memory",
    label: "Memory",
    description: "Persist conversation state",
    category: "AI",
    defaults: { config: { memory: "conversation-buffer" } },
  },
  {
    type: "tool",
    label: "AI Agent Tool",
    description: "Expose an AI agent action (n8n-style tool)",
    category: "AI",
    defaults: { config: { tools: [] } },
  },
  {
    type: "mcp-tool",
    label: "MCP Server Tool",
    description: "Call an MCP server tool in the graph",
    category: "AI",
    defaults: { config: { server: "", tool: "", params: "{}" } },
  },
  { type: "http", label: "HTTP Request", description: "Call an API", category: "Integrations" },
  { type: "webhook-call", label: "Webhook Call", description: "Send outbound webhook", category: "Integrations" },
  { type: "slack-send", label: "Slack Send", description: "Send message to Slack", category: "Integrations" },
  { type: "db-query", label: "Database Query", description: "Run SQL against a database", category: "Data" },
  { type: "file-read", label: "File Read", description: "Read file contents", category: "Files" },
  { type: "file-write", label: "File Write", description: "Write or append to a file", category: "Files" },
  { type: "transform", label: "Transform", description: "Map/shape data", category: "Logic" },
  { type: "if", label: "If / Branch", description: "Conditional logic", category: "Logic" },
  { type: "merge", label: "Merge", description: "Combine multiple inputs", category: "Logic" },
  { type: "delay", label: "Delay", description: "Wait for a duration", category: "Logic" },
  { type: "email", label: "Send Email", description: "Notify someone", category: "Integrations" },
];

function dedupeByType(templates: NodeTemplate[]): NodeTemplate[] {
  const seen = new Set<string>();
  return templates.filter((t) => {
    if (seen.has(t.type)) return false;
    seen.add(t.type);
    return true;
  });
}

export const NODE_BASE: NodeTemplate[] = dedupeByType([...CORE_NODE_TEMPLATES, ...N8N_NODE_TEMPLATES]);
