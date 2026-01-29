# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A native Linear coding agent that uses V0's Platform API to generate UI components from Linear issues. All interaction happens within Linear via Agent Sessions and Activities — no external dashboard.

**Stack**: Node.js 18+ (ES modules), Express.js, `@linear/sdk`, `v0-sdk` (beta, currently mocked)

**Deployment**: Self-hosted on rainworth-server via systemd + Cloudflare Tunnel at `linear-agent.fraserandsam.com:3324`

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Watch mode (node --watch)
npm start          # Production mode
npm test           # Vitest (no tests yet)
npm run lint       # ESLint (no config yet)
npm run format     # Prettier (no config yet)
```

Deploy to production:
```bash
./deployment/deploy.sh   # rsync to rainworth-server, npm install, restart systemd
```

## Architecture

### Request Flow

```
User delegates/mentions agent in Linear
  → Linear creates AgentSession automatically
  → AgentSessionEvent.created webhook → POST /webhook/linear
  → middleware/webhook-verify.js validates HMAC-SHA256 signature
  → lib/linear-webhook.js processes event
  → Emits thought activity within 10 seconds (CRITICAL)
  → lib/v0.js creates V0 session from promptContext
  → Emits tool/message activities as work progresses
  → Linear manages session state transitions automatically
```

### Key Files

- **index.js** — Express server: `/health`, `/auth/install` + `/auth/callback` (OAuth), `/webhook/linear`
- **lib/linear-oauth.js** — OAuth2 with `actor=app` (workspace-level, ONE token per workspace)
- **lib/linear-webhook.js** — AgentSessionEvent handler, activity emission
- **lib/linear.js** — Linear SDK wrapper (issues, comments, status updates)
- **lib/v0.js** — V0 Platform API integration (mock client until SDK stabilizes)
- **middleware/webhook-verify.js** — HMAC-SHA256 webhook signature verification

### OAuth Authentication Model

Uses workspace-level OAuth with `actor=app`. This is a single agent identity per workspace, NOT per-user tokens.

## Spec Compliance (MANDATORY)

**Read `.gemini/SPEC_COMPLIANCE.md` before ANY changes to auth, webhooks, or session handling.** The git history contains 4+ corrections from spec deviations.

Critical rules:
- OAuth uses `actor=app` — never per-user PATs
- `AgentSessionEvent.created` is the primary trigger — never `Issue.update`
- Use `promptContext` from webhook — never manually assemble context
- Use Agent Activities API (thought/tool/message) — never comments
- Never manually create AgentSession objects — Linear does this automatically
- First thought activity must emit within 10 seconds of webhook receipt

## Implementation Status

Phase 1 (Core): Partially complete — webhook infra works, V0 SDK using mock client
Phase 1.5 (Agent Session): In progress — OAuth flow and event handler work
Phase 2+ (Plans, multi-turn, file extraction, PR automation): Not started

## Environment Variables

Defined in `.env` (gitignored). Required: `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_ACCESS_TOKEN`, `LINEAR_V0_AGENT_USER_ID`, `LINEAR_WEBHOOK_SECRET`, `V0_API_KEY`, `GITHUB_TOKEN`, `PORT` (3324), `BASE_URL`.
