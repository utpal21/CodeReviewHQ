# MCPize Deployment Guide

This guide covers deploying the AI PR Reviewer MCP server to mcpize for use with multiple IDEs.

## 🌐 Transport Modes

The project supports **both** transport modes:

| Transport | Use Case | Entry Point |
|-----------|-----------|--------------|
| **Stdio** | Local development, Antigravity testing | `src/index-stdio.ts` |
| **HTTP** | mcpize hosting, multiple IDEs | `src/index.ts` |

## 🚀 Current State

### Local Testing (Antigravity) ✅
- **Use**: `src/index-stdio.ts`
- **Transport**: Stdio (command-based)
- **Config**: `mcp_config.json`
- **Ready**: Yes, just copy config to Antigravity

### Production Hosting (mcpize) ✅
- **Use**: `src/index.ts`
- **Transport**: HTTP
- **Endpoint**: `http://localhost:8080/mcp`
- **Ready**: Yes, run `npm start` and it's available

## 🔧 Current Capabilities

### HTTP Server (src/index.ts)
✅ Already built with HTTP transport
✅ Includes all 7 tools
✅ Health check endpoint: `/health`
✅ MCP endpoint: `/mcp`
✅ Runs on port 8080 (configurable via PORT env var)

### Stdio Server (src/index-stdio.ts)
✅ Built with stdio transport
✅ Same 7 tools
✅ Reads from stdin, writes to stdout
✅ Perfect for local IDE integration

## 📦 Deployment Options

### Option 1: Run Locally (Current Setup)

```bash
# Start HTTP server
npm start

# Server runs on http://localhost:8080
# Other IDEs can connect via HTTP transport
```

**Pros:**
- Fast for development
- Easy to test changes
- No deployment needed

**Cons:**
- Requires local machine running
- Not accessible by others

### Option 2: Deploy to Cloud Run (Recommended for mcpize)

The code is already Cloud Run ready! 🎉

#### Prerequisites
- Google Cloud account
- `gcloud` CLI installed
- Project created

#### Deployment Steps

1. **Build the project**:
```bash
npm run build
```

2. **Create Docker image**:
```bash
# Dockerfile already exists!
docker build -t gcr.io/your-project-id/ai-pr-reviewer .
```

3. **Push to Google Container Registry**:
```bash
gcloud auth configure-docker
docker push gcr.io/your-project-id/ai-pr-reviewer
```

4. **Deploy to Cloud Run**:
```bash
gcloud run deploy ai-pr-reviewer \
  --image gcr.io/your-project-id/ai-pr-reviewer \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GITHUB_TOKEN=ghp_your_token,GITHUB_OWNER=your_owner,GITHUB_REPO=your_repo"
```

5. **Get the URL**:
```bash
# Cloud Run will provide a URL like:
# https://ai-pr-reviewer-xxxxxx-uc.a.run.app
```

6. **Register on mcpize**:
   - Go to mcpize dashboard
   - Add new MCP server
   - URL: `https://your-cloud-run-url.app/mcp`
   - Transport: HTTP

**Pros:**
- Publicly accessible
- Auto-scaling
- No server management
- Works with all IDEs supporting MCP

**Cons:**
- Requires cloud account
- Small costs (though minimal)

### Option 3: Docker Deployment

```bash
# Build image
docker build -t ai-pr-reviewer .

# Run container
docker run -p 8080:8080 \
  -e GITHUB_TOKEN="ghp_your_token" \
  -e GITHUB_OWNER="your_owner" \
  -e GITHUB_REPO="your_repo" \
  ai-pr-reviewer

# Accessible at http://localhost:8080
```

### Option 4: VPS Deployment

Deploy to any VPS (DigitalOcean, AWS EC2, etc.):

```bash
# SSH into server
ssh user@your-server.com

# Clone repo
git clone https://github.com/your-username/ai-pr-reviewer.git
cd ai-pr-reviewer

# Install dependencies
npm install

# Build
npm run build

# Run with PM2 (for process management)
npm install -g pm2
pm2 start dist/index.js --name ai-pr-reviewer

# Configure nginx reverse proxy (optional)
# Point domain to server:8080
```

## 🔌 IDE Integration

Once deployed (HTTP mode), the server works with:

### Claude Desktop (Anthropic)
```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "url": "https://your-mcpize-url.com/mcp",
      "transport": "http"
    }
  }
}
```

### Cursor AI
Add via MCP settings using the HTTP URL.

### Windsurf
Configure MCP server with HTTP transport.

### Continue.dev
Add MCP server configuration with URL.

### Cline (You're here!)
Already integrated locally, can use remote version.

## 🌍 mcpize Integration

### What is mcpize?
- Central marketplace for MCP servers
- Easy discovery and installation
- Supports multiple IDEs

### ⚠️ Important: Header Configuration for GitHub Authentication

When deploying to mcpize, you need to configure **Custom Headers** instead of Environment Variables for GitHub credentials. The server automatically extracts these headers from incoming requests.

#### Configuring Custom Headers in mcpize

