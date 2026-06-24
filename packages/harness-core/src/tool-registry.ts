// Tool registry for the V1 agent loop.
//
// This module is the single source of truth for the tools an LLM provider may
// be told about during an agent loop. It produces provider-specific tool
// declarations (OpenAI function calling, Anthropic tool_use, Gemini
// functionDeclaration) and maps tool invocations back onto the existing
// policy-gated ToolRequest builders in policy.ts.
//
// Per AGENTS.md the V1 tool surface is limited to local file operations plus
// a narrow read-only fetch path. These already have support in the policy
// engine, risk composition, scoped lease, approval card, consent, and
// verification pipeline; this registry only declares them to the model and
// routes a model tool call back into the corresponding request builders.

// The set of providers resolveModelProvider() accepts. Mirrors the union in
// the TUI CLI; kept local so harness-core stays self-contained.
export type ToolProviderName = "stub" | "openai_responses" | "openai_chat_completions" | "anthropic" | "gemini";

// A JSON Schema describing a single tool's parameters. Kept loose (unknown) so
// provider-specific shapes can be projected without fighting a TS type; the
// registry validates structure at construction time.
export type ToolParametersSchema = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParametersSchema;
  // Maps the tool back to the seed-policy verb so the loop can build the
  // matching ToolRequest without re-deriving intent from the model output.
  // "exec" is a sibling target family (AGENTS.md §13) — side-effecting,
  // always approval-gated, same pipeline as write.
  // "fetch" is a read-only network fetch — no side effects, network lease.
  verb: "read" | "write" | "exec" | "fetch";
};

export type ToolRegistry = {
  tools: ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
  has(name: string): boolean;
  // Provider-format projections. Each returns the array the provider expects in
  // its request payload; the caller attaches it directly.
  toProviderFormat(provider: ToolProviderName): unknown[];
};

export function createToolRegistry(tools: ToolDefinition[]): ToolRegistry {
  // Validate at construction: unique names, required fields, known verbs.
  const seen = new Set<string>();
  for (const tool of tools) {
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error(`ToolRegistry: tool name must be a non-empty string`);
    }
    if (seen.has(tool.name)) {
      throw new Error(`ToolRegistry: duplicate tool name '${tool.name}'`);
    }
    seen.add(tool.name);
    if (typeof tool.description !== "string" || tool.description.length === 0) {
      throw new Error(`ToolRegistry: tool '${tool.name}' requires a description`);
    }
    if (!tool.parameters || typeof tool.parameters !== "object") {
      throw new Error(`ToolRegistry: tool '${tool.name}' requires a parameters schema object`);
    }
    if (tool.verb !== "read" && tool.verb !== "write" && tool.verb !== "exec" && tool.verb !== "fetch") {
      throw new Error(`ToolRegistry: tool '${tool.name}' verb must be 'read', 'write', 'exec', or 'fetch'`);
    }
  }
  const byName = new Map(tools.map((tool) => [tool.name, tool]));
  return {
    tools: [...tools],
    get(name) {
      return byName.get(name);
    },
    has(name) {
      return byName.has(name);
    },
    toProviderFormat(provider) {
      switch (provider) {
        case "openai_responses":
        case "openai_chat_completions":
          return tools.map(toOpenAITool);
        case "anthropic":
          return tools.map(toAnthropicTool);
        case "gemini":
          return tools.map(toGeminiTool);
        case "stub":
          // The stub provider ignores tools (it emits structured text), but
          // returning a stable shape keeps the agent-loop request uniform.
          return tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters }));
        default:
          return [];
      }
    }
  };
}

