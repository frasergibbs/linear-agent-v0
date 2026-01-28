# LINEAR AGENT SPEC COMPLIANCE

**CRITICAL: This document enforces strict adherence to Linear's Agent specification.**

## ⚠️ MANDATORY READING BEFORE ANY WORK

**PRIMARY SOURCE OF TRUTH:** https://linear.app/developers/agents

You MUST read and follow this spec exactly. Do NOT deviate under ANY circumstances.

---

## 🚨 CRITICAL REQUIREMENTS (DO NOT VIOLATE)

### 1. Authentication: OAuth2 with `actor=app` ONLY

**SPEC REQUIREMENT:**
> "App authentication is built on top of the standard OAuth2 flow. To install your agent into a Linear workspace in the OAuth authorization url add the `actor=app` parameter."

**WHAT THIS MEANS:**

✅ **CORRECT:**
- ONE OAuth installation per workspace
- Use `actor=app` parameter in OAuth flow
- Admin-level installation required
- Single access token for the agent identity
- Store ONE token per workspace (not per-user)

❌ **INCORRECT (DO NOT DO THIS):**
- ❌ Per-user Personal Access Tokens (PATs)
- ❌ Auth0 per-user token storage
- ❌ Each user providing their own Linear token
- ❌ User-scoped authentication

**IMPLEMENTATION:**
```javascript
// OAuth URL format
https://linear.app/oauth/authorize?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=YOUR_REDIRECT_URI
  &scope=read,write,assignee,delegate
  &actor=app  // ⚠️ CRITICAL: This makes it an agent installation
  &response_type=code
```

### 2. Scopes Required

**SPEC REQUIREMENT:**
> "To allow for flexibility, the ability to mention and assign your agent is optional and must be requested through the use of two new additional scopes."

**REQUIRED SCOPES:**
- `read` - Read workspace data
- `write` - Create/update issues and comments
- `delegate` - Be delegated issues (assignee sets delegate, not assignee)
- `assignee` - Optional: Be assigned issues directly

**IMPORTANT:** Agents are **delegated** issues, not assigned. Users remain the assignee while agents act on their behalf.

### 3. Agent Sessions (Automatic Lifecycle)

**SPEC REQUIREMENT:**
> "Sessions are created automatically when an agent is mentioned or delegated an issue. Session state is visible to users, and updated automatically based on the agent's emitted activities. No manual state management is required."

**WHAT THIS MEANS:**

✅ **CORRECT:**
- Linear creates `AgentSession` automatically on delegation/@mention
- Receive `AgentSessionEvent.created` webhook
- Emit activities (thought/tool/message) to update state
- Linear manages state transitions automatically

❌ **INCORRECT (DO NOT DO THIS):**
- ❌ Manually creating `AgentSession` objects
- ❌ Manually managing session state transitions
- ❌ Using comments instead of Agent Activities

**IMPLEMENTATION:**
```javascript
// 1. Receive AgentSessionEvent.created webhook
// 2. Extract agentSession.id from webhook
// 3. Emit thought activity within 10 seconds
await linearClient.createAgentActivity({
  agentSessionId: session.id,
  content: {
    type: 'thought',
    text: 'Analyzing UI requirements...'
  }
});
```

### 4. Webhook Events

**SPEC REQUIREMENT:**
> "In the configuration, enable webhooks and make sure to select Agent session events at the bottom."

**REQUIRED WEBHOOK CATEGORIES:**
- **Agent session events** (CRITICAL - enables `AgentSessionEvent`)
- Inbox notifications (optional, helpful)
- Permission changes (optional, helpful)

**PRIMARY WEBHOOK:**
```typescript
{
  type: 'AgentSessionEvent',
  action: 'created',
  data: {
    agentSession: {
      id: string,
      issue: {...},
      comment?: {...},
      promptContext: string,  // ⚠️ Use this for context, not manual assembly
      state: 'pending' | 'active' | 'awaitingInput' | 'complete' | 'error'
    }
  }
}
```

### 5. First Response Timing

