import { beforeAll, afterAll } from "vitest";
import { logger } from "../src/utils/logger.js";

// Global test setup
beforeAll(() => {
    // Configure logger for tests
    logger.setLevel(3); // ERROR level for tests
});

afterAll(() => {
    // Cleanup after all tests
});
