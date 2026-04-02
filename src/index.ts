import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { z } from "zod";
import {
  reviewPR,
  reviewSingleFile,
  getAvailableReviewers,
  fetchPullRequests,
  reviewGitHubPR,
  reviewMultiplePRs,
  reviewRepository,
  isGitHubConfigured
} from "./tools.js";
import { logger } from "./utils/logger.js";

/**
 * AI PR Reviewer - MCP Server
 * Professional grade code review automation for GitHub and local workflows.
 */

const server = new McpServer({
  name: "ai-pr-reviewer",
  version: "1.1.0",
});

const ReviewCommentSchema = z.object({
  file_path: z.string(),
  line_number: z.number(),
  severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]),
  category: z.enum(["CODE_QUALITY", "SECURITY", "PERFORMANCE", "DESIGN", "TESTING", "DEVOPS"]),
  comment: z.string(),
  suggestion: z.string(),
  example_fix: z.string().optional(),
});

const ReviewResultSchema = z.object({
  summary: z.string(),
  risk_level: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENT_ONLY"]),
  confidence_score: z.number(),
  review_comments: z.array(ReviewCommentSchema),
  suggested_improvements: z.array(z.string()),
  approval_comment: z.string().optional(),
  change_request_comment: z.string().optional(),
});

// Register PR Review tool
server.registerTool(
  "review_pr",
  {
    description: "Performs a technical code review on an array of file changes",
    inputSchema: {
      changes: z.array(
        z.object({
          file_path: z.string().describe("Path to file"),
          content: z.string().describe("File content to review"),
          language: z.string().optional().describe("Programming language"),
        })
      ),
    },
  },
  async ({ changes }) => {
    logger.info("Tool call: review_pr", { fileCount: changes.length });
    const output = await reviewPR(changes);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Register Tool: Full Repository Review
server.registerTool(
  "review_repository",
  {
    description: "Analyzes an entire GitHub repository for technical debt and security risks",
    inputSchema: {
      owner: z.string().optional().describe("GitHub owner"),
      repo: z.string().optional().describe("GitHub repository name"),
      branch: z.string().optional().describe("Target branch (defaults to main/master)"),
      max_files: z.number().optional().default(50).describe("Maximum files to analyze in one pass"),
    },
  },
  async ({ owner, repo, branch, max_files }) => {
    logger.info("Tool call: review_repository", { owner, repo, branch });
    const output = await reviewRepository(owner, repo, branch, max_files);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

server.registerTool(
  "review_file",
  {
    description: "Reviews a single file for quality and security compliance",
    inputSchema: {
      file_path: z.string(),
      content: z.string(),
      language: z.string().optional(),
    },
  },
  async ({ file_path, content, language }) => {
    logger.info("Tool call: review_file", { file_path });
    const output = await reviewSingleFile(file_path, content, language);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

server.registerTool(
  "fetch_pull_requests",
  {
    description: "Lists pull requests from a GitHub repository for selection",
    inputSchema: {
      owner: z.string().optional(),
      repo: z.string().optional(),
      state: z.enum(["open", "closed", "all"]).optional().default("open"),
      limit: z.number().optional().default(10),
    },
  },
  async ({ owner, repo, state, limit }) => {
    logger.info("Tool call: fetch_pull_requests", { owner, repo, state });
    const output = await fetchPullRequests(owner, repo, state, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

server.registerTool(
  "review_github_pr",
  {
    description: "Automated analysis of a GitHub pull request with optional inline commenting",
    inputSchema: {
      pull_number: z.number(),
      owner: z.string().optional(),
      repo: z.string().optional(),
      post_comment: z.boolean().optional().default(false),
    },
  },
  async ({ pull_number, owner, repo, post_comment }) => {
    logger.info("Tool call: review_github_pr", { pull_number, owner, repo, post_comment });
    const output = await reviewGitHubPR(pull_number, owner, repo, post_comment);
    return {
      content: [{ type: "text", text: JSON.stringify(output) }],
    };
  }
);

// Express App Setup for HTTP Transport (MCP over Webhook/HTTP)
const app = express();
app.use(express.json());

// Request ID generator for tracing
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Configuration validation on startup
function validateConfig() {
  const required = ["GITHUB_TOKEN"];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `For mcpize deployment: Configure these in server settings.\n` +
      `For local development: Set them in .env file.`
    );
  }

  const token = process.env.GITHUB_TOKEN!;
  if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
    logger.warn("GITHUB_TOKEN format appears invalid (should start with ghp_ or github_pat_)");
  }
}

// Validate configuration on startup
try {
  validateConfig();
  logger.info("Configuration validated successfully");
} catch (error) {
  logger.error("Configuration validation failed", error);
  process.exit(1);
}

app.get("/health", async (_req: Request, res: Response) => {
  try {
    const health = {
      status: "healthy",
      service: "ai-pr-reviewer",
      version: "1.1.0",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        github: process.env.GITHUB_TOKEN ? "configured" : "not_configured"
      }
    };
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get("/ping", async (_req: Request, res: Response) => {
  try {
    const health = {
      status: "healthy",
      service: "ai-pr-reviewer",
      version: "1.1.0"
    };
    res.status(200).json(health);
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.post("/mcp", async (req: Request, res: Response) => {
  const requestId = generateRequestId();
  const startTime = Date.now();
  let transport: StreamableHTTPServerTransport | null = null;

  logger.info(`[${requestId}] MCP Request`, {
    method: req.body?.method,
    id: req.body?.id,
    timestamp: new Date().toISOString()
  });

  try {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      if (transport) transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] MCP Response`, {
      status: res.statusCode,
      duration: `${duration}ms`
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] MCP Error`, {
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`
    });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error instanceof Error ? error.message : String(error)
        },
        id: req.body?.id || null
      });
    }

    if (transport) transport.close();
  }
});

const port = parseInt(process.env.PORT || "8080");
let isShuttingDown = false;

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown`);

  // Give time for in-flight requests to complete (max 10 seconds)
  await new Promise(resolve => setTimeout(resolve, 10000));

  logger.info("Graceful shutdown complete");
  process.exit(0);
}

// Graceful shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
const serverInstance = app.listen(port, () => {
  logger.info(`MCP Server active on port ${port}`);
  logger.info(`Health endpoints available at /health and /ping`);
  logger.info(`MCP endpoint available at /mcp`);
});

// Handle server errors
serverInstance.on("error", (error: any) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${port} is already in use`);
    process.exit(1);
  } else {
    logger.error("Server error", error);
    process.exit(1);
  }
});
