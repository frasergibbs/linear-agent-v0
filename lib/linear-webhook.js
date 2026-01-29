import { parseLinearWebhook } from '../middleware/webhook-verify.js';
import {
    createV0Session,
    continueV0Session,
    initFromRepo,
    createOrFindProject,
    deployToVercel,
    formatIssueForV0Prompt,
    extractComplexityFromLabels,
    getModelTier,
} from './v0.js';
import { getAgentLinearClient } from './linear-oauth.js';
import { detectRepository, generateProjectName, needsRepositorySelection, formatRepoOptionsForSelect } from './repo-detection.js';
import { generateUIGenerationPlan, createAgentPlan, updateAgentPlan, markStepCompleted, markStepCurrent, markStepFailed } from './agent-plans.js';
import { storeSession, getSession, updateSession } from './session-store.js';

/**
 * Linear Webhook Handler (Spec Compliant)
 *
 * Features:
 * - Agent Plans for native checklist UX
 * - externalUrls for V0 chat and deployment links
 * - Repository detection with select signals
 * - Multi-turn conversations via @mentions
 * - Vercel deployment on request
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

        // 2. Detect repository from issue context
        const repoDetection = detectRepository(agentSession);
        const needsSelection = needsRepositorySelection(agentSession);

        // 3. Create and emit Agent Plan
        let planSteps = generateUIGenerationPlan({
            hasRepo: !!repoDetection.repoUrl,
            needsSelection,
        });

        await createAgentPlan({ sessionId, steps: planSteps });

        // 4. If multiple repos suggested, ask user to select
        if (needsSelection) {
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

            return { success: true, message: 'Waiting for repository selection', sessionId, awaitingSelection: true };
        }

        // 5. Create V0 project
        const projectName = generateProjectName(issue);
        const project = await createOrFindProject({ name: projectName });

        let v0Session;
        const hasRepo = !!repoDetection.repoUrl;

        // 6. Initialize V0 session
        if (hasRepo) {
            planSteps = markStepCurrent(planSteps, 1);
            await updateAgentPlan({ sessionId, steps: planSteps });

            v0Session = await initFromRepo({
                repoUrl: repoDetection.repoUrl,
                projectId: project.projectId,
            });

            planSteps = markStepCompleted(planSteps, 1);
        } else {
            const prompt = formatIssueForV0Prompt({
                title: issue.title,
                description: promptContext || issue.description,
                labels: issue.labels?.map((l) => l.name) || [],
            });

            // Extract complexity from labels for model selection
            const labelNames = issue.labels?.map((l) => l.name) || [];
            const complexity = extractComplexityFromLabels(labelNames);
            const model = getModelTier(complexity);

            console.log(`🎯 Model selection: complexity=${complexity}, model=${model}`);

            v0Session = await createV0Session({
                prompt,
                system: 'Generate React components using Next.js 14+ App Router, Tailwind CSS, and shadcn/ui.',
                projectId: project.projectId,
                responseMode: 'async',
                model,
                thinking: model === 'max', // Enable thinking for complex issues
            });
        }

        // 7. Store session for multi-turn
        storeSession({
            linearSessionId: sessionId,
            chatId: v0Session.chatId,
            projectId: project.projectId,
            chatUrl: v0Session.chatUrl,
            repoUrl: repoDetection.repoUrl,
        });

        // 8. Update plan - generation complete
        const genIndex = hasRepo ? 2 : 1;
        planSteps = markStepCurrent(planSteps, genIndex);
        await updateAgentPlan({ sessionId, steps: planSteps });

        // 9. Set externalUrls
        await linearClient.updateAgentSession({
            id: sessionId,
            externalUrls: [{ label: 'V0 Chat', url: v0Session.chatUrl }],
        });

        // 10. Emit completion message
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: `🎨 UI generation complete!\n\n[View in V0](${v0Session.chatUrl})\n\n**Commands:**\n- @mention with feedback to iterate\n- @mention with "deploy" to deploy to Vercel`,
            },
        });

        return {
            success: true,
            message: 'Agent session started',
            sessionId,
            chatId: v0Session.chatId,
            chatUrl: v0Session.chatUrl,
        };
    } catch (error) {
        console.error('Failed to handle agent session:', error);

        try {
            const linearClient = getAgentLinearClient();
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: { type: 'error', text: `Failed to create V0 session: ${error.message}` },
            });
        } catch (e) {
            console.error('Failed to emit error activity:', e);
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
            content: { type: 'thought', text: 'Processing your feedback...' },
        });

        // 2. Check for signal response (repo selection)
        if (guidance?.signals) {
            const repoSignal = guidance.signals.find((s) => s.key === 'repository');
            if (repoSignal?.value) {
                const project = await createOrFindProject({ name: generateProjectName(issue) });
                const v0Session = await initFromRepo({
                    repoUrl: repoSignal.value,
                    projectId: project.projectId,
                });

                storeSession({
                    linearSessionId: sessionId,
                    chatId: v0Session.chatId,
                    projectId: project.projectId,
                    chatUrl: v0Session.chatUrl,
                    repoUrl: repoSignal.value,
                });

                await linearClient.updateAgentSession({
                    id: sessionId,
                    externalUrls: [{ label: 'V0 Chat', url: v0Session.chatUrl }],
                });

                await linearClient.createAgentActivity({
                    agentSessionId: sessionId,
                    content: { type: 'message', text: `🎨 Initialized with ${repoSignal.value}\n\n[View in V0](${v0Session.chatUrl})` },
                });

                return { success: true, message: 'Repository selected and initialized', chatId: v0Session.chatId };
            }
        }

        // 3. Get stored session
        const session = getSession(sessionId);
        if (!session) {
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: { type: 'error', text: 'No active V0 session found. Please delegate the issue again.' },
            });
            return { success: false, message: 'No session found' };
        }

        // 4. Check for deploy command
        const message = promptContext || '';
        const isDeployCommand = /\bdeploy\b/i.test(message);

        if (isDeployCommand) {
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: { type: 'action', text: 'Deploying to Vercel...' },
            });

            const deployment = await deployToVercel({
                chatId: session.chatId,
                projectId: session.projectId,
            });

            updateSession(sessionId, { deploymentUrl: deployment.deploymentUrl });

            // Add deployment URL to externalUrls
            await linearClient.updateAgentSession({
                id: sessionId,
                externalUrls: [
                    { label: 'V0 Chat', url: session.chatUrl },
                    { label: 'Vercel Deployment', url: deployment.deploymentUrl },
                ],
            });

            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: {
                    type: 'message',
                    text: `🚀 Deployed to Vercel!\n\n[View Deployment](${deployment.deploymentUrl})`,
                },
            });

            return { success: true, message: 'Deployed to Vercel', deploymentUrl: deployment.deploymentUrl };
        }

        // 5. Continue V0 conversation with feedback
        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: { type: 'action', text: 'Applying your feedback...' },
        });

        const response = await continueV0Session({
            chatId: session.chatId,
            message: message,
        });

        updateSession(sessionId, { latestVersionId: response.latestVersionId });

        await linearClient.createAgentActivity({
            agentSessionId: sessionId,
            content: {
                type: 'message',
                text: `✅ Changes applied!\n\n[View updated version](${session.chatUrl})\n\n@mention with more feedback or "deploy" to go live.`,
            },
        });

        return { success: true, message: 'Feedback applied', chatId: session.chatId };
    } catch (error) {
        console.error('Failed to handle prompted event:', error);

        try {
            const linearClient = getAgentLinearClient();
            await linearClient.createAgentActivity({
                agentSessionId: sessionId,
                content: { type: 'error', text: `Error: ${error.message}` },
            });
        } catch (e) {
            console.error('Failed to emit error activity:', e);
        }

        return { success: false, message: error.message };
    }
}
