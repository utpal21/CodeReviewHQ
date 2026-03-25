/**
 * MCP Server with Stdio Transport for Command-Based Usage
 * This version is designed for use with Antigravity's command-based MCP configuration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import chalk from "chalk";
import {
    reviewPRAsync,
    reviewSingleFile,
    getAvailableReviewers,
    fetchPullRequests,
    reviewGitHubPR,
    reviewMultiplePRs,
    isGitHubConfigured,
} from "./tools.js";
import { z } from "zod";

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
// Start Server with Stdio Transport
// ============================================================================

async function main() {
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev) {
        console.error(chalk.bold("🚀 AI PR Reviewer MCP Server (Stdio)"));
        console.error(chalk.gray("─".repeat(50)));
        console.error();
        console.error(chalk.green("Available tools:"));
        console.error(chalk.gray("  • review_pr: Review multiple files"));
        console.error(chalk.gray("  • review_file: Review a single file"));
        console.error(chalk.gray("  • list_reviewers: List available reviewers"));
        console.error(chalk.gray("  • is_github_configured: Check GitHub configuration"));
        console.error(chalk.gray("  • fetch_pull_requests: Fetch PRs from GitHub"));
        console.error(chalk.gray("  • review_github_pr: Review a GitHub PR"));
        console.error(chalk.gray("  • review_multiple_prs: Batch review GitHub PRs"));
        console.error();
        console.error(chalk.cyan("Press Ctrl+C to stop"));
        console.error(chalk.gray("─".repeat(50)));
        console.error();
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
}

// Graceful shutdown
process.on("SIGINT", () => {
    console.error("\nReceived SIGINT, shutting down...");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.error("Received SIGTERM, shutting down...");
    process.exit(0);
});

main().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});