import { parseLinearWebhook } from '../middleware/webhook-verify.js';
import {
    createV0Session,
    continueV0Session,
    initFromRepo,
    createOrFindProject,
    getSessionData,
    formatIssueForV0Prompt,
} from './v0.js';
import { getAgentLinearClient } from './linear-oauth.js';
import { detectRepository, generateProjectName, needsRepositorySelection, formatRepoOptionsForSelect } from './repo-detection.js';

/**
 * Linear Webhook Handler (Spec Compliant)
 *
 * Processes webhook events from Linear to trigger V0 generation.
 *
 * SPEC COMPLIANCE:
 * - Uses workspace agent token (ONE token per workspace)
 * - Listens for AgentSessionEvent.created/prompted
 * - Uses agentSession.promptContext (don't assemble manually)
 * - Emits thought activity within 10 seconds
 * - Uses Agent Activities API for updates
 */

/**
 * Handle Linear webhook events
 */
export async function handleLinearWebhook(payload) {
    const { type, action, data } = parseLinearWebhook(payload);

    console.log(`Webhook received: ${type}.${action}`, {
        sessionId: data?.agentSession?.id,
        issueId: data?.agentSession?.issue?.id,
    });

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
 * Handle AgentSessionEvent.created - user delegates issue to agent
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

        // 1. EMIT THOUGHT ACTIVITY WITHIN 10 SECONDS (CRITICAL)
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'thought',
                text: 'Analyzing UI requirements and detecting repository...',
            },
        });

        console.log('✅ Emitted initial thought activity');

        // 2. Detect repository from issue context
        const repoDetection = detectRepository(agentSession);
        console.log(`📦 Repository detection: source=${repoDetection.source}, url=${repoDetection.repoUrl}`);

        // 3. If multiple repos suggested, ask user to select
        if (needsRepositorySelection(agentSession)) {
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: {
                    type: 'elicitation',
                    signals: [
                        {
                            type: 'select',
                            key: 'repository',
                            label: 'Select a repository for this issue',
                            options: formatRepoOptionsForSelect(repoDetection.suggestions),
                        },
                    ],
                },
            });

            return {
                success: true,
                message: 'Waiting for repository selection',
                sessionId,
                awaitingSelection: true,
            };
        }

        // 4. Create or find V0 project
        const projectName = generateProjectName(issue);
        const project = await createOrFindProject({ name: projectName });
        console.log(`📁 V0 project: ${project.projectId}`);

        let v0Session;

        // 5. Initialize V0 session - with repo if detected, otherwise from scratch
        if (repoDetection.repoUrl) {
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: {
                    type: 'action',
                    text: `Importing repository: ${repoDetection.repoUrl}`,
                },
            });

            v0Session = await initFromRepo({
                repoUrl: repoDetection.repoUrl,
                projectId: project.projectId,
            });

            console.log(`✅ V0 session initialized from repo: ${v0Session.chatId}`);
        } else {
            // No repo - create from prompt
            const prompt = formatIssueForV0Prompt({
                title: issue.title,
                description: promptContext || issue.description,
                labels: issue.labels?.map((l) => l.name) || [],
            });

            v0Session = await createV0Session({
                prompt,
                system: 'Generate React components using Next.js 14+ App Router, Tailwind CSS, and shadcn/ui.',
                projectId: project.projectId,
                responseMode: 'async',
            });

            console.log(`✅ V0 session created from prompt: ${v0Session.chatId}`);
        }

        // 6. Emit tool activity with V0 chat URL
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'tool',
                text: 'Created V0 session for UI generation',
                toolName: 'v0_create_session',
                toolOutput: `Chat ID: ${v0Session.chatId}\nPreview: ${v0Session.demoUrl || 'pending'}`,
            },
        });

        // 7. Emit message with links
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: `🎨 UI generation started!\n\n[View in V0](${v0Session.chatUrl})\n\n@mention me with feedback to iterate.`,
            },
        });

        return {
            success: true,
            message: 'Agent session started',
            sessionId,
            chatId: v0Session.chatId,
            chatUrl: v0Session.chatUrl,
            repoDetected: !!repoDetection.repoUrl,
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
 * Handle AgentSessionEvent.prompted - user @mentions agent
 */
async function handleAgentSessionPrompted(data) {
    const { agentSession } = data;

    if (!agentSession) {
        console.error('⚠️ AgentSessionEvent.prompted received without agentSession data');
        return { success: false, message: 'Missing agentSession data' };
    }

    const { id: sessionId, issue, promptContext, guidance } = agentSession;

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

        // 2. Check for signal response (e.g., repository selection)
        if (guidance?.signals) {
            const repoSignal = guidance.signals.find((s) => s.key === 'repository');
            if (repoSignal?.value) {
                // User selected a repository - reinitialize
                const project = await createOrFindProject({ name: generateProjectName(issue) });
                const v0Session = await initFromRepo({
                    repoUrl: repoSignal.value,
                    projectId: project.projectId,
                });

                await linearClient.createAgentActivity({
                    agentSessionId: sessionId,
                    content: {
                        type: 'message',
                        text: `🎨 Initialized with ${repoSignal.value}\n\n[View in V0](${v0Session.chatUrl})`,
                    },
                });

                return {
                    success: true,
                    message: 'Repository selected and initialized',
                    chatId: v0Session.chatId,
                };
            }
        }

        // 3. Continue existing conversation (Phase 4 - placeholder)
        // TODO: Implement continueV0Session with stored chatId
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
