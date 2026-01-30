# V0 Linear Agent — Comprehensive Feature Summary

## Overview

The **V0 Linear Agent** is a native Linear coding agent that uses V0's Platform API to generate UI components directly from Linear issues. It's designed for **L1-L4 complexity frontend tasks** (UI component generation, styling, responsive layouts).

**Key Differentiator**: No external dashboard — all interaction happens in Linear via the native Agent Sessions API.

---

## Core Capabilities

### 1. Automatic Issue Delegation
- Assign an issue to the V0 agent user in Linear
- Agent automatically picks up the issue via `AgentSessionEvent.created` webhook
- **10-second response guarantee**: First acknowledgement activity emits within 10 seconds (spec-compliant)

### 2. Model Tier Selection
Automatic model selection based on issue complexity labels:

| Label Pattern | Model | Use Case |
|---------------|-------|----------|
| `complexity:1`, `L1`, `complexity:2`, `L2` | **v0 Mini** | Lightning-fast, simple components |
| `complexity:3`, `L3` | **v0 Pro** *(default)* | Balanced speed/intelligence |
| `complexity:4`, `L4`, `complexity:5`, `L5` | **v0 Max** | Maximum intelligence + thinking mode |

### 3. Repository Context Import
- **Auto-detection**: Extracts repo from `issueRepositorySuggestions`, GitHub URLs in description, or branch references
- **Interactive selection**: If multiple repos detected, prompts user via Linear `select` signal
- **V0 init from repo**: `chats.init({ type: 'repo', repo: { url } })` for full codebase context

### 4. Agent Plans (Native Checklist UX)
Visual progress tracking in Linear's Activity Timeline:
```
✅ Analyze issue requirements
🔄 Import repository context
⬜ Generate UI components with V0
⬜ Review generated code
⬜ Deploy preview to Vercel
```
Steps update in real-time as work progresses.

### 5. Agent Activities (Real-time Updates)
Streaming progress via Linear's Activity API:
- `thought` — "Analyzing UI requirements..."
- `action` — "Applying your feedback..."
- `message` — Completion messages with links
- `error` — Error reporting with context
- `elicitation` — Interactive signals (repo selection)

### 6. External URLs
Prominent links displayed in Linear UI:
- **V0 Chat**: Direct link to generated code in v0.dev
- **Vercel Deployment**: Live preview URL after deployment

---

## Multi-Turn Refinement

### @Mention Commands
Iterate on generated UI via Linear mentions:

| Command | Action |
|---------|--------|
| `@v0 <feedback>` | Send refinement feedback to V0 |
| `@v0 deploy` | Deploy current version to Vercel |

### Conversation Persistence
- Session state stored for multi-turn conversations
- V0 chat history maintained across refinements
- Deploy latest version at any point

---

## Deployment Pipeline

### 1. Direct Vercel Deployment
```typescript
v0.deployments.create({ projectId, chatId, versionId })
```
- Native Vercel integration (no custom GitHub PR automation needed)
- Deployment URL added to `externalUrls` for visibility

### 2. V0 Project Management
- Automatic project creation/reuse: `linear-<ISSUE-IDENTIFIER>`
- Links to existing Vercel projects if connected

---

## Technical Integration

### Linear Agent API Compliance
- **OAuth 2.0** with `actor=app` (workspace-level identity)
- **HMAC-SHA256** webhook signature verification
- **AgentSession lifecycle**: `pending → active → awaitingInput → complete`

### Supported Webhook Events
| Event | Trigger |
|-------|---------|
| `AgentSessionEvent.created` | Issue delegated to agent |
| `AgentSessionEvent.prompted` | User @mentions agent |

### Tech Stack Generated
All V0-generated components follow:
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Language**: TypeScript (strict)
- **Icons**: Lucide React

---

## Prompt Enrichment

The agent auto-enriches prompts based on issue labels:

| Label | Enhancement |
|-------|-------------|
| `dark`, `theme` | Dark mode with Tailwind's `dark:` variants |
| `responsive`, `mobile` | Mobile-first with breakpoints |
| `a11y`, `accessibility` | WCAG 2.1 AA compliance |
| `shadcn`, `ui` | shadcn/ui component library |

---

## Assignment Workflow

### How to Delegate to V0 Agent

1. **Create a Linear issue** with UI requirements in the description
2. **Add labels**: `executor:v0`, `ui`, and optionally `complexity:N` (1-4)
3. **Assign to V0 agent user** (configured in workspace)
4. Agent picks up issue → generates UI → posts demo link
5. **Iterate**: @mention with feedback, then @mention with "deploy" to ship

---

## MCP Server Tools (Antigravity Orchestration)

When orchestrating from Antigravity, these tools are available:

```typescript
// Create V0 session from Linear issue
v0_create_from_issue({ issueId: 'SYS-353' })

// Refine existing session
v0_refine_session({ chatId: 'abc123', feedback: 'Make it darker' })

// Monitor session status
v0_monitor_status({ chatId: 'abc123' })

// Batch process multiple issues
v0_batch_from_labels({ labels: ['ui', 'executor:v0'], maxParallel: 3 })
```

---

## Comparison with Other Executors

| Feature | V0 Agent | Jules | Copilot |
|---------|----------|-------|---------|
| **Specialty** | UI generation | Backend/full-stack | Multi-file refactors |
| **Complexity** | L1-L4 | L1-L2 | L3-L4 |
| **Output** | Components + Vercel deploy | PRs | PRs |
| **Concurrency** | Bounded by V0 API | 60 sessions | 3-5 PRs |
| **Interaction** | Linear @mentions | Fire-and-forget | PR comments |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `V0_API_KEY` | V0 Platform API key (Premium/Team required) |
| `LINEAR_ACCESS_TOKEN` | OAuth token from install flow |
| `LINEAR_V0_AGENT_USER_ID` | Agent user ID in Linear |
| `LINEAR_WEBHOOK_SECRET` | Webhook signing secret |
| `GITHUB_TOKEN` | GitHub PAT (future PR automation) |
| `PORT` | Server port (default: 3324) |

---

## Deployment

**Production**: `rainworth-server` via systemd
- Service: `v0-linear-agent.service`
- Port: 3324
- Tunnel: Cloudflare tunnel at `v0-agent.frasergibbs.com`
