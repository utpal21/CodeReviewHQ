/**
 * Reviewer Registry using Registry Pattern
 * Manages and provides access to all available reviewers
 */

import { IReviewer } from "./base.reviewer.js";
import { ReviewContext, ReviewComment } from "../../models/review.models.js";

export class ReviewerRegistry {
    private static instance: ReviewerRegistry;
    private reviewers: Map<string, IReviewer> = new Map();

    private constructor() {
        // Private constructor for Singleton pattern
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ReviewerRegistry {
        if (!ReviewerRegistry.instance) {
            ReviewerRegistry.instance = new ReviewerRegistry();
        }
        return ReviewerRegistry.instance;
    }

    /**
     * Register a reviewer
     */
    public register(reviewer: IReviewer): void {
        this.reviewers.set(reviewer.getName(), reviewer);
    }

    /**
     * Unregister a reviewer
     */
    public unregister(name: string): void {
        this.reviewers.delete(name);
    }

    /**
     * Get a specific reviewer by name
     */
    public get(name: string): IReviewer | undefined {
        return this.reviewers.get(name);
    }

    /**
     * Get all registered reviewers
     */
    public getAll(): IReviewer[] {
        return Array.from(this.reviewers.values());
    }

    /**
     * Get reviewers that can handle the given file
     */
    public getReviewersForFile(filePath: string, language?: string): IReviewer[] {
        return Array.from(this.reviewers.values()).filter((reviewer) =>
            reviewer.canHandle(filePath, language)
        );
    }

    /**
     * Run all applicable reviewers on the context
     */
    public async review(context: ReviewContext): Promise<ReviewComment[]> {
        const allComments: ReviewComment[] = [];
        const processedFiles = new Set<string>();

        for (const change of context.changes) {
            // Avoid processing the same file multiple times
            if (processedFiles.has(change.file_path)) {
                continue;
            }
            processedFiles.add(change.file_path);

            // Get applicable reviewers for this file
            const applicableReviewers = this.getReviewersForFile(change.file_path, change.language);

            // Run each reviewer and collect comments
            for (const reviewer of applicableReviewers) {
                try {
                    const comments = await reviewer.review(context);
                    allComments.push(...comments);
                } catch (error) {
                    console.error(
                        `Error running reviewer ${reviewer.getName()} on ${change.file_path}:`,
                        error
                    );
                }
            }
        }

        return allComments;
    }
}
