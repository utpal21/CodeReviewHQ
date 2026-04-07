import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

/**
 * Security constants
 */
export const SECURITY_CONSTANTS = {
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: 100, // Limit each IP to 100 requests per windowMs
    RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: false,
    MAX_REQUEST_SIZE: "10mb",
    CORS_ORIGINS: process.env.CORS_ORIGINS?.split(",") || "*",
};

/**
 * Rate limiter configuration
 * Protects against brute-force attacks and DDoS
 */
export const rateLimiter = rateLimit({
    windowMs: SECURITY_CONSTANTS.RATE_LIMIT_WINDOW_MS,
    max: SECURITY_CONSTANTS.RATE_LIMIT_MAX_REQUESTS,
    message: {
        error: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
        // Skip rate limiting for health checks
        return req.path === "/health" || req.path === "/ping";
    },
    handler: (req: Request, res: Response) => {
        logger.warn("Rate limit exceeded", {
            ip: req.ip,
            path: req.path,
            userAgent: req.get("user-agent"),
        });
        res.status(429).json({
            error: "Too many requests",
            message: "Rate limit exceeded. Please try again later.",
        });
    },
});

/**
 * Helmet middleware for security headers
 * Protects against well-known web vulnerabilities
 */
export const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    noSniff: true,
    frameguard: { action: "deny" },
    xssFilter: true,
});

/**
 * Input validation middleware
 * Validates request body size and structure
 */
export const validateInputSize = (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get("content-length");
    const maxSize = parseInt(SECURITY_CONSTANTS.MAX_REQUEST_SIZE.replace("mb", "")) * 1024 * 1024;

    if (contentLength && parseInt(contentLength) > maxSize) {
        logger.warn("Request size limit exceeded", {
            ip: req.ip,
            contentLength,
            maxSize,
        });
        res.status(413).json({
            error: "Payload too large",
            message: `Request body size exceeds limit of ${SECURITY_CONSTANTS.MAX_REQUEST_SIZE}`,
        });
        return;
    }

    next();
};

/**
 * CORS configuration
 */
export const corsConfig = {
    origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        if (SECURITY_CONSTANTS.CORS_ORIGINS.includes("*")) {
            callback(null, true);
            return;
        }

        if (!origin) {
            callback(null, true);
            return;
        }

        if (SECURITY_CONSTANTS.CORS_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn("CORS blocked", { origin });
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 204,
};

/**
 * Security error handler
 */
export const securityErrorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (err.message === "Not allowed by CORS") {
        logger.warn("CORS error", {
            ip: req.ip,
            origin: req.get("origin"),
            path: req.path,
        });
        res.status(403).json({
            error: "Forbidden",
            message: "Cross-origin request not allowed",
        });
        return;
    }

    next(err);
};

/**
 * Request ID middleware for tracing
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const requestId =
        (req.headers["x-request-id"] as string) ||
        `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    req.headers["x-request-id"] = requestId;
    res.setHeader("X-Request-ID", requestId);
    next();
};

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;
        logger.info("HTTP Request", {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            requestId: req.headers["x-request-id"],
        });
    });

    next();
};
