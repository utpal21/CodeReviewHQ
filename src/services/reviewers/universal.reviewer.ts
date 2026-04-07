import { BaseReviewer } from "./base.reviewer.js";
import { ReviewContext, ReviewComment, Category, Severity } from "../../models/review.models.js";

/**
 * Universal Code Reviewer
 * Provides expert-level static analysis for a wide range of programming languages
 * using language-aware regex patterns.
 */
export class UniversalReviewer extends BaseReviewer {
    private commentStyles: Record<string, string[]> = {
        java: ["//", "/*"],
        go: ["//", "/*"],
        ruby: ["#", "=begin"],
        php: ["//", "#", "/*"],
        c: ["//", "/*"],
        cpp: ["//", "/*"],
        csharp: ["//", "/*"],
        swift: ["//", "/*"],
        kotlin: ["//", "/*"],
        scala: ["//", "/*"],
        rust: ["//", "/*"],
    };

    private printPatterns: Record<string, RegExp> = {
        java: /System\.out\.print(ln)?\(/,
        go: /fmt\.Print(f|ln)?\(/,
        ruby: /puts\s+/,
        php: /echo\s+|var_dump\(|print\(/,
        c: /printf\(/,
        cpp: /std::cout/,
        csharp: /Console\.Write(Line)?\(/,
        swift: /print\(/,
        kotlin: /print(ln)?\(/,
        scala: /print(ln)?\(/,
        rust: /println!\(/,
    };

    constructor() {
        super("UniversalReviewer");
    }

    protected initializePatterns(): void {
        this.languagePatterns.set("java", /\.java$/i);
        this.languagePatterns.set("go", /\.go$/i);
        this.languagePatterns.set("ruby", /\.rb$/i);
        this.languagePatterns.set("php", /\.php$/i);
        this.languagePatterns.set("c", /\.(c|h)$/i);
        this.languagePatterns.set("cpp", /\.(cpp|hpp|cc|cxx)$/i);
        this.languagePatterns.set("csharp", /\.cs$/i);
        this.languagePatterns.set("swift", /\.swift$/i);
        this.languagePatterns.set("kotlin", /\.kt$/i);
        this.languagePatterns.set("scala", /\.scala$/i);
        this.languagePatterns.set("rust", /\.rs$/i);
    }

    review(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];

        for (const change of context.changes) {
            const language = this.mapExtToLanguage(this.getFileExtension(change.file_path));

            if (!language || !this.canHandle(change.file_path, language)) {
                continue;
            }

            comments.push(...this.analyzeCode(change, language));
        }

        return Promise.resolve(comments);
    }

    private mapExtToLanguage(ext: string): string | undefined {
        const map: Record<string, string> = {
            java: "java",
            go: "go",
            rb: "ruby",
            php: "php",
            c: "c",
            h: "c",
            cpp: "cpp",
            hpp: "cpp",
            cc: "cpp",
            cs: "csharp",
            swift: "swift",
            kt: "kotlin",
            scala: "scala",
            rs: "rust",
        };
        return map[ext];
    }

    protected analyzeCode(
        change: { file_path: string; content: string },
        language: string
    ): ReviewComment[] {
        const comments: ReviewComment[] = [];
        const lines = change.content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            if (!line) continue;

            // 1. Check for Print/Stdout in production
            const printPattern = this.printPatterns[language];
            if (printPattern && printPattern.test(line) && !this.isComment(line, language)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MINOR,
                        `Print/Stdout statement detected in ${language} source`,
                        "Replace with a professional logging framework"
                    )
                );
            }

            // 2. Check for Hardcoded Secrets
            if (this.hasHardcodedSecret(line) && !this.isComment(line, language)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.SECURITY,
                        Severity.CRITICAL,
                        "Insecure hardcoded secret or token detected",
                        "Move sensitive credentials to environment variables or secret management services"
                    )
                );
            }

            // 3. Check for TODOs
            if (this.hasTodoComment(line, language)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.INFO,
                        "Unresolved TODO/FIXME found in codebase",
                        "Addresss issue or track it in your task management system before merging"
                    )
                );
            }

            // 4. Check for Large Functions
            if (this.isFunctionDef(line, language) && this.hasLargeFunction(line, lines, i)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.DESIGN,
                        Severity.MINOR,
                        "Function exceeds acceptable complexity and length (>50 lines)",
                        "Refactor by extracting logic into smaller, testable sub-functions"
                    )
                );
            }
        }

        return comments;
    }

    private isComment(line: string, language: string): boolean {
        const styles = this.commentStyles[language] || ["//", "#"];
        const trimmed = line.trim();
        return styles.some((style) => trimmed.startsWith(style));
    }

    private hasTodoComment(line: string, language: string): boolean {
        return /\b(TODO|FIXME|HACK|XXX)\b/i.test(line) && this.isComment(line, language);
    }

    private hasHardcodedSecret(line: string): boolean {
        const secretPatterns = [
            /\b(password|pwd|secret|api[_-]?key)\s*[=:]\s*['"`][^'"`]+['"`]/i,
            /token\s*[=:]\s*['"`][^'"`]{15,}['"`]/i,
        ];
        return secretPatterns.some((p) => p.test(line));
    }

    private isFunctionDef(line: string, language: string): boolean {
        const defPatterns: Record<string, RegExp> = {
            java: /(public|protected|private|static).*\s+\w+\(.*\)\s*\{/,
            go: /func\s+\w+\(.*\)/,
            ruby: /def\s+\w+/,
            php: /function\s+\w+\(.*\)/,
            c: /\w+\s+\w+\(.*\)\s*\{/,
            cpp: /\w+\s+\w+\(.*\)\s*\{/,
            csharp: /(public|protected|private|static).*\s+\w+\(.*\)\s*\{/,
            swift: /func\s+\w+\(.*\)/,
            kotlin: /fun\s+\w+\(.*\)/,
            scala: /def\s+\w+\(.*\)/,
            rust: /fn\s+\w+\(.*\)/,
        };
        const pattern = defPatterns[language] || /function\s+\w+/;
        return pattern.test(line) && !this.isComment(line, language);
    }

    private hasLargeFunction(line: string, lines: string[], startIndex: number): boolean {
        let count = 0;
        const indent = line.length - line.trimStart().length;

        // Simple heuristic: count non-empty lines with greater indentation or until matching brace
        for (let i = startIndex + 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (!currentLine) continue;

            if (currentLine.trim() === "") continue;

            const currentIndent = currentLine.length - currentLine.trimStart().length;
            if (
                currentIndent <= indent &&
                currentLine.trim() !== "}" &&
                currentLine.trim() !== "end"
            ) {
                break;
            }

            count++;
            if (count > 50) return true;
        }
        return false;
    }
}
