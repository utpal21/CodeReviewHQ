/**
 * PR Reviewer Service - Main orchestration service
 * Uses Facade Pattern to provide a simple interface for the review process
 */

import { ReviewContext, ReviewResult, ReviewComment, RiskLevel, Decision } from "../models/review.models.js";
import { ReviewerRegistry } from "./reviewers/registry.js";

export class PRReviewerService {
    private registry: ReviewerRegistry;

    constructor() {
        this.registry = ReviewerRegistry.getInstance();
    }

    /**
     * Perform a comprehensive PR review
     */
    public async review(context: ReviewContext): Promise<ReviewResult> {
        // Validate input
        if (!context.changes || context.changes.length === 0) {
            return this.createEmptyReview("No changes to review");
        }

        // Run all applicable reviewers
        const comments = await this.registry.review(context);

        // Analyze comments to determine risk level and decision
        const analysis = this.analyzeComments(comments);

        // Generate the final review result
        return this.buildReviewResult(context, comments, analysis);
    }

    /**
     * Analyze comments to determine risk level and decision
     */
    private analyzeComments(comments: ReviewComment[]): {
        riskLevel: RiskLevel;
        decision: Decision;
        summary: string;
    } {
        if (comments.length === 0) {
            return {
                riskLevel: RiskLevel.LOW,
                decision: Decision.APPROVED,
                summary: "No issues found. The code changes follow best practices.",
            };
        }

        // Count comments by severity
        const severityCounts = comments.reduce(
            (acc, comment) => {
                acc[comment.severity] = (acc[comment.severity] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        // Determine risk level
        let riskLevel = RiskLevel.LOW;
        if (severityCounts["CRITICAL"] > 0) {
            riskLevel = RiskLevel.CRITICAL;
        } else if (severityCounts["MAJOR"] > 0) {
            riskLevel = RiskLevel.HIGH;
        } else if (severityCounts["MINOR"] > 2) {
            riskLevel = RiskLevel.MEDIUM;
        }

        // Determine decision
        let decision = Decision.APPROVED;
        if (severityCounts["CRITICAL"] > 0 || severityCounts["MAJOR"] > 0) {
            decision = Decision.CHANGES_REQUESTED;
        }

        // Generate summary
        const summary = this.generateSummary(comments, severityCounts, riskLevel);

        return { riskLevel, decision, summary };
    }

    /**
     * Generate a human-readable summary
     */
    private generateSummary(
        comments: ReviewComment[],
        severityCounts: Record<string, number>,
        riskLevel: RiskLevel
    ): string {
        const totalIssues = comments.length;
        const critical = severityCounts["CRITICAL"] || 0;
        const major = severityCounts["MAJOR"] || 0;
        const minor = severityCounts["MINOR"] || 0;
        const info = severityCounts["INFO"] || 0;

        let summary = `Reviewed ${totalIssues} ${totalIssues === 1 ? "issue" : "issues"}. `;

        if (critical > 0) {
            summary += `${critical} critical, `;
        }
        if (major > 0) {
            summary += `${major} major, `;
        }
        if (minor > 0) {
            summary += `${minor} minor, `;
        }
        if (info > 0) {
            summary += `${info} informational`;
        }

        summary = summary.replace(/, $/, ".");

        if (riskLevel === RiskLevel.CRITICAL) {
            summary += " Critical issues must be addressed before merging.";
        } else if (riskLevel === RiskLevel.HIGH) {
            summary += " Important issues should be fixed.";
        } else if (riskLevel === RiskLevel.MEDIUM) {
            summary += " Some improvements are recommended.";
        } else {
            summary += " Generally good code quality.";
        }

        return summary;
    }

    /**
     * Build the final review result
     */
    private buildReviewResult(
        context: ReviewContext,
        comments: ReviewComment[],
        analysis: { riskLevel: RiskLevel; decision: Decision; summary: string }
    ): ReviewResult {
        const result: ReviewResult = {
            summary: analysis.summary,
            risk_level: analysis.riskLevel,
            decision: analysis.decision,
            confidence_score: this.calculateConfidenceScore(comments, analysis.riskLevel),
            review_comments: comments,
            suggested_improvements: this.extractSuggestions(comments),
        };

        // Add decision-specific messages
        if (analysis.decision === Decision.APPROVED) {
            result.approval_comment = "The implementation adheres to established coding standards and demonstrates architectural consistency. Approved for merge.";
        } else if (analysis.decision === Decision.CHANGES_REQUESTED) {
            result.change_request_comment =
                "Critical issues identified that compromise system integrity or security. Refactoring is required before these changes can be integrated.";
        }

        return result;
    }

    /**
     * Calculate confidence score based on analysis
     */
    private calculateConfidenceScore(comments: ReviewComment[], riskLevel: RiskLevel): number {
        // Base score
        let score = 95;

        if (comments.length === 0) return 100;

        // Deduct points based on severity with a floor
        const criticalCount = comments.filter(c => c.severity === "CRITICAL").length;
        const majorCount = comments.filter(c => c.severity === "MAJOR").length;

        score -= (criticalCount * 15);
        score -= (majorCount * 5);
        score -= (comments.length * 1);

        // Cap deductions
        if (riskLevel === RiskLevel.CRITICAL) score = Math.min(score, 40);
        if (riskLevel === RiskLevel.HIGH) score = Math.min(score, 60);

        return Math.max(10, Math.min(100, score));
    }

    /**
     * Extract suggestions from comments
     */
    private extractSuggestions(comments: ReviewComment[]): string[] {
        const suggestions = new Set<string>();

        for (const comment of comments) {
            if (comment.suggestion) {
                suggestions.add(comment.suggestion);
            }
        }

        return Array.from(suggestions);
    }

    /**
     * Create an empty review result
     */
    private createEmptyReview(message: string): ReviewResult {
        return {
            summary: message,
            risk_level: RiskLevel.LOW,
            decision: Decision.COMMENT_ONLY,
            confidence_score: 0,
            review_comments: [],
            suggested_improvements: [],
        };
    }
}