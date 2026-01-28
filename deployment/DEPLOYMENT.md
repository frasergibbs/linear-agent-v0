# Production Deployment Guide

## Overview

This guide covers deploying the V0 Linear Agent to `rainworth-server` with Cloudflare Tunnel, systemd service, and OAuth installation.

---

## Prerequisites

- ✅ SSH access to `rainworth-server` via Tailscale
- ✅ Cloudflare account with `fraserandsam.com` domain
- ✅ Node.js 18+ installed on rainworth-server
- ✅ Linear workspace admin access

---

## Step 1: Configure Cloudflare Tunnel

### 1.1 Get Existing Tunnel ID

```bash
ssh fraser@rainworth-server
cloudflared tunnel list
```

Copy the tunnel ID (should already exist for other services).

### 1.2 Update Tunnel Configuration

Edit the Cloudflare tunnel config:

```bash
sudo nano /etc/cloudflared/config.yml
```

Add the linear-agent ingress rule:

```yaml
ingress:
  # Existing services...
  
  - hostname: linear-agent.fraserandsam.com
    service: http://localhost:3324
  
  # Must be last
  - service: http_status:404
```

### 1.3 Add DNS Record

```bash
cloudflared tunnel route dns <TUNNEL_ID> linear-agent.fraserandsam.com
```

Or add manually in Cloudflare dashboard:
- Type: `CNAME`
- Name: `linear-agent`
- Content: `<TUNNEL_ID>.cfargotunnel.com`
- Proxy: ✅ Enabled

### 1.4 Restart Tunnel

```bash
sudo systemctl restart cloudflared
```

**Verify:** Visit `https://linear-agent.fraserandsam.com/health` (should return 502 until service is deployed)

---

## Step 2: Create Linear OAuth Application

**Linear → Settings → API → Applications → [Create new](https://linear.app/settings/api/applications/new)**

### Configuration:

- **Name**: `V0 UI Agent`
- **Description**: `Autonomous UI component generator using V0 Platform API`
- **Icon**: Upload V0/AI icon
- **Callback URL**: `https://linear-agent.fraserandsam.com/auth/callback`
- **Webhook URL**: `https://linear-agent.fraserandsam.com/webhook/linear`
- **Enable webhooks**: ✅ Yes
- **Webhook events**:
  - ✅ Agent session events
  - ✅ Issue events
  - ✅ Comment events
  - ✅ Inbox notifications (optional)

### Save These Values:

- Client ID → `LINEAR_CLIENT_ID`
- Client Secret → `LINEAR_CLIENT_SECRET`
- Webhook signing secret → `LINEAR_WEBHOOK_SECRET`

---

## Step 3: Deploy to rainworth-server

### 3.1 Run Deployment Script

From your local machine:

```bash
cd /Users/frasergibbs/Repos/linear-agent-v0
./deployment/deploy.sh
```

This will:
1. Create `/home/fraser/services/linear-agent-v0/`
2. Copy application files via rsync
3. Install production dependencies
4. Set up systemd service
5. Start the service

### 3.2 Configure Environment Variables

SSH to rainworth-server and create `.env`:

```bash
ssh fraser@rainworth-server
cd /home/fraser/services/linear-agent-v0
nano .env
```

Add the following (use values from Step 2):

```bash
# Linear OAuth
LINEAR_CLIENT_ID=<from Linear OAuth app>
LINEAR_CLIENT_SECRET=<from Linear OAuth app>
LINEAR_WEBHOOK_SECRET=<from Linear OAuth app>
LINEAR_ACCESS_TOKEN=<leave empty for now>
LINEAR_V0_AGENT_USER_ID=<leave empty for now>

# V0 Platform API
V0_API_KEY=<your V0 API key>

# GitHub
GITHUB_TOKEN=<your GitHub PAT>

# Server
PORT=3324
NODE_ENV=production
BASE_URL=https://linear-agent.fraserandsam.com
```

### 3.3 Restart Service

```bash
sudo systemctl restart linear-agent-v0
```

### 3.4 Verify Service

```bash
# Check status
sudo systemctl status linear-agent-v0

# View logs
sudo journalctl -u linear-agent-v0 -f
```

**Expected output:**
```
🚀 V0 Linear Agent listening on port 3324
📡 Webhook endpoint: http://localhost:3324/webhook/linear
🔐 OAuth install: http://localhost:3324/auth/install
❤️  Health check: http://localhost:3324/health
```

---

## Step 4: Install Agent in Linear Workspace

### 4.1 Initiate OAuth Flow

Visit: `https://linear-agent.fraserandsam.com/auth/install`

### 4.2 Authorize in Linear

- Linear will ask for workspace admin approval
- Review scopes (read, write, issues, comments, delegate)
- Click **Authorize**

### 4.3 Copy Installation Credentials

After authorization, you'll see:

```
LINEAR_ACCESS_TOKEN=lin_api_...
LINEAR_V0_AGENT_USER_ID=...
```

### 4.4 Update .env on Server

```bash
ssh fraser@rainworth-server
cd /home/fraser/services/linear-agent-v0
nano .env
```

Add the access token and agent user ID, then restart:

```bash
sudo systemctl restart linear-agent-v0
```

---

## Step 5: Test the Integration

### 5.1 Create Test Issue

**Linear → Sisyphus team → New issue**

- **Title**: `Test: V0 Dashboard Component`
- **Description**: 
  ```
  Create a responsive dashboard with:
  - KPI cards
  - Dark mode support
  - shadcn/ui components
  ```
- **Labels**: `frontend`, `ui`
- **Assign to**: `V0 UI Agent` ← This triggers webhook

### 5.2 Monitor Logs

```bash
ssh fraser@rainworth-server
sudo journalctl -u linear-agent-v0 -f
```

**Expected:**
1. Webhook received: `Issue.update`
2. V0 session created
3. Comment posted with demo URL

### 5.3 Verify in Linear

Check the issue - V0 should have commented with:
- ✅ V0 demo link
- ✅ Session status

---

## Troubleshooting

### Service won't start

```bash
# Check logs
sudo journalctl -u linear-agent-v0 -n 50 --no-pager

# Common issues:
# - Missing .env file
# - Invalid LINEAR_ACCESS_TOKEN
# - Port 3324 already in use
```

### Webhook not received

```bash
# Test webhook endpoint
curl https://linear-agent.fraserandsam.com/health

# Check Linear webhook logs
# Linear → Settings → API → Webhooks → View logs
```

### OAuth installation fails

- Verify `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` are correct
- Check callback URL matches exactly: `https://linear-agent.fraserandsam.com/auth/callback`
- Ensure tunnel is routing correctly

---

## Maintenance

### View Logs

```bash
# Real-time
sudo journalctl -u linear-agent-v0 -f

# Last 100 lines
sudo journalctl -u linear-agent-v0 -n 100
```

### Restart Service

```bash
sudo systemctl restart linear-agent-v0
```

### Update Code

```bash
# From local machine
cd /Users/frasergibbs/Repos/linear-agent-v0
git pull origin main
./deployment/deploy.sh
```

### Check Status

```bash
sudo systemctl status linear-agent-v0
```

---

## Security Notes

- ✅ Webhook signatures verified via HMAC-SHA256
- ✅ OAuth flow uses CSRF state parameter
- ✅ All traffic over HTTPS via Cloudflare Tunnel
- ✅ Secrets stored in `.env`, not committed to git
- ✅ Service runs as `fraser` user (non-root)
