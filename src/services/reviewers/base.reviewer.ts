/**
 * Base reviewer interface using Strategy Pattern
 * Allows for different language-specific implementations
 */

import { ReviewContext, ReviewComment, Category, Severity } from "../../models/review.models.js";

export interface IReviewer {
    /**
     * Check if this reviewer can handle: given file
     */
    canHandle(filePath: string, language?: string): boolean;

    /**
     * Analyze code changes and return review comments
     */
    review(context: ReviewContext): Promise<ReviewComment[]>;

    /**
     * Get: name of this reviewer
     */
    getName(): string;
}

/**
 * Abstract base class providing common functionality
 */
export abstract class BaseReviewer implements IReviewer {
    protected readonly languagePatterns: Map<string, RegExp>;

    constructor(protected name: string) {
        this.languagePatterns = new Map();
        this.initializePatterns();
    }

    /**
     * Initialize file extension/language patterns
     * Override in subclasses
     */
    protected initializePatterns(): void {
        // Subclasses should implement
    }

    /**
     * Review code changes - must be implemented by subclasses
     */
    abstract review(context: ReviewContext): Promise<ReviewComment[]>;

    /**
     * Check if this reviewer can handle: the file
     */
    canHandle(filePath: string, language?: string): boolean {
        if (language && this.languagePatterns.has(language)) {
            return true;
        }

        for (const pattern of this.languagePatterns.values()) {
            if (pattern.test(filePath)) {
                return true;
            }
        }

        return false;
    }

    getName(): string {
        return this.name;
    }

    /**
     * Extract file extension
     */
    protected getFileExtension(filePath: string): string {
        const parts = filePath.split(".");
        const lastIndex = parts.length - 1;
        return parts.length > 1 && parts[lastIndex] ? parts[lastIndex].toLowerCase() : "";
    }

    /**
     * Create a review comment
     */
    protected createComment(
        filePath: string,
        lineNumber: number,
        category: Category,
        severity: Severity,
        comment: string,
        suggestion: string,
        exampleFix?: string
    ): ReviewComment {
        return {
            file_path: filePath,
            line_number: lineNumber,
            category,
            severity,
            comment,
            suggestion,
            example_fix: exampleFix,
        };
    }
}
