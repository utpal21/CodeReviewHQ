/**
 * TypeScript/JavaScript Code Reviewer
 * Implements Strategy Pattern for TypeScript-specific code analysis
 */

import { BaseReviewer } from "./base.reviewer.js";
import { ReviewContext, ReviewComment, Category, Severity } from "../../models/review.models.js";

export class TypeScriptReviewer extends BaseReviewer {
    constructor() {
        super("TypeScriptReviewer");
    }

    /**
     * Initialize file patterns
     */
    protected initializePatterns(): void {
        this.languagePatterns.set("typescript", /\.(ts|tsx)$/i);
        this.languagePatterns.set("javascript", /\.(js|jsx)$/i);
    }

    /**
     * Review TypeScript/JavaScript code
     */
    async review(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];

        for (const change of context.changes) {
            if (!this.canHandle(change.file_path, change.language)) {
                continue;
            }

            comments.push(...this.analyzeCode(change));
        }

        return comments;
    }

    /**
     * Analyze code for issues
     */
    protected analyzeCode(change: { file_path: string; content: string }): ReviewComment[] {
        const comments: ReviewComment[] = [];
        const lines = change.content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Check for console.log statements
            if (this.hasConsoleLog(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MINOR,
                        "Console.log statement found in production code",
                        "Remove console.log statements or replace with proper logging framework",
                        "// logger.info('message')"
                    )
                );
            }

            // Check for any types
            if (this.hasAnyType(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MAJOR,
                        "Avoid using 'any' type as it disables type checking",
                        "Replace 'any' with a specific type or 'unknown' for safer type handling",
                        "function foo(data: UserInput) { ... }"
                    )
                );
            }

            // Check for var usage
            if (this.hasVarUsage(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MAJOR,
                        "Using 'var' is discouraged in modern JavaScript/TypeScript",
                        "Use 'const' or 'let' instead of 'var' for better scoping",
                        "const value = 5;"
                    )
                );
            }

            // Check for empty catch blocks
            if (this.hasEmptyCatch(line, lines, i)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MAJOR,
                        "Empty catch block suppresses errors without proper handling",
                        "Add error logging or handling logic in catch block",
                        "catch (error) {\n  logger.error('Error occurred', error);\n  throw error;\n}"
                    )
                );
            }

            // Check for TODO comments
            if (this.hasTodoComment(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.INFO,
                        "TODO comment found - ensure this is addressed before merging",
                        "Resolve the TODO or create an issue ticket",
                        "// TODO: Implement feature X"
                    )
                );
            }

            // Check for hardcoded secrets
            if (this.hasHardcodedSecret(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.SECURITY,
                        Severity.CRITICAL,
                        "Potential hardcoded secret detected in code",
                        "Move secrets to environment variables or secure configuration",
                        "const apiKey = process.env.API_KEY;"
                    )
                );
            }

            // Check for large functions
            if (this.hasLargeFunction(line, lines, i)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.DESIGN,
                        Severity.MINOR,
                        "Function appears to be large (>50 lines)",
                        "Consider breaking down the function into smaller, more focused functions"
                    )
                );
            }
        }

        return comments;
    }

    /**
     * Check for console.log
     */
    private hasConsoleLog(line: string): boolean {
        return /console\.(log|debug|info|warn|error)/.test(line) && !line.trim().startsWith("//");
    }

    /**
     * Check for any type
     */
    private hasAnyType(line: string): boolean {
        return /:\s*any\b/.test(line) && !line.trim().startsWith("//");
    }

    /**
     * Check for var usage
     */
    private hasVarUsage(line: string): boolean {
        return /\bvar\s+/.test(line) && !line.trim().startsWith("//");
    }

    /**
     * Check for empty catch block
     */
    private hasEmptyCatch(line: string, lines: string[], index: number): boolean {
        if (!line.includes("catch")) return false;

        // Look ahead for empty catch body
        const nextLine = lines[index + 1];
        if (nextLine && (nextLine.trim() === "}" || nextLine.trim() === "// empty")) {
            return true;
        }

        return false;
    }

    /**
     * Check for TODO comments
     */
    private hasTodoComment(line: string): boolean {
        return /\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(line);
    }

    /**
     * Check for hardcoded secrets
     */
    private hasHardcodedSecret(line: string): boolean {
        const patterns = [
            /\b(password|pwd|secret|api[_-]?key)\s*=\s*['"`][^'"`]+['"`]/i,
            /token\s*=\s*['"`][^'"`]{20,}['"`]/i,
        ];

        return patterns.some((pattern) => pattern.test(line)) && !line.trim().startsWith("//");
    }

    /**
     * Check for large functions
     */
    private hasLargeFunction(line: string, lines: string[], startIndex: number): boolean {
        if (!line.includes("function") && !line.includes("=>") && !line.includes("async")) {
            return false;
        }

        // Count lines until closing brace
        let braceCount = 0;
        let lineCount = 0;
        let inFunction = false;

        for (let i = startIndex; i < lines.length; i++) {
            const currentLine = lines[i];

            if (!inFunction) {
                if (currentLine.includes("{")) {
                    inFunction = true;
                } else {
                    continue;
                }
            }

            braceCount += (currentLine.match(/{/g) || []).length;
            braceCount -= (currentLine.match(/}/g) || []).length;
            lineCount++;

            if (braceCount === 0 && inFunction) {
                break;
            }

            if (lineCount > 50) {
                return true;
            }
        }

        return false;
    }
}