
import { BaseReviewer } from "./base.reviewer.js";
import { ReviewContext, ReviewComment, Category, Severity } from "../../models/review.models.js";

export class PythonReviewer extends BaseReviewer {
    constructor() {
        super("PythonReviewer");
    }

    protected initializePatterns(): void {
        this.languagePatterns.set("python", /\.py$/i);
    }

    async review(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];

        for (const change of context.changes) {
            if (!this.canHandle(change.file_path, "python")) {
                continue;
            }

            comments.push(...this.analyzeCode(change));
        }

        return comments;
    }

    protected analyzeCode(change: { file_path: string; content: string }): ReviewComment[] {
        const comments: ReviewComment[] = [];
        const lines = change.content.split("\n");

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;

            // Check for print statements
            if (this.hasPrintStatement(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MINOR,
                        "Print statement found in production code",
                        "Use proper logging (e.g., logging module) instead of print()",
                        "import logging\nlogger = logging.getLogger(__name__)\nlogger.info('message')"
                    )
                );
            }

            // Check for empty except blocks
            if (this.hasEmptyExcept(line, lines, i)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MAJOR,
                        "Bare 'except:' or 'except Exception: pass' suppresses all errors",
                        "Catch specific exceptions and handle or log them properly",
                        "try:\n    ...\nexcept ValueError as e:\n    logger.error(f'Invalid value: {e}')"
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
                        "Move secrets to environment variables or secret management service",
                        "import os\napi_key = os.getenv('API_KEY')"
                    )
                );
            }

            // Check for large functions (def)
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

            // Check for insecure eval/exec
            if (this.hasInsecureExec(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.SECURITY,
                        Severity.CRITICAL,
                        "Use of 'eval()' or 'exec()' detected",
                        "Avoid using eval() or exec() with untrusted input as it leads to RCE vulnerabilities",
                        "import json\n# Use json.loads() instead of eval()"
                    )
                );
            }

            // Check for requests without timeout
            if (this.hasRequestsWithoutTimeout(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.SECURITY,
                        Severity.MAJOR,
                        "HTTP request without timeout",
                        "Always specify a timeout to avoid hanging processes",
                        "requests.get(url, timeout=10)"
                    )
                );
            }
            
            // Check for lack of type hints
            if (this.isFunctionDef(line) && !this.hasTypeHints(line)) {
                comments.push(
                    this.createComment(
                        change.file_path,
                        lineNumber,
                        Category.CODE_QUALITY,
                        Severity.MINOR,
                        "Function definition lacks type hints",
                        "Add type hints to parameters and return values for better code clarity and tool support",
                        "def process_data(data: str) -> bool:"
                    )
                );
            }
        }

        return comments;
    }

    private hasInsecureExec(line: string): boolean {
        return /\b(eval|exec)\(/.test(line) && !line.trim().startsWith("#");
    }

    private hasRequestsWithoutTimeout(line: string): boolean {
        return /\brequests\.(get|post|put|delete|patch)\(/.test(line) && !line.includes("timeout=") && !line.trim().startsWith("#");
    }

    private hasPrintStatement(line: string): boolean {
        return /print\(/.test(line) && !line.trim().startsWith("#");
    }

    private hasEmptyExcept(line: string, lines: string[], index: number): boolean {
        const trimmed = line.trim();
        if (trimmed.startsWith("except:") || trimmed.startsWith("except Exception:")) {
            const nextLine = lines[index + 1];
            if (nextLine && nextLine.trim() === "pass") {
                return true;
            }
        }
        return false;
    }

    private hasHardcodedSecret(line: string): boolean {
        const patterns = [
            /password\s*=\s*['"`][^'"`]+['"`]/i,
            /api[_-]?key\s*=\s*['"`][^'"`]+['"`]/i,
            /secret\s*=\s*['"`][^'"`]+['"`]/i,
            /token\s*=\s*['"`][^'"`]{20,}['"`]/i,
        ];

        return patterns.some((pattern) => pattern.test(line)) && !line.trim().startsWith("#");
    }

    private isFunctionDef(line: string): boolean {
        return line.trim().startsWith("def ") && line.includes("(");
    }

    private hasTypeHints(line: string): boolean {
        // Simple check for presence of : and ->
        return line.includes(":") && (line.includes("->") || line.includes("):"));
    }

    private hasLargeFunction(line: string, lines: string[], startIndex: number): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith("def ")) return false;

        let lineCount = 0;
        const baseIndentation = line.length - line.trimStart().length;

        for (let i = startIndex + 1; i < lines.length; i++) {
            const currentLine = lines[i];
            if (currentLine.trim() === "") continue;

            const currentIndentation = currentLine.length - currentLine.trimStart().length;
            if (currentIndentation <= baseIndentation && currentLine.trim() !== "") {
                break;
            }
            lineCount++;
            if (lineCount > 50) return true;
        }

        return false;
    }
}
