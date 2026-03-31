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

// Middleware to extract mcpize custom headers and set as environment variables
app.use((req: Request, res, next) => {
  // Try multiple header name formats (HTTP headers are case-insensitive)
  const githubToken = (req.headers['x-github-token'] as string) ||
    (req.headers['github-token'] as string) ||
    (req.headers['github_token'] as string) ||
    (req.headers['GITHUB_TOKEN'] as string);

  const githubOwner = (req.headers['x-github-owner'] as string) ||
    (req.headers['github-owner'] as string) ||
    (req.headers['github_owner'] as string) ||
    (req.headers['GITHUB_OWNER'] as string);

  const githubRepo = (req.headers['x-github-repo'] as string) ||
    (req.headers['github-repo'] as string) ||
    (req.headers['github_repo'] as string) ||
    (req.headers['GITHUB_REPO'] as string);

  if (githubToken) process.env.GITHUB_TOKEN = githubToken;
  if (githubOwner) process.env.GITHUB_OWNER = githubOwner;
  if (githubRepo) process.env.GITHUB_REPO = githubRepo;

  logger.debug('Headers received', {
    hasToken: !!githubToken,
    hasOwner: !!githubOwner,
    hasRepo: !!githubRepo
  });

  next();
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "healthy", service: "ai-pr-reviewer" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || "8080");
app.listen(port, () => {
  logger.info(`MCP Server active on port ${port}`);
});

process.on("SIGTERM", () => {
  logger.info("Terminating service...");
  process.exit(0);
});