**SPEC REQUIREMENT:**
> "Emit a thought activity within 10 seconds to acknowledge the session has begun."

**CRITICAL:** You have **10 seconds** to emit the first `thought` activity after receiving the webhook.

### 6. Prompt Context

**SPEC REQUIREMENT:**
> "Use the promptContext field to construct a formatted string containing the session's relevant context, such as issue details, comments, and guidance."

**WHAT THIS MEANS:**

✅ **CORRECT:**
```javascript
// Use promptContext from webhook
const context = agentSession.promptContext;
```

❌ **INCORRECT:**
```javascript
// ❌ Don't manually assemble context from issue fields
const context = `${issue.title}\n${issue.description}...`;
```

---

## 📋 IMPLEMENTATION CHECKLIST

Before making ANY authentication or webhook changes, verify:

- [ ] Using OAuth2 with `actor=app` parameter
- [ ] NOT using per-user PATs
- [ ] NOT using Auth0 for per-user token storage
- [ ] Storing ONE workspace agent token (in 1Password/environment)
- [ ] Requesting `assignee` and `delegate` scopes
- [ ] Webhook configured for "Agent session events"
- [ ] Using `AgentSessionEvent.created` as primary trigger
- [ ] NOT manually creating `AgentSession` objects
- [ ] Emitting `thought` activity within 10 seconds
- [ ] Using `promptContext` from webhook, not assembling manually
- [ ] Using Agent Activities API (not comments) for updates

---

## 🔍 COMMON HALLUCINATIONS TO AVOID

### Hallucination #1: Per-User PATs ❌
**WRONG:**
> "Users add their Linear PAT to Auth0 metadata, and we fetch it per-request."

**WHY IT'S WRONG:**
- Spec requires OAuth2 `actor=app` (ONE token per workspace)
- Agents have a single identity, not per-user identities

---

### Hallucination #2: Manual Session Management ❌
**WRONG:**
> "Create an AgentSession when an issue is assigned."

**WHY IT'S WRONG:**
- Linear creates sessions automatically
- You receive `AgentSessionEvent.created` webhook
- Just emit activities; Linear manages state

---

### Hallucination #3: Using Comments ❌
**WRONG:**
> "Post a comment to show progress."

**WHY IT'S WRONG:**
- Use Agent Activities API (`thought`, `tool`, `message`)
- Activities update session state automatically
- Activities are the native agent interaction pattern

---

### Hallucination #4: Webhook = Issue.update ❌
**WRONG:**
> "Listen for `Issue.update` when assigned to agent user."

**WHY IT'S WRONG:**
- Use `AgentSessionEvent.created` instead
- Agent session events are the primary trigger
- Much cleaner than parsing issue assignments

---

## 🛠️ CORRECT ARCHITECTURE

```
User delegates issue to agent
          ↓
Linear creates AgentSession automatically
          ↓
Linear sends AgentSessionEvent.created webhook
          ↓
Your server receives webhook
          ↓
Extract agentSession.promptContext
          ↓
Emit thought activity (< 10 seconds)
          ↓
Emit tool/message activities as work progresses
          ↓
Linear updates session state automatically
          ↓
Emit final message activity
          ↓
Session automatically transitions to complete
```

---

## 📚 REQUIRED READING

Before ANY implementation work:

1. **Primary Spec:** https://linear.app/developers/agents
2. **Agent Interaction:** https://linear.app/developers/agent-interaction
3. **Best Practices:** https://linear.app/developers/agent-best-practices
4. **OAuth Actor:** https://linear.app/developers/oauth-actor-authorization

---

## ⚠️ FINAL WARNING

**This is the 4th time we've deviated from the spec.**

Before writing ANY code related to:
- Authentication
- Webhooks
- Session management
- Agent activities

**RE-READ THIS DOCUMENT AND THE OFFICIAL SPEC.**

If there is ANY uncertainty, ask Fraser for clarification BEFORE implementing.

---

*Last updated: 2026-01-29*
*Spec version: Developer Preview*
