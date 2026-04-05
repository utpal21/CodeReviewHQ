import { PRReviewerService } from "./services/pr-reviewer.service.js";
import { TypeScriptReviewer } from "./services/reviewers/typescript.reviewer.js";
import { PythonReviewer } from "./services/reviewers/python.reviewer.js";
import { UniversalReviewer } from "./services/reviewers/universal.reviewer.js";
import { ReviewerRegistry } from "./services/reviewers/registry.js";
import { GitHubService } from "./services/github.service.js";
import { ReviewContext, ReviewResult, RiskLevel, Decision } from "./models/review.models.js";
import { logger } from "./utils/logger.js";

// Initialize reviewers
const registry = ReviewerRegistry.getInstance();
registry.register(new TypeScriptReviewer());
registry.register(new PythonReviewer());
registry.register(new UniversalReviewer());

let githubService: GitHubService | null = null;

/**
 * Validate GitHub configuration
 * Throws error if GITHUB_TOKEN is not configured
 */
export function validateGitHubConfig(): void {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error(
      "GITHUB_TOKEN not configured. " +
      "Please configure your GitHub Personal Access Token in server settings.\n\n" +
      "For mcpize deployment:\n" +
      "1. Go to your server settings in mcpize dashboard\n" +
      "2. Find 'GitHub Personal Access Token' field\n" +
      "3. Enter your token (starts with 'ghp_' or 'github_pat_')\n" +
      "4. Save and wait for redeployment\n\n" +
      "For local development:\n" +
      "Set GITHUB_TOKEN environment variable or add to .env file"
    );
  }
}

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
 * Perform a comprehensive review on the provided code changes.
 * 
 * @param changes - Array of file changes to review
 * @returns Detailed review result with comments and decision
 */
