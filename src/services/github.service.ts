import { Octokit } from "octokit";
import { logger } from "../utils/logger.js";

export interface GitHubPR {
    number: number;
    title: string;
    body: string | null;
    head: {
        ref: string;
        sha: string;
        repo: {
            name: string;
            owner: {
                login: string;
            };
        };
    };
    base: {
        ref: string;
        sha: string;
        repo: {
            name: string;
            owner: {
                login: string;
            };
        };
    };
    html_url: string;
    user: {
        login: string;
    };
    created_at: string;
    updated_at: string;
}

export interface GitHubFileChange {
    filename: string;
    status: "added" | "modified" | "deleted" | "renamed";
    additions: number;
    deletions: number;
    changes: number;
    patch?: string;
    blob_url: string;
}

export interface GitHubReviewComment {
    path: string;
    line: number;
    body: string;
    side?: "LEFT" | "RIGHT";
}

export interface GitHubRepository {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
    default_branch: string;
    html_url: string;
    description: string | null;
}

export interface GitHubTreeItem {
    path: string;
    mode: string;
    type: string;
    sha: string;
    size?: number;
    url?: string;
}

export class GitHubService {
    private octokit: Octokit;
    private defaultOwner: string;
    private defaultRepo: string;

    constructor(token?: string) {
        // Use provided token or fall back to environment variable
        const githubToken = token || process.env.GITHUB_TOKEN;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;

        logger.info("GitHubService initialized", {
            hasToken: !!githubToken,
            hasOwner: !!owner,
            hasRepo: !!repo,
            owner: owner,
            repo: repo,
            tokenPrefix: githubToken ? `${githubToken.substring(0, 7)}...` : "none",
            tokenSource: token ? "parameter" : process.env.GITHUB_TOKEN ? "environment" : "none",
        });

        if (!githubToken) {
            throw new Error(
                "GITHUB_TOKEN is required. Please provide one of:\n" +
                    "1. github_token parameter in tool arguments\n" +
                    "2. Authorization header (Bearer token)\n" +
                    "3. X-GitHub-Token header\n" +
                    "4. GITHUB_TOKEN environment variable (server configuration)"
            );
        }

        this.octokit = new Octokit({
            auth: githubToken,
        });

        this.defaultOwner = owner || "";
        this.defaultRepo = repo || "";
    }

    /**
     * Get list of pull requests
     * @param owner - Repository owner (optional, uses default if not provided)
     * @param repo - Repository name (optional, uses default if not provided)
     * @param state - PR state (open, closed, all)
     * @param limit - Maximum number of PRs to fetch
     */
    async getPullRequests(
        owner?: string,
        repo?: string,
        state: "open" | "closed" | "all" = "open",
        limit = 10
    ): Promise<GitHubPR[]> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        if (!repoOwner || !repoName) {
            throw new Error(
                "Repository owner and name are required (set GITHUB_OWNER and GITHUB_REPO env vars)"
            );
        }

        const response = await this.octokit.rest.pulls.list({
            owner: repoOwner,
            repo: repoName,
            state,
            per_page: limit,
            sort: "updated",
            direction: "desc",
        });

