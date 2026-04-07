# CodeReviewHQ - AI-Powered Pull Request Automation

**[![CI/CD Pipeline](https://github.com/utpal21/CodeReviewHQ/actions/workflows/ci.yml/badge.svg)](https://github.com/utpal21/CodeReviewHQ/actions/workflows/ci.yml)**
**[![codecov](https://codecov.io/gh/utpal21/CodeReviewHQ/branch/main/graph/badge.svg)](https://codecov.io/gh/utpal21/CodeReviewHQ)**
**[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)**
**[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)**
**[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green)](https://nodejs.org/)**

An intelligent, enterprise-grade code review automation platform that provides comprehensive Pull Request analysis with seamless GitHub integration. Built with TypeScript and following industry-standard design patterns, CodeReviewHQ enables teams to maintain code quality, security standards, and best practices at scale.

## 🎯 Key Features

### Core Capabilities
- **Multi-language Support**: Extensible architecture supporting TypeScript, JavaScript, Python, and more
- **Automated Code Review**: Detects code quality issues, security vulnerabilities, and best practices violations
- **GitHub Integration**: Fetch PRs from GitHub, review them, and post comments automatically
- **Batch Processing**: Review multiple PRs simultaneously with parallel execution
- **Decision Making**: Provides APPROVED, CHANGES_REQUESTED, or COMMENT_ONLY decisions with confidence scores
- **Risk Assessment**: Calculates risk levels (LOW, MEDIUM, HIGH, CRITICAL) with actionable insights
- **MCP Compatible**: Ready for deployment on [MCPize.com](https://mcpize.com/) SaaS platform

### Code Quality Checks
- Console/debug statement detection
- `any` type usage in TypeScript
- `var` usage enforcement (const/let preference)
- TODO/FIXME/HACK comment detection
- Empty catch block identification
- Large function detection (>50 lines)
- Code complexity analysis

### Security Checks
- Hardcoded password detection
- API key exposure prevention
- Secret/token pattern matching
- OWASP security best practices
- Input validation alerts

## 📦 Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn package manager
- GitHub Personal Access Token (for GitHub integration)

### Installation

```bash
# Clone the repository
git clone https://github.com/utpal21/CodeReviewHQ.git
cd CodeReviewHQ

# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev
```

### Configuration

Create a `.env` file in the project root:

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# GitHub Configuration
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repo-name

# Security (Optional)
CORS_ORIGINS=https://app.mcpize.com,https://yourdomain.com
```

### Running with MCPize

Deploy instantly on [MCPize.com](https://mcpize.com/) by connecting your GitHub repository. The platform automatically handles:

- Environment variable management
- Secure token storage
- Scalable hosting
- Automatic updates
- Usage analytics

## 🔧 MCP Tools

CodeReviewHQ provides powerful MCP tools for automated code review:

### 1. `review_pr`
Review provided code changes with comprehensive analysis.

**Input:**
```json
{
  "changes": [
    {
      "file_path": "src/example.ts",
      "content": "function test() { console.log('debug'); }",
      "language": "typescript"
    }
  ]
}
```

**Output:**
```json
{
  "summary": "Reviewed 1 issue. 1 minor informational.",
  "risk_level": "LOW",
  "decision": "APPROVED",
  "confidence_score": 98,
  "review_comments": [
    {
      "file_path": "src/example.ts",
      "line_number": 1,
      "severity": "MINOR",
      "category": "CODE_QUALITY",
      "comment": "Console.log statement found in production code",
      "suggestion": "Remove console.log statements or replace with proper logging framework",
      "example_fix": "// logger.info('message')"
    }
  ],
  "suggested_improvements": ["Replace console.log with proper logging"]
}
```

### 2. `review_github_pr`
Review a specific GitHub PR with optional inline commenting.

**Input:**
```json
{
  "pull_number": 123,
  "owner": "optional-owner",
  "repo": "optional-repo",
  "post_comment": false,
  "github_token": "ghp_your_token_here"
}
```

### 3. `fetch_pull_requests`
List pull requests from a GitHub repository.

**Input:**
```json
{
  "owner": "optional-owner",
  "repo": "optional-repo",
  "state": "open",
  "limit": 10,
  "github_token": "ghp_your_token_here"
}
```

### 4. `review_repository`
Analyze an entire GitHub repository for technical debt and security risks.

**Input:**
```json
{
  "owner": "optional-owner",
  "repo": "optional-repo",
  "branch": "main",
  "max_files": 50,
  "github_token": "ghp_your_token_here"
}
```

### 5. `review_file`
Review a single file for quality and security compliance.

**Input:**
```json
{
  "file_path": "src/example.ts",
  "content": "var x: any = 5;",
  "language": "typescript"
}
```

## 🏗️ Architecture

### Design Patterns

CodeReviewHQ implements industry-standard design patterns for maintainability and extensibility:

1. **Strategy Pattern**: `BaseReviewer` allows different language-specific implementations
2. **Facade Pattern**: `PRReviewerService` provides simple interface for complex operations
3. **Singleton Pattern**: `ReviewerRegistry` ensures single instance for managing reviewers
4. **Registry Pattern**: Dynamic reviewer registration and retrieval
5. **Dependency Injection**: Services inject registry for flexibility and testability

### Project Structure

```
CodeReviewHQ/
├── src/
│   ├── models/
│   │   └── review.models.ts          # Type definitions and enums
│   ├── services/
│   │   ├── pr-reviewer.service.ts    # Main orchestration service
│   │   ├── github.service.ts         # GitHub API integration
│   │   └── reviewers/
│   │       ├── base.reviewer.ts      # Abstract base class
│   │       ├── registry.ts           # Reviewer registry (singleton)
│   │       ├── typescript.reviewer.ts # TypeScript implementation
│   │       ├── python.reviewer.ts    # Python implementation
│   │       └── universal.reviewer.ts # Fallback reviewer
│   ├── middleware/
│   │   └── security.middleware.ts    # Security, rate limiting, CORS
│   ├── utils/
│   │   └── logger.ts                 # Structured logging
│   ├── tools.ts                      # MCP tool exports
│   └── index.ts                      # Main server entry point
├── tests/
│   └── reviewer.test.ts              # Test suite
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI/CD pipeline
├── .eslintrc.js                      # ESLint configuration
├── .prettierrc                       # Prettier configuration
├── tsconfig.json                     # TypeScript configuration
├── package.json                      # Dependencies and scripts
└── README.md                         # This file
```

## 🔍 Review Categories

### Code Quality
- Readability, naming conventions, modularity
- Language-specific best practices
- DRY, SOLID principles adherence
- Code complexity and maintainability

### Security
- Input validation & sanitization
- Authentication & authorization risks
- Secrets exposure prevention
- OWASP Top 10 vulnerabilities

### Performance
- Time & space complexity analysis
- Unnecessary loops, queries, and operations
- Efficient data structure usage
- Memory leak detection

### Design
- Scalability and extensibility assessment
- Separation of concerns evaluation
- Proper layering and architecture
- Design pattern usage recommendations

## 📊 Risk Levels

- **LOW** (0-30%): No issues or only minor informational issues. Safe to merge.
- **MEDIUM** (31-60%): Multiple minor issues requiring attention before merge.
- **HIGH** (61-85%): Major issues present that should be fixed before merging.
- **CRITICAL** (86-100%): Security vulnerabilities or critical bugs that must be addressed immediately.

## ✅ Review Decisions

- **APPROVED**: Code follows best practices, production-ready, no blocking issues.
- **CHANGES_REQUESTED**: Critical or major issues must be addressed before merge.
- **COMMENT_ONLY**: No changes required, suggestions provided for improvement.

## 🚀 Development

### Available Scripts

```bash
# Development
npm run dev                    # Start development server with hot reload
npm run dev:stdio              # Start stdio development server

# Building
npm run build                  # Build for production
npm run build:stdio            # Build stdio version

# Testing
npm test                       # Run tests
npm run test:coverage          # Run tests with coverage
npm run test:watch             # Run tests in watch mode

# Code Quality
npm run lint                   # Run ESLint
npm run lint:fix               # Fix ESLint issues automatically
npm run format                 # Format code with Prettier
npm run format:check           # Check code formatting
npm run typecheck              # Run TypeScript type check
```

### Adding a New Language Reviewer

To add support for a new language (e.g., Python):

1. Create a new reviewer class extending `BaseReviewer`:

```typescript
import { BaseReviewer } from "./base.reviewer.js";
import { ReviewContext, ReviewComment } from "../../models/review.models.js";

export class PythonReviewer extends BaseReviewer {
    constructor() {
        super("PythonReviewer");
    }

    protected initializePatterns(): void {
        this.languagePatterns.set("python", /\.py$/);
    }

    async review(context: ReviewContext): Promise<ReviewComment[]> {
        const comments: ReviewComment[] = [];
        
        for (const change of context.changes) {
            if (!this.canHandle(change.file_path, change.language)) {
                continue;
            }

            // Add Python-specific checks
            comments.push(...this.analyzePythonCode(change));
        }
        
        return comments;
    }

    private analyzePythonCode(change: { file_path: string; content: string }): ReviewComment[] {
        // Implement Python-specific analysis
        return [];
    }
}
```

2. Register the reviewer in `src/tools.ts`:

```typescript
import { PythonReviewer } from "./services/reviewers/python.reviewer.js";
registry.register(new PythonReviewer());
```

## 🧪 Testing

CodeReviewHQ uses Vitest for testing with comprehensive coverage:

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch
```

### Test Coverage

The project includes comprehensive tests covering:
- TypeScript reviewer checks (7 tests)
- PR reviewer service logic (4 tests)
- Reviewer registry functionality (2 tests)
- Integration tests (planned)
- E2E tests (planned)

## 🔐 Security

CodeReviewHQ implements enterprise-grade security measures:

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Strict size limits and structure validation
- **CORS Protection**: Configurable origin whitelist
- **Security Headers**: Helmet.js for HTTP security
- **Token Validation**: GitHub token format verification
- **Sensitive Data Masking**: Automatic redaction in logs
- **Request Tracing**: Unique request IDs for audit trails

## 📈 Observability

### Logging

Structured logging with contextual information:

```typescript
import { logger } from './utils/logger.js';

logger.info('Review started', { 
    pullNumber: 123, 
    repository: 'owner/repo',
    requestId: 'req_1234567890_abc123'
});

logger.error('Review failed', error);
logger.warn('Rate limit approaching', { remaining: 5 });
```

### Health Checks

- `/health` - Detailed health status with GitHub configuration
- `/ping` - Simple liveness check

## 🐳 Docker Support

```bash
# Build Docker image
docker build -t ai-pr-reviewer .

# Run container
docker run -p 8080:8080 --env-file .env ai-pr-reviewer

# Using Docker Compose
docker-compose up -d
```

## 🌐 Deployment

### MCPize.com (Recommended)

Deploy instantly on [MCPize.com](https://mcpize.com/):

1. Connect your GitHub repository
2. Configure environment variables in MCPize dashboard
3. Deploy with one click
4. Automatic scaling and updates

### Manual Deployment

```bash
# Build
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | Environment (development/production) |
| `GITHUB_TOKEN` | No* | GitHub Personal Access Token |
| `GITHUB_OWNER` | No | Default repository owner |
| `GITHUB_REPO` | No | Default repository name |
| `CORS_ORIGINS` | No | Allowed CORS origins (comma-separated) |

*Can be provided per-request for MCPize deployment

## 📝 Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Workflow

1. Ensure all tests pass: `npm test`
2. Run linting: `npm run lint`
3. Check formatting: `npm run format:check`
4. Update documentation as needed
5. Follow existing code patterns and conventions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Documentation**: [Full Documentation](https://docs.codereviewhq.com)
- **Issues**: [GitHub Issues](https://github.com/utpal21/CodeReviewHQ/issues)
- **Discussions**: [GitHub Discussions](https://github.com/utpal21/CodeReviewHQ/discussions)
- **Email**: support@codereviewhq.com

## 🌟 Star History

If you find CodeReviewHQ useful, please consider giving it a star on GitHub!

## 🙏 Acknowledgments

- Built with [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Powered by [Octokit](https://github.com/octokit/octokit.js)
- Deployed on [MCPize](https://mcpize.com/)

---

**Made with ❤️ by the [Utpal Biswas](https://github.com/utpal21)**

*Automated code reviews for modern development teams*