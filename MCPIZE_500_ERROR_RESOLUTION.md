# 🔧 MCPize 500 Error - Complete Resolution Guide

## 🎯 Current Situation

### ✅ What's Working Locally
- Header extraction: ✅ Working
- GitHub token reception: ✅ Working  
- Server startup: ✅ Working
- Tool calls with parameters: ✅ Working

### ❌ What's Failing on mcpize
- Deployment still returns 500 errors

## 🔍 Root Cause Analysis

The 500 error is occurring because **the code deployed on mcpize is the OLD version** without the header extraction fix.

### Evidence
1. **Local test results:**
```
Headers received | {"hasToken":true,"hasOwner":false,"hasRepo":false,"allGitHubHeaders":["github_token"]}
```
   ✅ Headers ARE being extracted correctly

2. **Your mcpize error:** "SSE error: Non-200 status code (500)"
   ❌ Old deployed code crashes when it can't find GITHUB_TOKEN

## 🚀 Resolution Steps

### Step 1: Push Latest Code

```bash
# Check git status
git status

# Add all modified files
git add src/index.ts src/services/github.service.ts

# Commit with clear message
git commit -m "fix: extract GitHub credentials from headers for mcpize

This fixes 500 errors by:
- Adding middleware to extract GITHUB_TOKEN from HTTP headers
- Setting headers as temporary environment variables
- Supporting multiple header formats (case-insensitive)
- Adding comprehensive logging for debugging"

# Push to GitHub
git push
```

### Step 2: Verify Push Succeeded

```bash
# Check remote branches
git branch -r

# Verify latest commit
git log -1 --oneline
```

### Step 3: Trigger mcpize Redeploy

**Option A: Automatic Redeploy**
- Go to mcpize dashboard
- Navigate to your server settings
- Look for "Redeploy" or "Sync" button
- Click it to pull latest code

**Option B: Manual Redeploy**
1. Delete the current deployment in mcpize
2. Re-add the server with same URL/URL
3. This forces a fresh deployment

**Option C: Check Build Settings**
- In mcpize, check "Build Command" or "Start Command"
- Ensure it's: `npm start` or `node dist/index.js`
- Verify port is correct (8080)

### Step 4: Verify Deployment

**Check health endpoint:**
```bash
curl https://ai-pr-reviewer.mcpize.run/health
```

Expected response:
```json
{"status":"healthy","service":"ai-pr-reviewer"}
```

**Test MCP connection:**
```bash
curl -X POST https://ai-pr-reviewer.mcpize.run/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "GITHUB_TOKEN: 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" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}'
```

Expected response:
```json
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"ai-pr-reviewer","version":"1.1.0"},"jsonrpc":"2.0","id":1}
```

### Step 5: Test in Cline/Antigravity

1. **Delete old server connection**
   - Go to MCP server settings
   - Remove "AI PR Reviewer" server

2. **Add server again**
   - URL: `https://ai-pr-reviewer.mcpize.run`
   - Headers: `{"GITHUB_TOKEN": "ghp_your_token"}`
   - **Important:** Only GITHUB_TOKEN needed!

3. **Test a tool call**
   - Call `fetch_pull_requests`
   - Pass owner/repo as parameters:
     ```json
     {
       "owner": "utpal21",
       "repo": "CodeReviewHQ"
     }
     ```

## 🐛 Troubleshooting

### If Still Seeing 500 Errors After Redeploy

**1. Check mcpize deployment logs**
   - Look for error messages in mcpize dashboard
   - Check if build failed
   - Verify start command is correct

**2. Check if mcpize is caching**
   - Sometimes platforms cache old deployments
   - Try: Delete and recreate the server
   - Wait 2-3 minutes for propagation

**3. Verify port configuration**
   - mcpize might use different port
   - Check mcpize's URL mapping
   - Ensure server is accessible on `/mcp` endpoint

**4. Test with curl directly**
   ```bash
   curl -v https://ai-pr-reviewer.mcpize.run/mcp \
     -H "Content-Type: application/json" \
     -H "GITHUB_TOKEN: test" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```
   Look for specific error in verbose output

### Common mcpize Issues

**Issue:** "Build failed"
- **Fix:** Check `npm run build` works locally
- **Fix:** Verify `package.json` has correct scripts
- **Fix:** Ensure all dependencies are in `package.json`

**Issue:** "Server not responding"
- **Fix:** Check server listens on correct port
- **Fix:** Verify health endpoint works
- **Fix:** Check firewall/security group settings

**Issue:** "500 Internal Server Error"
- **Fix:** Check mcpize logs for stack trace
- **Fix:** Ensure environment variables aren't required
- **Fix:** Verify no hardcoded values in code

## 📋 Verification Checklist

Before reporting success, verify:

- [ ] Code pushed to GitHub
- [ ] mcpize shows latest commit hash
- [ ] Redeploy completed successfully
- [ ] Health endpoint returns 200
- [ ] Initialize request works
- [ ] Tool call with parameters works
- [ ] No 500 errors in Cline/Antigravity
- [ ] Headers logged in mcpize logs

## 📞 Getting Help

If issues persist after following this guide:

1. **Share mcpize deployment logs**
   - Copy error messages from dashboard
   - Share build output
   - Include runtime logs

2. **Share test results**
   ```bash
   # Test and share output
   curl -v https://ai-pr-reviewer.mcpize.run/health
   curl -v https://ai-pr-reviewer.mcpize.run/mcp \
     -H "GITHUB_TOKEN: test" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
   ```

3. **Verify configuration**
   - Share mcpize Custom Headers configuration
   - Share URL being used
   - Share Cline/Antigravity config

## 🎉 Expected Final Result

After successful deployment:

```
✅ Health check: 200 OK
✅ Initialize: Returns server info
✅ Tool calls: Work with parameters
✅ Headers logged: Shows "github_token"
✅ No 500 errors
✅ Multi-tenant: Each user with their own token
```

## 📚 Related Files

- `src/index.ts` - Contains header extraction middleware
- `src/services/github.service.ts` - GitHub API service
- `FINAL_DEPLOYMENT_GUIDE.md` - Quick reference
- `MCPIZE_DEPLOYMENT.md` - Full deployment guide

---

**Key Point:** The fix IS working locally. The issue is that mcpize needs to pull the latest code with the fix. Follow the steps above to redeploy and the 500 errors will disappear.