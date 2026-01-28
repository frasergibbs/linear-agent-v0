# V0 Linear Agent

Linear agent powered by V0 Platform API for automated UI component generation (L1-L4 complexity frontend tasks).

## Features

- ✅ **AgentSession lifecycle tracking** - Real-time visibility in Linear Activity Timeline
- ✅ **Agent Activities streaming** - GitHub Copilot-style progress updates
- ✅ **Agent Plans** - Dynamic checklist showing what's next
- ✅ **Multi-turn refinement** - Iterative improvements via @mention commands
- ✅ **Automated PR creation** - Draft PRs with demo URLs and generated files
- ✅ **Chat history persistence** - Context retention across refinement sessions

## Prerequisites

- Node.js >= 18.0.0
- V0 API key (Premium/Team plan required)
- Linear API key
- GitHub Personal Access Token

## Installation

```bash
# Clone repository
cd linear-agent-v0

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start server
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `V0_API_KEY` | V0 Platform API key | ✅ |
| `LINEAR_API_KEY` | Linear API key | ✅ |
| `LINEAR_WEBHOOK_SECRET` | Linear webhook signing secret | ✅ |
| `LINEAR_V0_AGENT_USER_ID` | Linear user ID for V0 agent | ✅ |
| `GITHUB_TOKEN` | GitHub PAT for PR creation | ✅ |
| `PORT` | Server port (default: 3324) | ❌ |

## Usage

### Assign V0 Agent to Linear Issue

1. Create a Linear issue with UI requirements
2. Add labels: `executor:v0`, `ui`, `complexity:1-4`
3. Assign to V0 agent user
4. Agent creates AgentSession and generates component
5. View demo in Linear Activity Timeline

### Refine Generated Component

```
@v0 refine Make the button larger and add hover effects
```

### Available Commands

- `@v0 refine [feedback]` - Send refinement feedback
- `@v0 demo` - Repost demo URL
- `@v0 complete` - Mark session complete
- `@v0 help` - Show available commands

## MCP Server Tools (for Antigravity)

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

## Architecture

```
linear-agent-v0/
├── lib/
│   ├── v0.js                 # V0 SDK integration
│   ├── linear.js             # Linear GraphQL client
│   ├── linear-session.js     # AgentSession management
│   ├── linear-webhook.js     # Webhook handler
│   ├── linear-v0-monitor.js  # Session monitoring + Activities
│   ├── git-integration.js    # File extraction + Git
│   ├── github.js             # PR automation
│   ├── chat-history.js       # V0 chat persistence
│   └── batch-processor.js    # Batch processing
├── middleware/
│   └── webhook-verify.js     # Signature verification
├── types/
│   └── index.d.ts            # TypeScript types
├── index.js                  # Express server
└── mcp-server.js             # MCP tools for Antigravity

```

## Development

```bash
# Run in watch mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Linear Agent Session API Features

This agent leverages Linear's native Agent Session APIs for a polished UX:

- **AgentSession**: Formal lifecycle tracking (pending → active → complete)
- **Agent Activities**: Real-time streaming updates (thought, tool, message, error)
- **Agent Plans**: Dynamic checklist that evolves during execution
- **External URLs**: Prominent demo/PR links in Linear UI
- **Session States**: `pending`, `active`, `awaitingInput`, `error`, `complete`

## Implementation Status

**Phase 1 (Core Integration):**
- [x] Repository setup
- [ ] V0 SDK integration
- [ ] Linear API integration
- [ ] Webhook infrastructure

**Phase 1.5 (Agent Session):**
- [ ] AgentSession lifecycle

**Phase 2 (Monitoring):**
- [ ] Agent Activities streaming
- [ ] @mention commands

**Phase 2.5 (Plans):**
- [ ] Dynamic Agent Plans

**Phase 3 (File Integration):**
- [ ] File extraction + Git
- [ ] Automated PR creation

**Phase 4 (Orchestration):**
- [ ] MCP server tools
- [ ] Batch processing
- [ ] Analytics dashboard

**Phase 4.5 (Chat History):**
- [ ] V0 chat persistence

## References

- [V0 Platform API](https://v0.dev/api)
- [Linear Agent API](https://linear.app/developers/agent-interaction)
- [Linear GraphQL API](https://studio.apollographql.com/public/Linear-API)
- [Implementation Plan](./implementation_plan.md)

## License

MIT
