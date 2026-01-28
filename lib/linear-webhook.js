import { parseLinearWebhook } from '../middleware/webhook-verify.js';
import { createV0Session, formatIssueForV0Prompt } from './v0.js';
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
        issueId: data?.agentSession?.issue?.id
    });

    // Route to appropriate handler
    switch (`${type}.${action}`) {
        case 'AgentSessionEvent.created':
            return handleAgentSessionCreated(data);

        default:
            console.log(`Ignoring event: ${type}.${action}`);
            return { success: true, message: 'Event ignored' };
    }
}

/**
 * Handle AgentSessionEvent.created webhook
 * 
 * This is the PRIMARY webhook per Linear Agents specification.
 * Triggers when:
 * - User delegates issue to agent
 * - User @mentions agent in comment
 * 
 * CRITICAL: Linear creates the AgentSession automatically.
 * We just need to:
 * 1. Use promptContext from webhook
 * 2. Emit thought activity within 10 seconds
 * 3. Create V0 session
 * 4. Emit tool/message activities as work progresses
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
        issueId: issue.id
    });

    try {
        // Get workspace agent Linear client (uses LINEAR_ACCESS_TOKEN)
        const linearClient = getAgentLinearClient();

        // 1. EMIT THOUGHT ACTIVITY WITHIN 10 SECONDS (CRITICAL PER SPEC)
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'thought',
                text: 'Analyzing UI requirements from Linear issue...'
            }
        });

        console.log('✅ Emitted initial thought activity');

        // 2. Use promptContext from spec (don't assemble manually)
        const context = promptContext;

        // 3. Create V0 session
        const v0Session = await createV0Session({
            prompt: context,
            context: {
                framework: 'next',
                styling: 'tailwind',
                darkMode: issue.labels?.some(l => l.name.toLowerCase().includes('dark')),
                responsive: issue.labels?.some(l => l.name.toLowerCase().includes('responsive')),
                accessibility: issue.labels?.some(l => l.name.toLowerCase().includes('a11y'))
            }
        });

        console.log(`✅ V0 session created: ${v0Session.chatId}`);

        // 4. Emit tool activity to show progress
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'tool',
                text: 'Created V0 session for UI generation',
                toolName: 'v0_create_session',
                toolOutput: `Chat ID: ${v0Session.chatId}\nDemo: ${v0Session.demoUrl}`
            }
        });

        // 5. Emit message activity with demo link
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: `🎨 UI component generated! [View demo](${v0Session.demoUrl})\n\nI'll continue monitoring V0 and create a PR when ready.`
            }
        });

        // TODO: Phase 2.5 - Create Agent Plan
        // TODO: Phase 3 - Extract files and create PR
        // TODO: Phase 3 - Set externalUrls (demo + PR)
        // TODO: Phase 4.5 - Store chat history

        return {
            success: true,
            message: 'Agent session started',
            sessionId,
            chatId: v0Session.chatId,
            demoUrl: v0Session.demoUrl
        };
    } catch (error) {
        console.error('Failed to handle agent session:', error);

        // Emit error activity
        try {
            const linearClient = getAgentLinearClient();
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: {
                    type: 'error',
                    text: `Failed to create V0 session: ${error.message}`
                }
            });
        } catch (activityError) {
            console.error('Failed to emit error activity:', activityError);
        }

        return {
            success: false,
            message: error.message
        };
    }
}
