/**
 * Data models and interfaces for PR Review functionality
 */

export enum Severity {
    INFO = "INFO",
    MINOR = "MINOR",
    MAJOR = "MAJOR",
    CRITICAL = "CRITICAL",
}

export enum Category {
    CODE_QUALITY = "CODE_QUALITY",
    SECURITY = "SECURITY",
    PERFORMANCE = "PERFORMANCE",
    DESIGN = "DESIGN",
    TESTING = "TESTING",
    DEVOPS = "DEVOPS",
}

export enum RiskLevel {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL",
}

export enum Decision {
    APPROVED = "APPROVED",
    CHANGES_REQUESTED = "CHANGES_REQUESTED",
    COMMENT_ONLY = "COMMENT_ONLY",
}

export interface ReviewComment {
    file_path: string;
    line_number: number;
    severity: Severity;
    category: Category;
    comment: string;
    suggestion: string;
    example_fix?: string;
}

export interface ReviewResult {
    summary: string;
    risk_level: RiskLevel;
    decision: Decision;
    confidence_score: number;
    review_comments: ReviewComment[];
    suggested_improvements: string[];
    approval_comment?: string;
    change_request_comment?: string;
}

export interface FileChange {
    file_path: string;
    content: string;
    language?: string;
}

export interface ReviewContext {
    changes: FileChange[];
    target_languages?: string[];
}
