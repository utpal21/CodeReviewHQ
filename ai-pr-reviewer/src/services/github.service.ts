/**
 * GitHub Integration Service
 * Handles fetching PRs, file changes, and posting reviews to GitHub
 * Uses GitHub's REST API via Octokit
 */

import { Octokit } from "octokit";

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
    position?: number;
}

export class GitHubService {
    private octokit: Octokit;
    private defaultOwner: string;
    private defaultRepo: string;

    constructor() {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error("GITHUB_TOKEN environment variable is required");
        }

        this.octokit = new Octokit({
            auth: token,
        });

        this.defaultOwner = process.env.GITHUB_OWNER || "";
        this.defaultRepo = process.env.GITHUB_REPO || "";
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
            throw new Error("Repository owner and name are required (set GITHUB_OWNER and GITHUB_REPO env vars)");
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

        const response = await this.octokit.rest.repos.getContent({
            owner: repoOwner,
            repo: repoName,
            path,
            ref,
        });

        // Decode base64 content
        if ("content" in response.data && typeof response.data.content === "string") {
            return Buffer.from(response.data.content, "base64").toString("utf-8");
        }

        throw new Error("Unable to retrieve file content");
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
        repo?: string
    ): Promise<void> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        // Create comments for each file
        for (const comment of comments) {
            try {
                await this.octokit.rest.pulls.createReviewComment({
                    owner: repoOwner,
                    repo: repoName,
                    pull_number: pullNumber,
                    body: comment.body,
                    commit_id: "", // Required but can be empty
                    path: comment.path,
                    position: comment.position,
                });
            } catch (error) {
                console.error(`Failed to post comment for ${comment.path}:${comment.line}:`, error);
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
        owner?: string,
        repo?: string
    ): Promise<void> {
        const repoOwner = owner || this.defaultOwner;
        const repoName = repo || this.defaultRepo;

        await this.octokit.rest.pulls.createReview({
            owner: repoOwner,
            repo: repoName,
            pull_number: pullNumber,
            body,
            event,
            comments: [],
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