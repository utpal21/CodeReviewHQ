import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import chalk from "chalk";
import {
  reviewPRAsync,
  reviewSingleFile,
  getAvailableReviewers,
  fetchPullRequests,
  reviewGitHubPR,
  reviewMultiplePRs,
  isGitHubConfigured
} from "./tools.js";

// ============================================================================
// Dev Logging Utilities
// ============================================================================

const isDev = process.env.NODE_ENV !== "production";

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

function formatLatency(ms: number): string {
  if (ms < 100) return chalk.green(`${ms}ms`);
  if (ms < 500) return chalk.yellow(`${ms}ms`);
  return chalk.red(`${ms}ms`);
}

function truncate(str: string, maxLen = 60): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function logRequest(method: string, params?: unknown): void {
  if (!isDev) return;

  const paramsStr = params ? chalk.gray(` ${truncate(JSON.stringify(params))}`) : "";
  console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.cyan("→")} ${method}${paramsStr}`);
}

function logResponse(method: string, result: unknown, latencyMs: number): void {
  if (!isDev) return;

  const latency = formatLatency(latencyMs);

  if (method === "tools/call" && result) {
    const resultStr = typeof result === "string" ? result : JSON.stringify(result);
    console.log(
      `${chalk.gray(`[${timestamp()}]`)} ${chalk.green("←")} ${truncate(resultStr)} ${chalk.gray(`(${latency})`)}`
    );
  } else {
    console.log(`${chalk.gray(`[${timestamp()}]`)} ${chalk.green("✓")} ${method} ${chalk.gray(`(${latency})`)}`);
  }
}

function logError(method: string, error: unknown, latencyMs: number): void {
  const latency = formatLatency(latencyMs);

  let errorMsg: string;
  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (typeof error === "object" && error !== null) {
    const rpcError = error as { message?: string; code?: number };
    errorMsg = rpcError.message || `Error ${rpcError.code || "unknown"}`;
  } else {
    errorMsg = String(error);
  }

  console.log(
    `${chalk.gray(`[${timestamp()}]`)} ${chalk.red("✖")} ${method} ${chalk.red(truncate(errorMsg))} ${chalk.gray(`(${latency})`)}`
  );
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new McpServer({
  name: "ai-pr-reviewer",
  version: "1.0.0",
});

// Register PR Review tool
server.registerTool(
  "review_pr",
  {
    title: "PR Code Review",
    description: "Performs a comprehensive code review on Pull Request changes across multiple files",
    inputSchema: {
      changes: z
        .array(
          z.object({
            file_path: z.string().describe("Path to file"),
            content: z.string().describe("File content to review"),
            language: z.string().optional().describe("Programming language (e.g., typescript, javascript)"),
          })
        )
        .describe("Array of file changes to review"),
    },
    outputSchema: {
      summary: z.string(),
      risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENT_ONLY"]),
      confidence_score: z.number(),
      review_comments: z.array(
        z.object({
          file_path: z.string(),
          line_number: z.number(),
          severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]),
          category: z.enum([
            "CODE_QUALITY",
            "SECURITY",
            "PERFORMANCE",
            "DESIGN",
            "TESTING",
            "DEVOPS",
          ]),
          comment: z.string(),
          suggestion: z.string(),
          example_fix: z.string().optional(),
        })
      ),
      suggested_improvements: z.array(z.string()),
      approval_comment: z.string().optional(),
      change_request_comment: z.string().optional(),
    },
  },
  async ({ changes }) => {
    const output = await reviewPRAsync(changes);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register single file review tool
server.registerTool(
  "review_file",
  {
    title: "Single File Review",
    description: "Reviews a single file for code quality, security, and best practices",
    inputSchema: {
      file_path: z.string().describe("Path to file"),
      content: z.string().describe("File content to review"),
      language: z.string().optional().describe("Programming language (e.g., typescript, javascript)"),
    },
    outputSchema: {
      summary: z.string(),
      risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENT_ONLY"]),
      confidence_score: z.number(),
      review_comments: z.array(
        z.object({
          file_path: z.string(),
          line_number: z.number(),
          severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]),
          category: z.enum([
            "CODE_QUALITY",
            "SECURITY",
            "PERFORMANCE",
            "DESIGN",
            "TESTING",
            "DEVOPS",
          ]),
          comment: z.string(),
          suggestion: z.string(),
          example_fix: z.string().optional(),
        })
      ),
      suggested_improvements: z.array(z.string()),
      approval_comment: z.string().optional(),
      change_request_comment: z.string().optional(),
    },
  },
  async ({ file_path, content, language }) => {
    const output = await reviewSingleFile(file_path, content, language);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register tool to list available reviewers
server.registerTool(
  "list_reviewers",
  {
    title: "List Available Reviewers",
    description: "Lists all available code reviewers",
    inputSchema: {},
    outputSchema: {
      reviewers: z.array(z.string()),
    },
  },
  async () => {
    const reviewers = getAvailableReviewers();
    const output = { reviewers };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register tool to check GitHub configuration
server.registerTool(
  "is_github_configured",
  {
    title: "Check GitHub Configuration",
    description: "Checks if GitHub is properly configured with a token",
    inputSchema: {},
    outputSchema: {
      configured: z.boolean(),
    },
  },
  async () => {
    const configured = isGitHubConfigured();
    const output = { configured };
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register tool to fetch pull requests from GitHub
server.registerTool(
  "fetch_pull_requests",
  {
    title: "Fetch Pull Requests",
    description: "Fetches pull requests from a GitHub repository",
    inputSchema: {
      owner: z.string().optional().describe("Repository owner (uses GITHUB_OWNER env var if not provided)"),
      repo: z.string().optional().describe("Repository name (uses GITHUB_REPO env var if not provided)"),
      state: z.enum(["open", "closed", "all"]).optional().default("open").describe("PR state filter"),
      limit: z.number().optional().default(10).describe("Maximum number of PRs to fetch"),
    },
    outputSchema: z.array(
      z.object({
        number: z.number(),
        title: z.string(),
        body: z.string().nullable(),
        html_url: z.string(),
        user: z.object({ login: z.string() }),
        created_at: z.string(),
        updated_at: z.string(),
      })
    ),
  },
  async ({ owner, repo, state, limit }) => {
    const output = await fetchPullRequests(owner, repo, state, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register tool to review a GitHub PR
server.registerTool(
  "review_github_pr",
  {
    title: "Review GitHub Pull Request",
    description: "Fetches and reviews a specific GitHub pull request",
    inputSchema: {
      pull_number: z.number().describe("Pull request number"),
      owner: z.string().optional().describe("Repository owner (uses GITHUB_OWNER env var if not provided)"),
      repo: z.string().optional().describe("Repository name (uses GITHUB_REPO env var if not provided)"),
      post_comment: z.boolean().optional().default(false).describe("Whether to post review as GitHub comment"),
    },
    outputSchema: {
      summary: z.string(),
      risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENT_ONLY"]),
      confidence_score: z.number(),
      review_comments: z.array(
        z.object({
          file_path: z.string(),
          line_number: z.number(),
          severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]),
          category: z.enum([
            "CODE_QUALITY",
            "SECURITY",
            "PERFORMANCE",
            "DESIGN",
            "TESTING",
            "DEVOPS",
          ]),
          comment: z.string(),
          suggestion: z.string(),
          example_fix: z.string().optional(),
        })
      ),
      suggested_improvements: z.array(z.string()),
      approval_comment: z.string().optional(),
      change_request_comment: z.string().optional(),
      pr_number: z.number(),
    },
  },
  async ({ pull_number, owner, repo, post_comment }) => {
    const output = await reviewGitHubPR(pull_number, owner, repo, post_comment);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register tool to review multiple GitHub PRs
server.registerTool(
  "review_multiple_prs",
  {
    title: "Review Multiple GitHub Pull Requests",
    description: "Batch reviews multiple GitHub pull requests",
    inputSchema: {
      pull_numbers: z.array(z.number()).describe("Array of PR numbers to review"),
      owner: z.string().optional().describe("Repository owner (uses GITHUB_OWNER env var if not provided)"),
      repo: z.string().optional().describe("Repository name (uses GITHUB_REPO env var if not provided)"),
      post_comments: z.boolean().optional().default(false).describe("Whether to post reviews as GitHub comments"),
    },
    outputSchema: z.array(
      z.object({
        summary: z.string(),
        risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
        decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENT_ONLY"]),
        confidence_score: z.number(),
        review_comments: z.array(
          z.object({
            file_path: z.string(),
            line_number: z.number(),
            severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]),
            category: z.enum([
              "CODE_QUALITY",
              "SECURITY",
              "PERFORMANCE",
              "DESIGN",
              "TESTING",
              "DEVOPS",
            ]),
            comment: z.string(),
            suggestion: z.string(),
            example_fix: z.string().optional(),
          })
        ),
        suggested_improvements: z.array(z.string()),
        approval_comment: z.string().optional(),
        change_request_comment: z.string().optional(),
        pr_number: z.number(),
      })
    ),
  },
  async ({ pull_numbers, owner, repo, post_comments }) => {
    const output = await reviewMultiplePRs(pull_numbers, owner, repo, post_comments);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// ============================================================================
// Express App Setup
// ============================================================================

const app = express();
app.use(express.json());

// Health check endpoint (required for Cloud Run)
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "healthy" });
});

// MCP endpoint with dev logging
app.post("/mcp", async (req: Request, res: Response) => {
  const startTime = Date.now();
  const body = req.body;

  const method = body?.method || "unknown";
  const params = body?.params;

  if (method === "tools/call") {
    const toolName = params?.name || "unknown";
    const toolArgs = params?.arguments;
    logRequest(`tools/call ${chalk.bold(toolName)}`, toolArgs);
  } else if (method !== "notifications/initialized") {
    logRequest(method, params);
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  let responseBody = "";
  const originalWrite = res.write.bind(res) as typeof res.write;
  const originalEnd = res.end.bind(res) as typeof res.end;

  res.write = function (chunk: unknown, encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void), callback?: (error: Error | null | undefined) => void) {
    if (chunk) {
      responseBody += typeof chunk === "string" ? chunk : Buffer.from(chunk as ArrayBuffer).toString();
    }
    return originalWrite(chunk as string, encodingOrCallback as BufferEncoding, callback);
  };

  res.end = function (chunk?: unknown, encodingOrCallback?: BufferEncoding | (() => void), callback?: () => void) {
    if (chunk) {
      responseBody += typeof chunk === "string" ? chunk : Buffer.from(chunk as ArrayBuffer).toString();
    }

    if (method !== "notifications/initialized") {
      const latency = Date.now() - startTime;

      try {
        const rpcResponse = JSON.parse(responseBody) as { result?: unknown; error?: unknown };

        if (rpcResponse?.error) {
          logError(method, rpcResponse.error, latency);
        } else if (method === "tools/call") {
          const content = (rpcResponse?.result as { content?: Array<{ text?: string }> })?.content;
          const resultText = content?.[0]?.text;
          logResponse(method, resultText, latency);
        } else {
          logResponse(method, null, latency);
        }
      } catch {
        logResponse(method, null, latency);
      }
    }

    return originalEnd(chunk as string, encodingOrCallback as BufferEncoding, callback);
  };

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// JSON error handler (Express defaults to HTML errors)
app.use((_err: unknown, _req: Request, res: Response, _next: Function) => {
  res.status(500).json({ error: "Internal server error" });
});

// ============================================================================
// Start Server
// ============================================================================

const port = parseInt(process.env.PORT || "8080");
const httpServer = app.listen(port, () => {
  console.log();
  console.log(chalk.bold("MCP Server running on"), chalk.cyan(`http://localhost:${port}`));
  console.log(`  ${chalk.gray("Health:")} http://localhost:${port}/health`);
  console.log(`  ${chalk.gray("MCP:")}    http://localhost:${port}/mcp`);
  console.log();
  console.log(chalk.green("AI PR Reviewer MCP Server"));
  console.log(`  ${chalk.gray("Available tools:")}`);
  console.log(`    - review_pr: Review multiple files`);
  console.log(`    - review_file: Review a single file`);
  console.log(`    - list_reviewers: List available reviewers`);
  console.log(`    - is_github_configured: Check GitHub configuration`);
  console.log(`    - fetch_pull_requests: Fetch PRs from GitHub`);
  console.log(`    - review_github_pr: Review a GitHub PR`);
  console.log(`    - review_multiple_prs: Batch review GitHub PRs`);

  if (isDev) {
    console.log();
    console.log(chalk.gray("─".repeat(50)));
    console.log();
  }
});

// Graceful shutdown for Cloud Run (SIGTERM before kill)
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  httpServer.close(() => {
    process.exit(0);
  });
});