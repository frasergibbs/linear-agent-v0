import { parseLinearWebhook } from '../middleware/webhook-verify.js';
import { getLinearIssue } from './linear.js';
import { createV0Session, formatIssueForV0Prompt } from './v0.js';
import { getLinearTokenForUser } from './auth0-client.js';
import { LinearClient } from '@linear/sdk';

/**
 * Linear Webhook Handler
 * 
 * Processes webhook events from Linear to trigger V0 generation.
 * 
 * Auth0 Integration Flow:
 * 1. Webhook received from Linear
 * 2. Extract user email from webhook payload
 * 3. Fetch user's Linear token from Auth0 user metadata
 * 4. Create per-user Linear client
 * 5. Process event with user's permissions
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
        issueId: data?.id,
        issueIdentifier: data?.identifier
    });

    // Route to appropriate handler
    switch (`${type}.${action}`) {
        case 'Issue.update':
            return handleIssueUpdate(data);

        case 'Comment.create':
            return handleCommentCreate(data);

        default:
            console.log(`Ignoring event: ${type}.${action}`);
            return { success: true, message: 'Event ignored' };
    }
}

/**
 * Handle Issue.update webhook
 * 
 * Triggers when:
 * - Issue is assigned to any user
 * - User delegates to V0 agent via @mention
 * 
 * @param {Object} data - Issue update data
 */
async function handleIssueUpdate(data) {
    const { id: issueId, assigneeId, assignee, updatedBy } = data;

    // Skip if no assignee (user unassigned the issue)
    if (!assigneeId) {
        return { success: true, message: 'Issue unassigned' };
    }

    // Extract user email (try assignee first, then updatedBy)
    const userEmail = assignee?.email || updatedBy?.email;

    if (!userEmail) {
        console.warn('⚠️ Could not determine user email from Issue.update webhook');
        return { success: false, message: 'No user email found' };
    }

    console.log(`🎨 Issue ${data.identifier} assigned, processing for user: ${userEmail}`);

    try {
        // Fetch user's Linear token from Auth0
        const linearToken = await getLinearTokenForUser(userEmail);

        // Create per-user Linear client
        const linearClient = new LinearClient({
            accessToken: linearToken
        });

        // Fetch full issue details
        const issue = await linearClient.issue(issueId);

        // Generate V0-optimized prompt
        const prompt = formatIssueForV0Prompt(issue);

        // Create V0 session
        // TODO: Phase 1.5 - Create AgentSession first
        const v0Session = await createV0Session({
            prompt,
            context: {
                framework: 'next',
                styling: 'tailwind',
                darkMode: issue.labels?.some(l => l.name.toLowerCase().includes('dark')),
                responsive: issue.labels?.some(l => l.name.toLowerCase().includes('responsive')),
                accessibility: issue.labels?.some(l => l.name.toLowerCase().includes('a11y'))
            }
        });

        console.log(`✅ V0 session created: ${v0Session.chatId}`);

        // TODO: Phase 1.5 - Update AgentSession state to 'active'
        // TODO: Phase 2 - Emit Agent Activity (thought/tool/message)
        // TODO: Phase 2.5 - Create initial Agent Plan
        // TODO: Phase 4.5 - Store chat history

        return {
            success: true,
            message: 'V0 session created',
            chatId: v0Session.chatId,
            demoUrl: v0Session.demoUrl
        };
    } catch (error) {
        console.error('Failed to handle issue assignment:', error);

        // If Auth0 token not found, this is a user setup issue
        if (error.message.includes('not added Linear token')) {
            console.error(
                `🔧 Setup Required: User ${userEmail} must add Linear PAT to Auth0.\n` +
                `   See: https://github.com/frasergibbs/linear-agent-v0#auth0-setup`
            );
        }

        // TODO: Phase 1.5 - Update AgentSession state to 'error'
        // TODO: Phase 2 - Emit Agent Activity (error)

        return {
            success: false,
            message: error.message
        };
    }
}

/**
 * Handle Comment.create webhook
 * 
 * Triggers when:
 * - User posts a comment with @v0 mention
 * 
 * @param {Object} data - Comment create data
 */
async function handleCommentCreate(data) {
    const { body, issueId } = data;

    // Check if comment mentions @v0
    const hasV0Mention = body.toLowerCase().includes('@v0');

    if (!hasV0Mention) {
        return { success: true, message: 'No @v0 mention' };
    }

    console.log(`💬 @v0 mentioned in issue comment`);

    // Extract command from comment
    const command = parseV0Command(body);

    // TODO: Phase 2 - Implement @mention command handling
    // - @v0 refine [feedback] → continueV0Session()
    // - @v0 demo → repost demo URL
    // - @v0 complete → mark session complete
    // - @v0 help → show available commands

    console.log(`Command: ${command.type}`, command.args);

    return {
        success: true,
        message: 'Command parsed (not implemented yet)',
        command
    };
}

/**
 * Parse @v0 command from comment body
 * 
 * @param {string} body - Comment body
 * @returns {{type: string, args: string}}
 */
function parseV0Command(body) {
    // Pattern: @v0 <command> [args...]
    const match = body.match(/@v0\s+(\w+)\s*(.*)/i);

    if (!match) {
        return { type: 'unknown', args: '' };
    }

    const [, command, args] = match;

    return {
        type: command.toLowerCase(),
        args: args.trim()
    };
}