export async function reviewPR(changes: Array<{
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
 * Backward compatibility for reviewPRAsync
 */
export const reviewPRAsync = reviewPR;

/**
 * Review a single file
 */
export async function reviewSingleFile(
  filePath: string,
  content: string,
  language?: string
): Promise<ReviewResult> {
  return reviewPR([{ file_path: filePath, content, language }]);
}

/**
 * Get available reviewers
 */
export function getAvailableReviewers(): string[] {
  return ReviewerRegistry.getInstance().getAll().map((r) => r.getName());
}

/**
 * Fetch pull requests from GitHub
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
  // Validate GitHub configuration before making API calls
  validateGitHubConfig();

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
 */
export async function reviewGitHubPR(
  pullNumber: number,
  owner?: string,
  repo?: string,
  postComment = false
): Promise<ReviewResult & { pr_number: number }> {
  // Validate GitHub configuration before making API calls
  validateGitHubConfig();

  logger.info(`Starting review for PR #${pullNumber} in ${owner || 'default'}/${repo || 'default'}`);
  const github = getGitHubService();

  const pr = await github.getPullRequest(pullNumber, owner, repo);
  const headSha = pr.head.sha;

  const files = await github.getPullRequestFiles(pullNumber, owner, repo);
  const changes: Array<{ file_path: string; content: string; language?: string }> = [];

  for (const file of files) {
    if (file.status === "deleted") continue;

    try {
      const content = await github.getFileContent(file.filename, owner, repo, headSha);
      changes.push({
        file_path: file.filename,
        content,
        language: getLanguageFromFilename(file.filename),
      });
    } catch (error) {
      logger.error(`Failed to fetch content for ${file.filename}`, error);
    }
  }

  const result = await reviewPR(changes);

  if (postComment) {
    await postReviewComment(pullNumber, result, owner, repo, headSha);
  }

  return { ...result, pr_number: pullNumber };
}

/**
 * Review an entire repository
 */
export async function reviewRepository(
  owner?: string,
  repo?: string,
  branch?: string,
  maxFiles = 50
): Promise<ReviewResult> {
  // Validate GitHub configuration before making API calls
  validateGitHubConfig();

  const github = getGitHubService();
  const repoOwner = owner || process.env.GITHUB_OWNER;
  const repoName = repo || process.env.GITHUB_REPO;

  if (!repoOwner || !repoName) {
    throw new Error("Repository owner and name must be provided or configured in environment.");
  }

  logger.info(`Starting full repository review for ${repoOwner}/${repoName}`);

  const repoInfo = await github.getRepository(repoOwner, repoName);
  const ref = branch || repoInfo.default_branch;

  const tree = await github.getRepositoryTree(repoOwner, repoName, ref);

  const filesToReview = tree.filter((path) => {
    const language = getLanguageFromFilename(path);
    return language &&
      !path.includes('node_modules') &&
      !path.includes('venv') &&
      !path.includes('.venv') &&
      !path.includes('dist') &&
      !path.includes('.next');
  }).slice(0, maxFiles);

  logger.info(`Selected ${filesToReview.length} files for review out of ${tree.length} total objects.`);

  const changes: Array<{ file_path: string; content: string; language?: string }> = [];
  for (const path of filesToReview) {
    try {
      const content = await github.getFileContent(path, repoOwner, repoName, ref);
      changes.push({
        file_path: path,
        content,
        language: getLanguageFromFilename(path),
      });
    } catch (error) {
      logger.error(`Failed to fetch content for ${path}`, error);
    }
  }

  return await reviewPR(changes);
}

/**
 * Batch review multiple GitHub pull requests
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
      logger.error(`Failed to review PR #${pullNumber}`, error);
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
  repo?: string,
  commitId?: string
): Promise<void> {
  const github = getGitHubService();

  let comment = `## AI Technical Analysis\n\n`;
  comment += `**Risk Assessment:** ${result.risk_level}\n`;
  comment += `**Integration Decision:** ${result.decision}\n`;
  comment += `**Analysis Confidence:** ${result.confidence_score}%\n\n`;
  comment += `### Summary\n${result.summary}\n\n`;

  if (result.review_comments.length > 0) {
    comment += `### Technical Findings\n\n`;
    result.review_comments.forEach((c, i) => {
      comment += `#### ${i + 1}. [${c.severity}] ${c.category}\n`;
      comment += `**Location:** \`${c.file_path}:${c.line_number}\`\n`;
      comment += `${c.comment}\n`;
      if (c.suggestion) {
        comment += `**Recommendation:** ${c.suggestion}\n`;
      }
      if (c.example_fix) {
        const lang = getLanguageFromFilename(c.file_path) || 'typescript';
        comment += `**Refactoring Example:**\n\`\`\`${lang}\n${c.example_fix}\n\`\`\`\n`;
      }
      comment += `\n`;
    });
  }

  if (result.suggested_improvements.length > 0) {
    comment += `### Strategic Improvements\n\n`;
    result.suggested_improvements.forEach((improvement, i) => {
      comment += `${i + 1}. ${improvement}\n`;
    });
  }

  if (result.decision === Decision.APPROVED && result.approval_comment) {
    comment += `\n**Approval Note:** ${result.approval_comment}`;
  } else if (result.decision === Decision.CHANGES_REQUESTED && result.change_request_comment) {
    comment += `\n**Required Revisions:** ${result.change_request_comment}`;
  }

  let event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT" = "COMMENT";
  if (result.decision === Decision.APPROVED) {
    event = "APPROVE";
  } else if (result.decision === Decision.CHANGES_REQUESTED) {
    event = "REQUEST_CHANGES";
  }

  let addressableLines: Map<string, Set<number>> = new Map();
  try {
    const diff = await github.getPullRequestDiff(pullNumber, owner, repo);
    addressableLines = parseDiffForAddressableLines(diff);
  } catch (error) {
    logger.warn(`Failed to fetch diff for comment filtering: PR #${pullNumber}`, error);
  }

  const githubReviewComments = result.review_comments
    .filter(c => {
      const fileLines = addressableLines.get(c.file_path);
      const isImportant = c.severity === "MAJOR" || c.severity === "CRITICAL";
      return fileLines && fileLines.has(c.line_number) && isImportant;
    })
    .slice(0, 5)
    .map(c => ({
      path: c.file_path,
      line: c.line_number,
      body: `**${c.severity}** (Category: ${c.category})\n${c.comment}${c.suggestion ? `\n\n**Recommendation:** ${c.suggestion}` : ''}${c.example_fix ? `\n\n**Refactoring Example:**\n\`\`\`typescript\n${c.example_fix}\n\`\`\`` : ''}`,
      side: "RIGHT" as const
    }));

  await github.createReview(pullNumber, comment, event, githubReviewComments, owner, repo, commitId);
}

/**
 * Parse unified diff to find lines that can be commented on
 */
function parseDiffForAddressableLines(diff: string): Map<string, Set<number>> {
  const fileLines = new Map<string, Set<number>>();
  const lines = diff.split('\n');
  let currentFile = '';
  let currentLine = 0;

  for (const line of lines) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.substring(6);
      fileLines.set(currentFile, new Set());
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -\d+,\d+ \+(\d+),\d+ @@/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
    } else if (line.startsWith('+')) {
      currentLine++;
      if (currentFile) {
        fileLines.get(currentFile)?.add(currentLine);
      }
    } else if (line.startsWith(' ')) {
      currentLine++;
    }
  }

  return fileLines;
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