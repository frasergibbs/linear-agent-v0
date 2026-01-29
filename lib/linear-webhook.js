import { parseLinearWebhook } from '../middleware/webhook-verify.js';
import { createV0Session, continueV0Session, formatIssueForV0Prompt } from './v0.js';
import { getAgentLinearClient } from './linear-oauth.js';

/**
 * Linear Webhook Handler (Spec Compliant)
 *
 * Processes webhook events from Linear to trigger V0 generation.
 *
 * SPEC COMPLIANCE:
 * - Uses workspace agent token (ONE token per workspace, not per-user PATs)
 * - Listens for AgentSessionEvent.created (PRIMARY webhook per spec)
 * - Uses agentSession.promptContext (don't assemble manually)
 * - Emits thought activity within 10 seconds
 * - Uses Agent Activities API for updates
 *
 * See: .gemini/SPEC_COMPLIANCE.md
 */

/**
 * Handle Linear webhook events
 *
 * @param {Object} payload - Linear webhook payload
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function handleLinearWebhook(payload) {
    const { type, action, data } = parseLinearWebhook(payload);

    console.log(`Webhook received: ${type}.${action}`, {
        sessionId: data?.agentSession?.id,
        issueId: data?.agentSession?.issue?.id,
    });

    // Route to appropriate handler
    switch (`${type}.${action}`) {
        case 'AgentSessionEvent.created':
            return handleAgentSessionCreated(data);

        case 'AgentSessionEvent.prompted':
            return handleAgentSessionPrompted(data);

        default:
            console.log(`Ignoring event: ${type}.${action}`);
            return { success: true, message: 'Event ignored' };
    }
}

/**
 * Handle AgentSessionEvent.created webhook
 *
 * This is the PRIMARY webhook per Linear Agents specification.
 * Triggers when user delegates issue to agent.
 *
 * @param {Object} data - AgentSessionEvent data
 */
async function handleAgentSessionCreated(data) {
    const { agentSession } = data;

    if (!agentSession) {
        console.error('⚠️ AgentSessionEvent.created received without agentSession data');
        return { success: false, message: 'Missing agentSession data' };
    }

    const { id: sessionId, issue, promptContext } = agentSession;

    console.log(`🎨 Agent session created for issue ${issue.identifier}`, {
        sessionId,
        issueId: issue.id,
    });

    try {
        const linearClient = getAgentLinearClient();

        // 1. EMIT THOUGHT ACTIVITY WITHIN 10 SECONDS (CRITICAL PER SPEC)
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'thought',
                text: 'Analyzing UI requirements from Linear issue...',
            },
        });

        console.log('✅ Emitted initial thought activity');

        // 2. Format issue for V0 prompt
        const prompt = formatIssueForV0Prompt({
            title: issue.title,
            description: promptContext || issue.description,
            labels: issue.labels?.map((l) => l.name) || [],
        });

        // 3. Create V0 session using real v0-sdk
        const v0Session = await createV0Session({
            prompt,
            system: 'Generate React components using Next.js 14+ App Router, Tailwind CSS, and shadcn/ui.',
            responseMode: 'async',
        });

        console.log(`✅ V0 session created: ${v0Session.chatId}`);

        // 4. Emit tool activity with V0 chat URL
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'tool',
                text: 'Created V0 session for UI generation',
                toolName: 'v0_create_session',
                toolOutput: `Chat ID: ${v0Session.chatId}\nPreview: ${v0Session.demoUrl}`,
            },
        });

        // 5. Emit message activity with chat link
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: `🎨 UI component generated!\n\n[View in V0](${v0Session.chatUrl})\n\n@mention me with feedback to iterate.`,
            },
        });

        // 6. Set external URLs for Linear UI
        // TODO: Phase 3 - Add externalUrls to agent session

        return {
            success: true,
            message: 'Agent session started',
            sessionId,
            chatId: v0Session.chatId,
            demoUrl: v0Session.demoUrl,
            chatUrl: v0Session.chatUrl,
        };
    } catch (error) {
        console.error('Failed to handle agent session:', error);

        try {
            const linearClient = getAgentLinearClient();
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: {
                    type: 'error',
                    text: `Failed to create V0 session: ${error.message}`,
                },
            });
        } catch (activityError) {
            console.error('Failed to emit error activity:', activityError);
        }

        return { success: false, message: error.message };
    }
}

/**
 * Handle AgentSessionEvent.prompted webhook
 *
 * Triggers when user @mentions agent in comment for multi-turn conversation.
 *
 * @param {Object} data - AgentSessionEvent data
 */
async function handleAgentSessionPrompted(data) {
    const { agentSession } = data;

    if (!agentSession) {
        console.error('⚠️ AgentSessionEvent.prompted received without agentSession data');
        return { success: false, message: 'Missing agentSession data' };
    }

    const { id: sessionId, issue, promptContext, previousComments } = agentSession;

    console.log(`🔄 Agent prompted for issue ${issue.identifier}`, { sessionId });

    try {
        const linearClient = getAgentLinearClient();

        // 1. Acknowledge within 10 seconds
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'thought',
                text: 'Processing your feedback...',
            },
        });

        // 2. Get stored chat ID from session (TODO: implement persistent storage)
        // For now we'll need to track this in memory or database
        // const chatId = await getChatIdForSession(sessionId);

        // 3. Continue V0 conversation
        // TODO: Phase 4 - Implement multi-turn with continueV0Session

        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: 'Multi-turn iteration coming in Phase 4. Stay tuned!',
            },
        });

        return { success: true, message: 'Prompted event acknowledged' };
    } catch (error) {
        console.error('Failed to handle prompted event:', error);
        return { success: false, message: error.message };
    }
}
