/**
 * MCP Tool Functions
 * Pure business logic for PR Review functionality
 */

import { PRReviewerService } from "./services/pr-reviewer.service.js";
import { TypeScriptReviewer } from "./services/reviewers/typescript.reviewer.js";
import { ReviewerRegistry } from "./services/reviewers/registry.js";
import { GitHubService } from "./services/github.service.js";
import { ReviewContext, ReviewResult, FileChange, RiskLevel, Decision } from "./models/review.models.js";

// Initialize reviewers
const registry = ReviewerRegistry.getInstance();
registry.register(new TypeScriptReviewer());

let githubService: GitHubService | null = null;

/**
 * Get GitHub service instance
 */
function getGitHubService(): GitHubService {
  if (!githubService) {
    try {
      githubService = new GitHubService();
    } catch (error) {
      throw new Error("GitHub service not configured. Please set GITHUB_TOKEN environment variable.");
    }
  }
  return githubService;
}

/**
 * Initialize the PR Reviewer service
 */
function getReviewerService(): PRReviewerService {
  return new PRReviewerService();
}

/**
 * Perform a comprehensive PR review on the provided code changes
 *
 * @param changes - Array of file changes to review
 * @returns Detailed review result with comments and decision
 */
export function reviewPR(changes: Array<{
  file_path: string;
  content: string;
  language?: string;
}>): ReviewResult {
  const context: ReviewContext = {
    changes: changes.map((change) => ({
      file_path: change.file_path,
      content: change.content,
      language: change.language,
    })),
  };

  // Use the service to perform the review
  // Note: Since this is a synchronous export, we'll need to handle async in the MCP layer
  // For now, return a placeholder that will be properly handled in the async context
  return {
    summary: "Review initiated",
    risk_level: RiskLevel.LOW,
    decision: Decision.COMMENT_ONLY,
    confidence_score: 0,
    review_comments: [],
    suggested_improvements: [],
  };
}

/**
 * Perform async PR review
 */
export async function reviewPRAsync(changes: Array<{
  file_path: string;
  content: string;
  language?: string;
}>): Promise<ReviewResult> {
  const context: ReviewContext = {
    changes: changes.map((change) => ({
      file_path: change.file_path,
      content: change.content,
      language: change.language,
    })),
  };

  const service = getReviewerService();
  return await service.review(context);
}

/**
 * Review a single file
 */
export async function reviewSingleFile(
  filePath: string,
  content: string,
  language?: string
): Promise<ReviewResult> {
  return reviewPRAsync([{ file_path: filePath, content, language }]);
}

/**
 * Get available reviewers
 */
export function getAvailableReviewers(): string[] {
  return ReviewerRegistry.getInstance().getAll().map((r) => r.getName());
}

/**
 * Fetch pull requests from GitHub
 * @param owner - Repository owner (optional, uses GITHUB_OWNER env var)
 * @param repo - Repository name (optional, uses GITHUB_REPO env var)
 * @param state - PR state (open, closed, all)
 * @param limit - Maximum number of PRs to fetch
 */
export async function fetchPullRequests(
  owner?: string,
  repo?: string,
  state: "open" | "closed" | "all" = "open",
  limit = 10
): Promise<Array<{
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
}>> {
  const service = getGitHubService();
  const prs = await service.getPullRequests(owner, repo, state, limit);

  return prs.map(pr => ({
    number: pr.number,
    title: pr.title,
    body: pr.body,
    html_url: pr.html_url,
    user: pr.user,
    created_at: pr.created_at,
    updated_at: pr.updated_at,
  }));
}

/**
 * Review a GitHub pull request
 * @param pullNumber - PR number
 * @param owner - Repository owner (optional, uses GITHUB_OWNER env var)
 * @param repo - Repository name (optional, uses GITHUB_REPO env var)
 * @param postComment - Whether to post review as GitHub comment (default: false)
 */
