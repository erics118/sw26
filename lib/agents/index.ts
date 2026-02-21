import { query, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import type { SDKResultSuccess } from "@anthropic-ai/claude-agent-sdk";
import type { DatabaseTools } from "./tools/database";

const MODEL = "claude-sonnet-4-6";

export interface AgentRunOptions {
  /** MCP server name — no spaces, use underscores */
  serverName: string;
  /** Database tools from createDatabaseTools() */
  dbTools: DatabaseTools;
  /** Prompt text for the agent */
  prompt: string;
  /** Built-in Claude Code tools to enable (e.g. ["WebSearch", "WebFetch"]) */
  builtinTools?: string[];
  /** Max agent turns before stopping (default: 15) */
  maxTurns?: number;
}

/**
 * Run an agent with database tools and return its JSON output.
 *
 * Agent prompts must end with a JSON block — the result is parsed from
 * SDKResultSuccess.result (the agent's final text response).
 */
export async function runAgent<T>(options: AgentRunOptions): Promise<T> {
  const {
    serverName,
    dbTools,
    prompt,
    builtinTools = [],
    maxTurns = 15,
  } = options;

  const mcpServer = createSdkMcpServer({
    name: serverName,
    tools: [...dbTools] as Parameters<typeof createSdkMcpServer>[0]["tools"],
  });

  let result: SDKResultSuccess | null = null;

  for await (const message of query({
    prompt,
    options: {
      model: MODEL,
      tools: builtinTools,
      mcpServers: { [serverName]: mcpServer },
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns,
    },
  })) {
    if (message.type === "result" && message.subtype === "success") {
      result = message as SDKResultSuccess;
    }
  }

  if (!result) {
    throw new Error("Agent completed without returning a result");
  }

  // Extract JSON — find the first { or [ and last } or ] to tolerate any
  // surrounding prose the model may prepend/append despite prompt instructions.
  const raw = result.result;
  const start = raw.search(/[{[]/);
  const end = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  const jsonText =
    start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim();

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new Error(
      `Agent returned non-JSON result: ${result.result.slice(0, 300)}`,
    );
  }
}