1. Go to your server's **Settings** in mcpize
2. Navigate to **Custom Headers Configuration**
3. Add the following required headers:

| Header Name | Description | Example Value | Required |
|-------------|-------------|---------------|----------|
| `GITHUB_TOKEN` | Your GitHub personal access token | `ghp_abc123xyz...` | Yes |
| `GITHUB_OWNER` | GitHub repository owner/organization | `utpal21` | Yes |
| `GITHUB_REPO` | GitHub repository name | `CodeReviewHQ` | Yes |

#### How It Works

The server middleware (`src/index.ts`) automatically:
1. Extracts these headers from every incoming MCP request
2. Sets them as environment variables (`process.env.GITHUB_TOKEN`, etc.)
3. Makes them available to the GitHub service

**Note**: Users installing your server from mcpize will be prompted to provide these headers during installation.

#### Why Headers Instead of Environment Variables?

- **User-specific credentials**: Each user needs their own GitHub token
- **Multi-tenancy**: Multiple users can connect to the same server instance
- **Security**: Tokens are passed per-request, not stored on the server
- **Flexibility**: Users can switch repositories without redeployment

### Publishing Steps

1. **Deploy your server** (Cloud Run, VPS, mcpize hosting, etc.)
2. **Get public URL**: `https://your-server.com/mcp`
3. **Configure Custom Headers** in mcpize (see above)
4. **Register on mcpize**:
   ```json
   {
     "name": "ai-pr-reviewer",
     "description": "Intelligent code review with GitHub integration",
     "version": "1.0.0",
     "author": "Your Name",
     "homepage": "https://github.com/your-username/ai-pr-reviewer",
     "transport": "http",
     "endpoints": {
       "mcp": "https://your-server.com/mcp",
       "health": "https://your-server.com/health"
     },
     "tools": [
       "review_file",
       "review_pr",
       "list_reviewers",
       "is_github_configured",
       "fetch_pull_requests",
       "review_github_pr",
       "review_multiple_prs"
     ],
     "tags": ["code-review", "github", "typescript", "security", "best-practices"],
     "icon": "https://your-server.com/icon.png"
   }
   ```

4. **Submit** to mcpize for review

## 🔒 Security Considerations

### GitHub Token Management

**For Public Deployment**:
```bash
# Use Secret Manager (Cloud Run)
gcloud secrets create github-token --data-file=token.txt
gcloud secrets add-iam-policy-binding github-token \
  --member="serviceAccount:your-service-account@project-id.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Access in code
const token = await fetchSecret('github-token');
```

**Environment Variables**:
- Never commit `.env` files
- Use secret managers in production
- Rotate tokens regularly
- Use minimal scopes

### Authentication

Consider adding API key authentication:
```typescript
const API_KEY = process.env.MCP_API_KEY;

app.post("/mcp", (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // ... rest of MCP handling
});
```

## � Architecture Comparison

### Local Stdio (Antigravity)
```
User → Antigravity → MCP Server (stdio) → AI Response
```

### Local HTTP (Development)
```
User → IDE → HTTP Server (localhost:8080) → AI Response
```

### Cloud HTTP (Production/mcpize)
```
User → Any IDE → Cloud Server (https://...) → AI Response
```

## 🎯 Recommended Workflow

### Phase 1: Local Testing (Now)
- ✅ Use stdio version with Antigravity
- ✅ Test all features
- ✅ Refine review logic
- ✅ Fix bugs

### Phase 2: Local HTTP Testing
```bash
npm start
# Test with HTTP transport in other IDEs
```

### Phase 3: Cloud Deployment
- Deploy to Cloud Run or VPS
- Test from multiple locations
- Verify latency and reliability

### Phase 4: mcpize Publishing
- Register on mcpize
- Gather feedback
- Iterate based on usage

## 🚀 Quick Start Cloud Run Deployment

```bash
# 1. Set project
gcloud config set project your-project-id

# 2. Build Docker image
docker build -t gcr.io/your-project-id/ai-pr-reviewer .

# 3. Push image
docker push gcr.io/your-project-id/ai-pr-reviewer

# 4. Deploy
gcloud run deploy ai-pr-reviewer \
  --image gcr.io/your-project-id/ai-pr-reviewer \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated

# 5. Get URL
# Cloud Run will display your URL
```

That's it! Your MCP server is now accessible worldwide via mcpize! 🌍

## 📝 Example IDE Configurations

### Claude Desktop
```json
{
  "mcpServers": {
    "ai-pr-reviewer": {
      "url": "https://ai-pr-reviewer-xxxxx.run.app/mcp",
      "transport": "http"
    }
  }
}
```

### Cursor
```
Settings → MCP → Add Server
Name: ai-pr-reviewer
URL: https://ai-pr-reviewer-xxxxx.run.app/mcp
```

### Windsurf
```
Tools → MCP → New Server
Transport: HTTP
URL: https://ai-pr-reviewer-xxxxx.run.app/mcp
```

---

**Ready to deploy?** Start with Cloud Run - it's the easiest! ☁️