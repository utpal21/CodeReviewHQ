import { describe, it, expect } from "vitest";
import { TypeScriptReviewer } from "../src/services/reviewers/typescript.reviewer.js";
import { PRReviewerService } from "../src/services/pr-reviewer.service.js";
import { ReviewerRegistry } from "../src/services/reviewers/registry.js";
import { Category, Severity, RiskLevel, Decision } from "../src/models/review.models.js";

describe("TypeScriptReviewer", () => {
    it("should detect console.log statements", async () => {
        const reviewer = new TypeScriptReviewer();
        const code = `function test() {\n  console.log("debug");\n}`;
        const comments = await reviewer.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: code,
                },
            ],
        });

        const consoleLogComment = comments.find((c) => c.comment.toLowerCase().includes("console"));
        expect(consoleLogComment).toBeDefined();
        expect(consoleLogComment?.severity).toBe(Severity.MINOR);
        expect(consoleLogComment?.category).toBe(Category.CODE_QUALITY);
    });

    it("should detect any types", async () => {
        const reviewer = new TypeScriptReviewer();
        const code = `function test(data: any): void {\n  return;\n}`;
        const comments = await reviewer.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: code,
                },
            ],
        });

        const anyComment = comments.find((c) => c.comment.includes("any"));
        expect(anyComment).toBeDefined();
        expect(anyComment?.severity).toBe(Severity.MAJOR);
    });

    it("should detect var usage", async () => {
        const reviewer = new TypeScriptReviewer();
        const code = `var x = 5;`;
        const comments = await reviewer.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: code,
                },
            ],
        });

        const varComment = comments.find((c) => c.comment.includes("var"));
        expect(varComment).toBeDefined();
        expect(varComment?.severity).toBe(Severity.MAJOR);
    });

    it("should detect hardcoded secrets", async () => {
        const reviewer = new TypeScriptReviewer();
        const code = `const test_pwd = "dummy_secret_value";`;
        const comments = await reviewer.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: code,
                },
            ],
        });

        const secretComment = comments.find((c) => c.category === Category.SECURITY);
        expect(secretComment).toBeDefined();
        expect(secretComment?.severity).toBe(Severity.CRITICAL);
    });

    it("should detect TODO comments", async () => {
        const reviewer = new TypeScriptReviewer();
        const code = `// TODO: implement feature\nfunction test() {}`;
        const comments = await reviewer.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: code,
                },
            ],
        });

        const todoComment = comments.find((c) => c.comment.includes("TODO"));
        expect(todoComment).toBeDefined();
        expect(todoComment?.severity).toBe(Severity.INFO);
    });

    it("should handle TypeScript files", () => {
        const reviewer = new TypeScriptReviewer();
        expect(reviewer.canHandle("test.ts")).toBe(true);
        expect(reviewer.canHandle("test.tsx")).toBe(true);
        expect(reviewer.canHandle("test.js")).toBe(true);
        expect(reviewer.canHandle("test.py")).toBe(false);
    });
});

describe("PRReviewerService", () => {
    it("should return low risk for clean code", async () => {
        const registry = ReviewerRegistry.getInstance();
        registry.register(new TypeScriptReviewer());
        const service = new PRReviewerService();
        const result = await service.review({
            changes: [
                {
                    file_path: "clean.ts",
                    content: `function add(a: number, b: number): number {\n  return a + b;\n}`,
                    language: "typescript",
                },
            ],
        });

        expect(result.risk_level).toBe(RiskLevel.LOW);
        expect(result.decision).toBe(Decision.APPROVED);
        expect(result.confidence_score).toBeGreaterThan(80);
    });

    it("should return high risk for code with issues", async () => {
        const registry = ReviewerRegistry.getInstance();
        registry.register(new TypeScriptReviewer());
        const service = new PRReviewerService();
        const result = await service.review({
            changes: [
                {
                    file_path: "bad.ts",
                    content: `var x: any = 5;\nconsole.log("debug");`,
                    language: "typescript",
                },
            ],
        });

        expect(result.risk_level).toBe(RiskLevel.HIGH);
        expect(result.decision).toBe(Decision.CHANGES_REQUESTED);
        expect(result.review_comments.length).toBeGreaterThan(0);
    });

    it("should request changes for critical issues", async () => {
        const registry = ReviewerRegistry.getInstance();
        registry.register(new TypeScriptReviewer());
        const service = new PRReviewerService();
        const result = await service.review({
            changes: [
                {
                    file_path: "security.ts",
                    content: `const test_pwd = "dummy_secret_value";`,
                    language: "typescript",
                },
            ],
        });

        expect(result.decision).toBe(Decision.CHANGES_REQUESTED);
        expect(result.change_request_comment).toBeDefined();
    });

    it("should handle empty changes", async () => {
        const service = new PRReviewerService();
        const result = await service.review({
            changes: [],
        });

        expect(result.decision).toBe(Decision.COMMENT_ONLY);
        expect(result.review_comments.length).toBe(0);
    });
});

describe("ReviewerRegistry", () => {
    it("should register and retrieve reviewers", () => {
        const registry = ReviewerRegistry.getInstance();
        const reviewer = new TypeScriptReviewer();
        registry.register(reviewer);

        const retrieved = registry.get("TypeScriptReviewer");
        expect(retrieved).toBe(reviewer);
    });

    it("should get reviewers for specific files", () => {
        const registry = ReviewerRegistry.getInstance();
        const reviewer = new TypeScriptReviewer();
        registry.register(reviewer);

        const reviewers = registry.getReviewersForFile("test.ts");
        expect(reviewers.length).toBeGreaterThan(0);
    });

    it("should review using registered reviewers", async () => {
        const registry = ReviewerRegistry.getInstance();
        registry.register(new TypeScriptReviewer());

        const comments = await registry.review({
            changes: [
                {
                    file_path: "test.ts",
                    content: `var x: any = 5;`,
                },
            ],
        });

        expect(comments.length).toBeGreaterThan(0);
    });
});