// The V1 tool surface. local_file_read is L1 allow (workspace-local read,
// local-response egress); local_file_write is L3 ask (needs approval + lease);
// web_fetch is loopback-only and lease-backed.
export function createV1ToolRegistry(): ToolRegistry {
  return createToolRegistry([
    {
      name: "local_file_read",
      description:
        "Read the full contents of a file inside the current workspace boundary. Use this to inspect source, config, or docs before answering or editing. Cannot read outside the workspace or secrets.",
      verb: "read",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative or absolute path to the file to read. Must be inside the workspace root."
          }
        },
        required: ["path"]
      }
    },
    {
      name: "local_file_write",
      description:
        "Create or replace a file inside the current workspace boundary with the given contents. Requires explicit human approval and a scoped lease before execution.",
      verb: "write",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: {
            type: "string",
            description: "Workspace-relative or absolute path to the file to write. Must be inside the workspace root."
          },
          content: {
            type: "string",
            description: "Full text contents to write to the file."
          }
        },
        required: ["path", "content"]
      }
    },
    {
      name: "shell_exec",
      description:
        "Run a shell command in the workspace directory. Returns stdout, stderr, and exit code. Requires explicit human approval (L4 risk — irreversible side effects possible). Timeout defaults to 30 seconds.",
      verb: "exec",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute."
          },
          timeout_ms: {
            type: "number",
            description: "Maximum execution time in milliseconds. Default 30000, max 60000."
          }
        },
        required: ["command"]
      }
    },
    {
      name: "file_edit",
      description:
        "Edit a file by finding old_text and replacing it with new_text. The old_text must appear exactly once in the file. If old_text is empty and the file doesn't exist, creates the file. Requires human approval (L3 risk).",
      verb: "write",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", description: "Workspace-relative or absolute path to the file to edit." },
          old_text: { type: "string", description: "The exact text to find in the file. Must be unique." },
          new_text: { type: "string", description: "The text to replace old_text with." }
        },
        required: ["path", "old_text", "new_text"]
      }
    },
    {
      name: "search_files",
      description:
        "Search for text patterns in workspace files using grep. Returns matching lines with file paths and line numbers. Read-only, auto-approved (L1 risk).",
      verb: "read",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          pattern: { type: "string", description: "Regular expression pattern to search for." },
          glob: { type: "string", description: "Optional file glob pattern to limit search (e.g. '*.ts', 'src/**')." }
        },
        required: ["pattern"]
      }
    },
    {
      name: "list_files",
      description:
        "List files in a directory, optionally filtered by glob pattern. Read-only (L1 risk).",
      verb: "read",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          path: { type: "string", description: "Directory path to list. Defaults to workspace root." },
          recursive: { type: "boolean", description: "Whether to list recursively. Default false." }
        },
        required: []
      }
    },
    {
      name: "web_fetch",
      description:
        "Fetch the content of a loopback HTTP(S) URL and return the response body as text. Read-only, lease-backed, no side effects. Output is truncated to 10000 characters.",
      verb: "fetch",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: {
            type: "string",
            description: "The HTTP(S) URL to fetch."
          }
        },
        required: ["url"]
      }
    },
    {
      name: "agent_spawn",
      description:
        "Spawn a child agent to handle a sub-task synchronously. The child runs with a constrained budget (1000 tokens, 5 tool calls, 30s wall time, L2 max risk) and returns its final answer. Requires human approval (L4 risk — delegates authority to a child).",
      verb: "exec",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          task: {
            type: "string",
            description: "The task description for the child agent."
          }
        },
        required: ["task"]
      }
    }
  ]);
}
function toOpenAITool(tool: ToolDefinition): unknown {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  };
}

function toAnthropicTool(tool: ToolDefinition): unknown {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  };
}

function toGeminiTool(tool: ToolDefinition): unknown {
  return {
    functionDeclarations: [
      {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    ]
  };
}

// Parsed arguments from a model tool call. The loop decodes provider-specific
// argument containers into this uniform shape before routing to the policy
// pipeline.
export type ParsedToolArguments = {
  path?: string;
  content?: string;
  command?: string;
  timeout_ms?: number;
  url?: string;
  task?: string;
};

export function parseToolArguments(raw: string | Record<string, unknown> | undefined): ParsedToolArguments {
  if (raw === undefined || raw === null) {
    return {};
  }
  let obj: Record<string, unknown>;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      } else {
        return {};
      }
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return {};
  }
  const out: ParsedToolArguments = {};
  if (typeof obj.path === "string") {
    out.path = obj.path;
  }
  if (typeof obj.content === "string") {
    out.content = obj.content;
  }
  if (typeof obj.command === "string") {
    out.command = obj.command;
  }
  if (typeof obj.timeout_ms === "number") {
    out.timeout_ms = obj.timeout_ms;
  }
  if (typeof obj.url === "string") {
    out.url = obj.url;
  }
  if (typeof obj.task === "string") {
    out.task = obj.task;
  }
  return out;
}
