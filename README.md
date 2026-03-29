# AI PR Reviewer - MCP Server

An intelligent code review MCP (Model Context Protocol) server that provides comprehensive Pull Request analysis with GitHub integration. Built with TypeScript, it uses design patterns for extensibility and production-ready architecture.

## 🚀 Features

### Core Capabilities
- **Multi-language Support**: Currently supports TypeScript/JavaScript (easily extensible for Python, Java, Go, etc.)
- **Automated Code Review**: Detects code quality issues, security vulnerabilities, and best practices violations
- **GitHub Integration**: Fetch PRs from GitHub, review them, and post comments automatically
- **Batch Processing**: Review multiple PRs simultaneously
- **Decision Making**: Provides APPROVED, CHANGES_REQUESTED, or COMMENT_ONLY decisions
- **Risk Assessment**: Calculates risk levels (LOW, MEDIUM, HIGH, CRITICAL)
- **Confidence Scoring**: Provides a confidence score for each review

### Code Quality Checks
- Console/debug statement detection
- `any` type usage in TypeScript
- `var` usage (encourages const/let)
- TODO/FIXME/HACK comment detection
- Empty catch blocks
- Large function detection (>50 lines)

### Security Checks
- Hardcoded password detection
- API key exposure
- Secret/token pattern matching
- Common security vulnerabilities

## 📋 Prerequisites

- Node.js >= 20.0.0
- GitHub Personal Access Token (for GitHub integration)
  - Generate at: https://github.com/settings/tokens
  - Required scopes: `repo` (for private repos) or `public_repo` (for public repos)

## 🔧 Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## ⚙️ Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```env
# Server configuration
PORT=8080
NODE_ENV=development

# GitHub Configuration (required for GitHub integration)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_OWNER=your-username-or-org
GITHUB_REPO=your-repo-name
```

## 🎯 MCP Tools

The following MCP tools are available:

### 1. `review_pr`
Review provided code changes.

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
  "review_comments": [...],
  "suggested_improvements": [...]
}
```

### 2. `review_single_file`
Review a single file.

**Input:**
```json
{
  "file_path": "src/example.ts",
  "content": "var x: any = 5;",
  "language": "typescript"
}
```

### 3. `fetch_pull_requests`
Fetch pull requests from GitHub.

**Input:**
```json
{
  "owner": "optional-owner",
  "repo": "optional-repo",
  "state": "open",
  "limit": 10
}
```

### 4. `review_github_pr`
Review a specific GitHub PR.

**Input:**
```json
{
  "pull_number": 123,
  "owner": "optional-owner",
  "repo": "optional-repo",
  "post_comment": false
}
```

### 5. `review_multiple_prs`
Batch review multiple GitHub PRs.

**Input:**
```json
{
  "pull_numbers": [123, 124, 125],
  "owner": "optional-owner",
  "repo": "optional-repo",
  "post_comments": false
}
```

### 6. `list_reviewers`
List all available language reviewers.

**Output:**
```json
{
  "reviewers": ["TypeScriptReviewer"]
}
```

### 7. `is_github_configured`
Check if GitHub is properly configured.

**Output:**
```json
{
  "configured": true
}
```

## 🏗️ Architecture

### Design Patterns

1. **Strategy Pattern**: `BaseReviewer` allows different language-specific implementations
2. **Facade Pattern**: `PRReviewerService` provides simple interface for complex operations
3. **Singleton Pattern**: `ReviewerRegistry` ensures single instance for managing reviewers
4. **Dependency Injection**: Services inject registry for flexibility and testability

### Project Structure

```
src/
├── models/
│   └── review.models.ts          # Type definitions
├── services/
│   ├── pr-reviewer.service.ts    # Main orchestration service
│   ├── github.service.ts         # GitHub API integration
│   └── reviewers/
│       ├── base.reviewer.ts       # Abstract base class
│       ├── registry.ts            # Reviewer registry (singleton)
│       └── typescript.reviewer.ts # TypeScript implementation
├── tools.ts                      # MCP tool exports
└── index.ts                      # Main server entry point

tests/
└── reviewer.test.ts               # Test suite
```

## 🔍 Review Categories

### Code Quality
- Readability, naming conventions, modularity
- Language-specific best practices
- DRY, SOLID principles adherence

### Security
- Input validation & sanitization
- Authentication & authorization risks
- Secrets exposure
- OWASP best practices

### Performance
- Time & space complexity
- Unnecessary loops, queries
- Efficient data structures

### Design
- Scalability and extensibility
- Separation of concerns
- Proper layering
- Design pattern usage

## 📊 Risk Levels

- **LOW**: No issues or only minor informational issues
- **MEDIUM**: Multiple minor issues requiring attention
- **HIGH**: Major issues present that should be fixed
- **CRITICAL**: Security vulnerabilities that must be addressed

## ✅ Review Decisions

- **APPROVED**: Code follows best practices, production-ready
- **CHANGES_REQUESTED**: Critical or major issues must be addressed
- **COMMENT_ONLY**: No changes required, suggestions provided

## 🧪 Testing

Run the test suite:

```bash
npm test
```

The project includes 13 comprehensive tests covering:
- TypeScript reviewer checks
- PR reviewer service logic
- Reviewer registry functionality

## 🔌 Extending with New Languages

To add support for a new language (e.g., Python):

1. Create a new reviewer class:

```typescript
import { BaseReviewer } from "./base.reviewer.js";

export class PythonReviewer extends BaseReviewer {
  constructor() {
    super("PythonReviewer");
  }

  protected initializePatterns(): void {
    this.languagePatterns.set("python", /\.py$/);
  }

  async review(context: ReviewContext): Promise<ReviewComment[]> {
    // Implement Python-specific checks
    const comments: ReviewComment[] = [];
    
    // Add your review logic here
    
    return comments;
  }
}
```

2. Register the reviewer in `src/tools.ts`:

```typescript
import { PythonReviewer } from "./services/reviewers/python.reviewer.js";
registry.register(new PythonReviewer());
```

## 🚢 Production Deployment

### Environment Variables
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment (development/production)
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `GITHUB_OWNER`: Default repository owner
- `GITHUB_REPO`: Default repository name

### Running in Production

```bash
# Build
npm run build

# Start production server
NODE_ENV=production npm start
```

### Docker Support

A `Dockerfile` is provided for containerized deployments:

```bash
docker build -t ai-pr-reviewer .
docker run -p 8080:8080 --env-file .env ai-pr-reviewer
```

## 📝 License

[Your License Here]

## 🤝 Contributing

Contributions are welcome! Please ensure:
- All tests pass
- Code follows existing patterns
- New features include tests
- Documentation is updated

## 🐛 Troubleshooting

### GitHub Token Issues
- Ensure token has proper scopes
- Verify token hasn't expired
- Check GITHUB_TOKEN is set in environment

### Build Errors
- Ensure Node.js >= 20.0.0
- Run `npm install` to update dependencies
- Clear cache: `rm -rf node_modules dist && npm install && npm run build`

## 📧 Support

For issues or questions, please open an issue on the repository.