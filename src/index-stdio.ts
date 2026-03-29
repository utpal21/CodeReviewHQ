import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  reviewPR,
  reviewSingleFile,
  getAvailableReviewers,
  fetchPullRequests,
  reviewGitHubPR,
  reviewMultiplePRs,
  reviewRepository,
  isGitHubConfigured,
} from "./tools.js";
import { logger } from "./utils/logger.js";

/**
 * AI PR Reviewer - MCP Server (Stdio)
 * Designed for local command-line integration and personal IDE assistants.
 */

const server = new McpServer({
  name: "ai-pr-reviewer",
  version: "1.1.0",
});

// Standardized Tool Registration logic
server.registerTool(
  "review_pr",
  {
    description: "Performs a technical code review on an array of file changes",
    inputSchema: {
      changes: z.array(
        z.object({
          file_path: z.string(),
          content: z.string(),
          language: z.string().optional(),
        })
      ),
    },
  },
  async ({ changes }) => {
    const output = await reviewPR(changes);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  }
);

server.registerTool(
  "review_repository",
  {
    description: "Analyzes an entire GitHub repository for technical debt and security risks",
    inputSchema: {
      owner: z.string().optional(),
      repo: z.string().optional(),
      branch: z.string().optional(),
      max_files: z.number().optional().default(50),
    },
  },
  async ({ owner, repo, branch, max_files }) => {
    const output = await reviewRepository(owner, repo, branch, max_files);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
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
    const output = await reviewSingleFile(file_path, content, language);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
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
    const output = await fetchPullRequests(owner, repo, state, limit);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
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
    const output = await reviewGitHubPR(pull_number, owner, repo, post_comment);
    return { content: [{ type: "text", text: JSON.stringify(output) }] };
  }
);

async function main() {
  logger.info("Starting AI PR Reviewer MCP Server (Stdio)");
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});