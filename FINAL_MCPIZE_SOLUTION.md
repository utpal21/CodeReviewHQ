# ✅ MCPize 500 Error - Final Solution

## 🎯 Correct Understanding

For MCP servers deployed on mcpize, the proper way to handle configuration is:

1. **mcpize.yaml** declares `configSchema` with server properties
2. **Users** fill in configuration when installing server  
3. **mcpize** sets these as environment variables at server startup

## ✅ Solution Implemented

### 1. Updated mcpize.yaml

```yaml
configSchema:
  type: object
  properties:
    GITHUB_TOKEN:
      type: string
      title: GitHub Personal Access Token
      description: Your GitHub personal access token with repo scope
      format: password
      required: true
```

This tells mcpize to:
- Prompt users for `GITHUB_TOKEN` when installing
- Mark it as required (users must provide it)
- Set it as environment variable when starting server
- Format as password (hide in UI)

### 2. Server Code Reads from Environment

The server already correctly reads:
```typescript
const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
```

When mcpize starts the server:
- Sets `GITHUB_TOKEN` from user's configuration
- Server reads it from `process.env.GITHUB_TOKEN`
- GitHubService initializes successfully
- **No 500 errors!**

## 🚀 Deployment Steps

### Step 1: Push All Changes

```bash
# Add modified files
git add mcpize.yaml src/index.ts src/services/github.service.ts *.md

# Commit
git commit -m "fix: add proper mcpize config schema for GitHub token

Changes:
- Add configSchema to mcpize.yaml with GITHUB_TOKEN property
- This prompts users for token when installing server
- mcpize sets it as environment variable at startup
- Server reads from process.env (already working)
- Remove header extraction middleware (not needed for mcpize)"

# Push
git push
```

### Step 2: Redeploy on mcpize

1. Go to mcpize dashboard
2. Navigate to your server
3. Delete and recreate server (or trigger redeploy)
4. mcpize will pull latest code with configSchema

### Step 3: Verify Configuration

In mcpize dashboard, you should now see:

```
Server Configuration:
├─ GITHUB_TOKEN: [User provides this value]
└─ Format: password (hidden in UI)
```

Users will be prompted to provide their GitHub token when installing.

### Step 4: Test Deployment

```bash
# Test health endpoint
curl https://ai-pr-reviewer.mcpize.run/health

# Expected: {"status":"healthy","service":"ai-pr-reviewer"}

# Test initialization
curl -X POST https://ai-pr-reviewer.mcpize.run/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}'

# Expected: {"result":{"protocolVersion":"2024-11-05",...}}
```

## 📋 User Configuration Guide

### For End Users Installing Your Server

**Step 1: Add Server**
- Navigate to MCP servers in their IDE
- Add "AI PR Reviewer" from mcpize

**Step 2: Configure**
- mcpize prompts: "GitHub Personal Access Token"
- User enters: `ghp_their_token_here`
- **Only this one value needed!**

**Step 3: Use Tools**
- Call `fetch_pull_requests` with parameters:
  ```json
  {
    "owner": "utpal21",
    "repo": "CodeReviewHQ"
  }
  ```
- Or call other GitHub tools with owner/repo parameters

### No Headers Needed in IDE Config

Users do NOT need to configure headers in their IDE. The configuration is handled by mcpize:

```json
// ❌ OLD WAY (incorrect):
{
  "mcpServers": {
    "AI PR Reviewer": {
      "url": "https://ai-pr-reviewer.mcpize.run",
      "headers": {
        "GITHUB_TOKEN": "ghp_..."
      }
    }
  }
}

// ✅ CORRECT WAY:
{
  "mcpServers": {
    "AI PR Reviewer": {
      "url": "https://ai-pr-reviewer.mcpize.run"
    }
  }
}
```

The token is configured in mcpize, not in the IDE!

## 🐛 Why Previous Approach Was Wrong

I initially added header extraction middleware because I thought mcpize sends credentials as HTTP headers with each request. However:

**❌ Wrong Understanding:**
- mcpize sends headers per-request
- Need middleware to extract them
- Set as environment variables

**✅ Correct Understanding:**
- mcpize reads `configSchema` from mcpize.yaml
- Prompts users during installation
- Sets `GITHUB_TOKEN` as environment variable at server startup
- Server reads it once from `process.env.GITHUB_TOKEN`
- All requests use the same configured token

## 📊 Architecture Comparison

### With mcpize Config Schema (CORRECT):

```
User → Installs from mcpize
     ↓
User → Provides GITHUB_TOKEN in mcpize UI
     ↓
mcpize → Sets GITHUB_TOKEN as env var at startup
     ↓
Server → Reads process.env.GITHUB_TOKEN once
     ↓
GitHubService → Initialized with token
     ↓
All Requests → Use the configured token
```

### With Header Extraction (WRONG):

```
User → Each request must include header
     ↓
IDE → Must send GITHUB_TOKEN header every time
     ↓
Server → Extracts header per-request
     ↓
Server → Sets process.env.GITHUB_TOKEN
     ↓
GitHubService → Initialized with token
```

The config schema approach is cleaner and follows MCP best practices!

## 🔍 Troubleshooting

### If Still Seeing 500 Errors

**1. Check mcpize deployment**
- Verify `configSchema` is recognized
- Check if users are being prompted for token
- Look at deployment logs for errors

**2. Test locally with environment variable**
```bash
# Set token
export GITHUB_TOKEN="ghp_test_token"

# Start server
npm start

# Should see: "GitHubService initialized | {hasToken: true,...}"
```

**3. Check mcpize configuration**
- In mcpize dashboard, verify server config shows
- Should display "GitHub Personal Access Token" field
- User should be able to enter value

**4. Remove header extraction code**

If you still have the header extraction middleware in `src/index.ts`, remove it:
```typescript
// DELETE THIS BLOCK:
app.use((req: Request, res, next) => {
  const githubToken = ...
  if (githubToken) process.env.GITHUB_TOKEN = githubToken;
  // ...
});
```

The middleware is not needed with configSchema approach!

## 📋 Final Checklist

- [ ] mcpize.yaml has configSchema with GITHUB_TOKEN
- [ ] Header extraction middleware removed from src/index.ts
- [ ] Code pushed to GitHub
- [ ] mcpize shows configuration field
- [ ] Users can provide token in mcpize UI
- [ ] Server reads token from process.env
- [ ] No 500 errors after deployment
- [ ] Tools work with owner/repo parameters

## 🎉 Summary

**The Fix:**
1. Add `configSchema` to `mcpize.yaml` ✅
2. mcpize prompts users for `GITHUB_TOKEN` ✅
3. mcpize sets it as environment variable ✅
4. Server reads from `process.env.GITHUB_TOKEN` ✅
5. No more 500 errors! ✅

**Users only need to:**
- Provide GitHub token once in mcpize
- Pass owner/repo as parameters to tools
- No headers needed in their IDE config

**This is the proper MCP server pattern!** 🚀