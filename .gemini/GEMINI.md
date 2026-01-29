# V0 Linear Agent

## Project Overview

A **native Linear coding agent** that uses V0's Platform API to generate UI components directly from Linear issues. Leverages Vercel's native integrations—no custom GitHub PR automation required.

### Key Differentiator

**No external dashboard.** All interaction happens in Linear:
- **Agent Plans** → Visible checklist in Activity Timeline
- **External URLs** → V0 chat + Vercel deployment links
- **Signals** → Repository selection inline
- **Multi-turn** → Iterate via @mentions

---

## V0 Platform API

### Models

| Model | Use Case | Complexity |
|-------|----------|------------|
| **v0 Mini** | Lightning-fast, near-frontier intelligence | L1-L2 |
| **v0 Pro** | Balanced speed/intelligence | L3 |
| **v0 Max** | Maximum intelligence for complex work | L4-L5 |

### Native Integrations

| Feature | API Method | Notes |
|---------|-----------|-------|
| **GitHub import** | `chats.init({type: 'repo', repo: {url}})` | Via Vercel GitHub integration |
| **Vercel deploy** | `deployments.create({projectId, chatId, versionId})` | Direct to Vercel |
| **File extraction** | `chat.files` | Array of generated files |
| **Preview URL** | `chat.demo` | Live preview during generation |
| **Multi-turn** | `chats.sendMessage({chatId, message})` | Continue conversation |

### SDK Usage
```typescript
import { v0 } from 'v0-sdk'  // Uses V0_API_KEY env var

// Create from scratch
const chat = await v0.chats.create({ message: '...', projectId })

// Import from repo
const chat = await v0.chats.init({ type: 'repo', repo: { url: '...' } })

// Deploy to Vercel
const deployment = await v0.deployments.create({ projectId, chatId, versionId })
```

---

## Workflow

1. **User delegates issue** → Linear creates AgentSession
2. **Webhook received** → Agent responds within 10 seconds
3. **Repository detected** → Via `issueRepositorySuggestions` or `select` signal
4. **V0 generates** → Progress via Agent Activities + Plans
5. **Preview available** → V0 chat link in `externalUrls`
6. **User iterates** → @mention agent, V0 continues
7. **Deploy to Vercel** → Deployment URL in `externalUrls`

---

## Environment Variables

```env
V0_API_KEY=                     # Required: from v0.app/chat/settings/keys
LINEAR_ACCESS_TOKEN=            # Required: OAuth token (actor=app)
LINEAR_V0_AGENT_USER_ID=        # Required: Agent user ID
LINEAR_WEBHOOK_SECRET=          # Required: Webhook verification
PORT=3324
```

> [!NOTE]
> No GitHub credentials required—V0 uses Vercel's GitHub integration.

---

## Deployment

Deployed on **rainworth-server** via systemd:
- Service: `v0-linear-agent.service`
- Port: 3324
- Tunnel: Cloudflare tunnel `v0-agent.frasergibbs.com`

---

## Related Documentation

- [Linear Agent Spec](https://linear.app/developers/agents)
- [V0 Platform API](https://v0.app/docs/api/platform)
- [SPEC_COMPLIANCE.md](./SPEC_COMPLIANCE.md)