        return response.data as unknown as GitHubPR[];
    }

    /**
     * Get repository details (including default branch)
     */
    async getRepository(owner?: string, repo?: string): Promise<GitHubRepository> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        logger.debug(`Fetching repository details for ${repoOwner}/${repoName}`);
        try {
            const response = await this.octokit.rest.repos.get({
                owner: repoOwner,
                repo: repoName,
            });

            return response.data as unknown as GitHubRepository;
        } catch (error) {
            logger.error(`Failed to fetch repository details: ${repoOwner}/${repoName}`, error);
            throw error;
        }
    }

    /**
     * Get a specific pull request
     */
    async getPullRequest(pullNumber: number, owner?: string, repo?: string): Promise<GitHubPR> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        logger.debug(`Fetching PR #${pullNumber} from ${repoOwner}/${repoName}`);
        try {
            const response = await this.octokit.rest.pulls.get({
                owner: repoOwner,
                repo: repoName,
                pull_number: pullNumber,
            });

            return response.data as unknown as GitHubPR;
        } catch (error) {
            logger.error(`Failed to fetch PR #${pullNumber}`, error);
            throw error;
        }
    }

    /**
     * Get all files in a repository recursively
     */
    async getRepositoryTree(owner?: string, repo?: string, ref = "main"): Promise<string[]> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        try {
            const response = await this.octokit.rest.git.getTree({
                owner: repoOwner,
                repo: repoName,
                tree_sha: ref,
                recursive: "true",
            });

            return response.data.tree
                .filter((item: GitHubTreeItem) => item.type === "blob")
                .map((item: GitHubTreeItem) => item.path || "");
        } catch (error) {
            console.error("Failed to fetch repository tree:", error);
            return [];
        }
    }

    /**
     * Get file changes for a specific PR
     * @param pullNumber - PR number
     * @param owner - Repository owner
     * @param repo - Repository name
     */
    async getPullRequestFiles(
        pullNumber: number,
        owner?: string,
        repo?: string
    ): Promise<GitHubFileChange[]> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        const response = await this.octokit.rest.pulls.listFiles({
            owner: repoOwner,
            repo: repoName,
            pull_number: pullNumber,
        });

        return response.data as unknown as GitHubFileChange[];
    }

    /**
     * Get PR diff as string
     */
    async getPullRequestDiff(pullNumber: number, owner?: string, repo?: string): Promise<string> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        const response = await this.octokit.rest.pulls.get({
            owner: repoOwner,
            repo: repoName,
            pull_number: pullNumber,
            headers: {
                accept: "application/vnd.github.v3.diff",
            },
        });

        return response.data as unknown as string;
    }

    /**
     * Get raw file content
     * @param path - File path
     * @param owner - Repository owner
     * @param repo - Repository name
     * @param ref - Git reference (branch, tag, or SHA)
     */
    async getFileContent(
        path: string,
        owner?: string,
        repo?: string,
        ref?: string
    ): Promise<string> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        logger.debug(`Fetching file content: ${path}`, { owner: repoOwner, repo: repoName, ref });
        try {
            const response = await this.octokit.rest.repos.getContent({
                owner: repoOwner,
                repo: repoName,
                path,
                ref,
            });

            if (Array.isArray(response.data)) {
                throw new Error(`Path ${path} is a directory, not a file`);
            }

            if ("content" in response.data && typeof response.data.content === "string") {
                return Buffer.from(response.data.content, "base64").toString("utf-8");
            }

            throw new Error(`Unable to retrieve file content for ${path}`);
        } catch (error) {
            logger.error(`Error retrieving file content: ${path}`, error);
            throw error;
        }
    }

    /**
     * Post a review comment to a PR
     * @param pullNumber - PR number
     * @param comments - Array of review comments
     * @param owner - Repository owner
     * @param repo - Repository name
     */
    async createReviewComment(
        pullNumber: number,
        comments: GitHubReviewComment[],
        owner?: string,
        repo?: string,
        commitId?: string
    ): Promise<void> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        logger.info(`Posting ${comments.length} individual comments to PR #${pullNumber}`);
        for (const comment of comments) {
            try {
                await this.octokit.rest.pulls.createReviewComment({
                    owner: repoOwner,
                    repo: repoName,
                    pull_number: pullNumber,
                    body: comment.body,
                    commit_id: commitId || "",
                    path: comment.path,
                    line: comment.line,
                    side: comment.side || "RIGHT",
                });
            } catch (error) {
                logger.error(`Failed to post comment for ${comment.path}:${comment.line}`, error);
            }
        }
    }

    /**
     * Post a general review comment on a PR
     * @param pullNumber - PR number
     * @param body - Review body text
     * @param event - Review event (APPROVE, REQUEST_CHANGES, COMMENT)
     * @param owner - Repository owner
     * @param repo - Repository name
     */
    async createReview(
        pullNumber: number,
        body: string,
        event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT",
        comments: GitHubReviewComment[] = [],
        owner?: string,
        repo?: string,
        commitId?: string
    ): Promise<void> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        await this.octokit.rest.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: pullNumber,
            body,
            event,
            commit_id: commitId,
            comments: comments.map((c) => ({
                path: c.path,
                line: c.line,
                body: c.body,
                side: "RIGHT",
            })),
        });
    }

    /**
     * Post a general comment on a PR
     * @param pullNumber - PR number
     * @param body - Comment body text
     * @param owner - Repository owner
     * @param repo - Repository name
     */
    async createIssueComment(
        pullNumber: number,
        body: string,
        owner?: string,
        repo?: string
    ): Promise<void> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        await this.octokit.rest.issues.createComment({
            owner: repoOwner,
            repo: repoName,
            issue_number: pullNumber,
            body,
        });
    }

    /**
     * Check if GitHub token is configured
     */
    isConfigured(): boolean {
        return !!process.env.GITHUB_TOKEN;
    }
}
