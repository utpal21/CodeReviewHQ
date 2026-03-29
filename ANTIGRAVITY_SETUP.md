# Antigravity Setup Guide

This guide shows how to add the AI PR Reviewer MCP server to Antigravity.

## 📋 Prerequisites

1. ✅ The project is built (`npm run build:stdio`)
2. ✅ `dist/index-stdio.js` exists
3. ✅ GitHub token ready (optional, for GitHub features)

## 🚀 Setup Steps

### Step 1: Copy Configuration

You have two options:

#### Option A: Copy to Antigravity's Config Location

```bash
# Copy the config to Antigravity's MCP config location
cp mcp_config.json ~/.gemini/antigravity/mcp_config.json
```

#### Option B: Merge with Existing Config

If you already have other MCP servers configured:

1. Open `~/.gemini/antigravity/mcp_config.json`
2. Add the `ai-pr-reviewer` server to the `mcpServers` object
3. Save the file

### Step 2: Update GitHub Credentials (Optional)

Edit the config file to add your GitHub credentials:

```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": [
        "dist/index-stdio.js"
      ],
      "cwd": "/Users/utpal/Projects/SmartEnergySolution/CodeReviewHQ/ai-pr-reviewer",
      "env": {
        "GITHUB_TOKEN": "ghp_your_actual_github_token_here",
        "GITHUB_OWNER": "your-username",
        "GITHUB_REPO": "your-repo",
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Important Notes:**
- Replace `ghp_your_actual_github_token_here` with your real GitHub token
- `GITHUB_OWNER` and `GITHUB_REPO` are optional - you can pass them per-request
- If you don't have a GitHub token yet, you can still use non-GitHub tools

### Step 3: Restart Antigravity

1. Completely quit Antigravity (Cmd+Q on macOS)
2. Reopen Antigravity
3. The server should be detected automatically

## 🧪 Testing

### Test 1: Check Configuration

In Antigravity, ask the AI:

```
"Check if GitHub is configured"
```

It should use the `is_github_configured` tool and return:
```json
{
  "configured": true
}
```

### Test 2: List Available Reviewers

```
"List all available reviewers"
```

Returns:
```json
{
  "reviewers": ["TypeScriptReviewer"]
}
```

### Test 3: Review a Single File

```
"Review this TypeScript code:

function test() {
  var x: any = 5;
  console.log('debug');
  const password = 'secret123';
}"
```

### Test 4: Review Multiple Files

```
"Review these files:

File 1: src/utils.ts
function helper() {
  console.log('helper called');
}

File 2: src/api.ts
const apiKey = 'sk-12345';
```

### Test 5: GitHub Integration (With Token Configured)

```
"Fetch the latest 5 open pull requests from GitHub"
```

```
"Review GitHub pull request #123"
```

```
"Review PRs #123, #124, and #125"
```

## 📊 Available Tools

| Tool | Description | GitHub Required |
|------|-------------|-----------------|
| `review_file` | Review a single file | ❌ |
| `review_pr` | Review multiple files | ❌ |
| `list_reviewers` | List available reviewers | ❌ |
| `is_github_configured` | Check GitHub setup | ❌ |
| `fetch_pull_requests` | Fetch PRs from GitHub | ✅ |
| `review_github_pr` | Review a specific PR | ✅ |
| `review_multiple_prs` | Batch review PRs | ✅ |

## 🔧 Troubleshooting

### Issue: Server not detected

**Solution:**
1. Check the path in `cwd` is correct
2. Ensure `dist/index-stdio.js` exists
3. Restart Antigravity completely
4. Check Antigravity logs for errors

### Issue: "command not found: node"

**Solution:**
```bash
# Check node location
which node

# If not in PATH, use full path in config:
"command": "/usr/local/bin/node"
```

### Issue: GitHub tools fail

**Solution:**
1. Check `GITHUB_TOKEN` is set correctly
2. Ensure token has proper scopes (`repo` for private, `public_repo` for public)
3. Run `is_github_configured` to verify

### Issue: Module not found errors

**Solution:**
```bash
# Rebuild the project
npm run build:stdio

# Or reinstall dependencies
rm -rf node_modules
npm install
npm run build:stdio
```

## 📝 Example Config for Different Scenarios

### Minimal Config (No GitHub)

```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": ["dist/index-stdio.js"],
      "cwd": "/Users/utpal/Projects/SmartEnergySolution/CodeReviewHQ/ai-pr-reviewer",
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

### Production Config

```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": ["dist/index-stdio.js"],
      "cwd": "/Users/utpal/Projects/SmartEnergySolution/CodeReviewHQ/ai-pr-reviewer",
      "env": {
        "GITHUB_TOKEN": "ghp_production_token",
        "GITHUB_OWNER": "production-org",
        "GITHUB_REPO": "production-repo",
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Development Config with Multiple Repos

```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "command": "node",
      "args": ["dist/index-stdio.js"],
      "cwd": "/Users/utpal/Projects/SmartEnergySolution/CodeReviewHQ/ai-pr-reviewer",
      "env": {
        "GITHUB_TOKEN": "ghp_dev_token",
        "NODE_ENV": "development"
      }
    }
  }
}
```

Then specify owner/repo per-request:
```
"Fetch PRs from owner 'facebook' and repo 'react'"
```

## 🎯 Next Steps

1. **Customize Review Rules**: Add new language reviewers in `src/services/reviewers/`
2. **Adjust Scoring**: Modify risk thresholds in `src/services/pr-reviewer.service.ts`
3. **Add More Checks**: Extend patterns in `src/services/reviewers/typescript.reviewer.ts`
4. **Deploy**: Use Docker for production deployment

## 📚 Additional Resources

- [Project README](./README.md)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Antigravity Documentation](https://docs.antigravity.dev)

---

**Need Help?** Check the logs or open an issue on the repository!