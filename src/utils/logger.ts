/**
 * Standardized Logger for MCP Servers.
 * Directs output to stderr to avoid interference with the MCP JSON-RPC protocol on stdout.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
}

export class Logger {
    private static instance: Logger;
    private level: LogLevel = LogLevel.INFO;

    private constructor() {
        if (process.env.DEBUG === "true" || process.env.NODE_ENV === "development") {
            this.level = LogLevel.DEBUG;
        }
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    public debug(message: string, context?: any): void {
        if (this.level <= LogLevel.DEBUG) {
            this.log("DEBUG", message, context);
        }
    }

    public info(message: string, context?: any): void {
        if (this.level <= LogLevel.INFO) {
            this.log("INFO", message, context);
        }
    }

    public warn(message: string, context?: any): void {
        if (this.level <= LogLevel.WARN) {
            this.log("WARN", message, context);
        }
    }

    public error(message: string, error?: any): void {
        if (this.level <= LogLevel.ERROR) {
            this.log("ERROR", message, error);
        }
    }

    private log(label: string, message: string, context?: any): void {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` | ${JSON.stringify(this.sanitize(context))}` : "";
        process.stderr.write(`[${timestamp}] [${label}] ${message}${contextStr}\n`);
    }

    private sanitize(obj: any): any {
        if (!obj || typeof obj !== "object") return obj;
        const sanitized = { ...obj };
        // Sensitive data prevention
        ["token", "password", "secret", "auth", "authorization"].forEach((key) => {
            if (key in sanitized) sanitized[key] = "********";
        });
        return sanitized;
    }
}

export const logger = Logger.getInstance();