export async function reviewGitHubPR(
  pullNumber: number,
  owner?: string,
  repo?: string,
  postComment = false
): Promise<ReviewResult & { pr_number: number }> {
  const github = getGitHubService();

  // Fetch PR files
  const files = await github.getPullRequestFiles(pullNumber, owner, repo);

  // Fetch content for each modified file
  const changes: Array<{ file_path: string; content: string; language?: string }> = [];

  for (const file of files) {
    // Skip deleted files
    if (file.status === "deleted") continue;

    try {
      const content = await github.getFileContent(file.filename, owner, repo);
      changes.push({
        file_path: file.filename,
        content,
        language: getLanguageFromFilename(file.filename),
      });
    } catch (error) {
      console.error(`Failed to fetch content for ${file.filename}:`, error);
    }
  }

  // Perform review
  const result = await reviewPRAsync(changes);

  // Post comment if requested
  if (postComment) {
    await postReviewComment(pullNumber, result, owner, repo);
  }

  return { ...result, pr_number: pullNumber };
}

/**
 * Batch review multiple GitHub pull requests
 * @param pullNumbers - Array of PR numbers to review
 * @param owner - Repository owner (optional, uses GITHUB_OWNER env var)
 * @param repo - Repository name (optional, uses GITHUB_REPO env var)
 * @param postComments - Whether to post reviews as GitHub comments (default: false)
 */
export async function reviewMultiplePRs(
  pullNumbers: number[],
  owner?: string,
  repo?: string,
  postComments = false
): Promise<Array<ReviewResult & { pr_number: number }>> {
  const results: Array<ReviewResult & { pr_number: number }> = [];

  for (const pullNumber of pullNumbers) {
    try {
      const result = await reviewGitHubPR(pullNumber, owner, repo, postComments);
      results.push(result);
    } catch (error) {
      console.error(`Failed to review PR #${pullNumber}:`, error);
      results.push({
        summary: `Failed to review PR #${pullNumber}`,
        risk_level: RiskLevel.LOW,
        decision: Decision.COMMENT_ONLY,
        confidence_score: 0,
        review_comments: [],
        suggested_improvements: [],
        pr_number: pullNumber,
      });
    }
  }

  return results;
}

/**
 * Post review comment to GitHub PR
 */
async function postReviewComment(
  pullNumber: number,
  result: ReviewResult,
  owner?: string,
  repo?: string
): Promise<void> {
  const github = getGitHubService();

  // Format review comment
  let comment = `## 🤖 AI Code Review\n\n`;
  comment += `**Risk Level:** ${result.risk_level}\n`;
  comment += `**Decision:** ${result.decision}\n`;
  comment += `**Confidence Score:** ${result.confidence_score}/100\n\n`;
  comment += `### Summary\n${result.summary}\n\n`;

  if (result.review_comments.length > 0) {
    comment += `### Review Comments\n\n`;
    result.review_comments.forEach((c, i) => {
      comment += `#### ${i + 1}. ${c.category} - ${c.severity}\n`;
      comment += `**File:** ${c.file_path}:${c.line_number}\n`;
      comment += `${c.comment}\n`;
      if (c.suggestion) {
        comment += `**Suggestion:** ${c.suggestion}\n`;
      }
      comment += `\n`;
    });
  }

  if (result.suggested_improvements.length > 0) {
    comment += `### Suggested Improvements\n\n`;
    result.suggested_improvements.forEach((improvement, i) => {
      comment += `${i + 1}. ${improvement}\n`;
    });
  }

  if (result.decision === Decision.APPROVED && result.approval_comment) {
    comment += `\n✅ ${result.approval_comment}`;
  } else if (result.decision === Decision.CHANGES_REQUESTED && result.change_request_comment) {
    comment += `\n❌ ${result.change_request_comment}`;
  }

  // Determine review event
  let event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT";
  if (result.decision === Decision.APPROVED) {
    event = "APPROVE";
  } else if (result.decision === Decision.CHANGES_REQUESTED) {
    event = "REQUEST_CHANGES";
  }

  // Post review
  await github.createReview(pullNumber, comment, event, owner, repo);
}

/**
 * Detect programming language from filename
 */
function getLanguageFromFilename(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'py': 'python',
    'java': 'java',
    'go': 'go',
    'rb': 'ruby',
    'php': 'php',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'rs': 'rust',
  };

  return languageMap[ext || ''];
}

/**
 * Check if GitHub is configured
 */
export function isGitHubConfigured(): boolean {
  try {
    const service = new GitHubService();
    return service.isConfigured();
  } catch {
    return false;
  }
}