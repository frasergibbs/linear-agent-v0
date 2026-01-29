/**
 * Agent Plans
 *
 * Generates checklist-style plans for Linear's Activity Timeline.
 * Agent Plans are displayed as expandable checklists with progress indication.
 *
 * @see https://linear.app/developers/agent-interaction#agent-plans
 */

import { getAgentLinearClient } from './linear-oauth.js';

/**
 * Generate a standard UI generation plan
 *
 * @param {Object} options
 * @param {boolean} options.hasRepo - Whether repo was detected
 * @param {boolean} options.needsSelection - Whether user needs to select repo
 * @returns {Array<{text: string, state: string}>}
 */
export function generateUIGenerationPlan({ hasRepo = false, needsSelection = false }) {
    const steps = [
        { text: 'Analyze issue requirements', state: 'COMPLETED' },
    ];

    if (needsSelection) {
        steps.push({ text: 'Wait for repository selection', state: 'CURRENT' });
        steps.push({ text: 'Import repository context', state: 'PENDING' });
    } else if (hasRepo) {
        steps.push({ text: 'Import repository context', state: 'CURRENT' });
    }

    steps.push(
        { text: 'Generate UI components with V0', state: hasRepo ? 'PENDING' : 'CURRENT' },
        { text: 'Review generated code', state: 'PENDING' },
        { text: 'Deploy preview to Vercel', state: 'PENDING' }
    );

    return steps;
}

/**
 * Create an Agent Plan activity in Linear
 *
 * @param {Object} params
 * @param {string} params.sessionId - Agent session ID
 * @param {Array<{text: string, state: string}>} params.steps - Plan steps
 * @param {string} [params.title] - Optional plan title
 */
export async function createAgentPlan({ sessionId, steps, title = 'UI Generation Plan' }) {
    const linearClient = getAgentLinearClient();

    await linearClient.createAgentActivity({
        agentSessionId: sessionId,
        content: {
            type: 'plan',
            title,
            steps: steps.map((step) => ({
                text: step.text,
                state: step.state, // PENDING | CURRENT | COMPLETED | FAILED
            })),
        },
    });
}

/**
 * Update an existing plan's step states
 *
 * @param {Object} params
 * @param {string} params.sessionId - Agent session ID
 * @param {Array<{text: string, state: string}>} params.steps - Updated steps
 * @param {string} [params.title] - Plan title (must match original)
 */
export async function updateAgentPlan({ sessionId, steps, title = 'UI Generation Plan' }) {
    // Agent Plans are updated by emitting a new plan with the same title
    await createAgentPlan({ sessionId, steps, title });
}

/**
 * Mark step as current (in progress)
 *
 * @param {Array} steps - Current steps array
 * @param {number} index - Step index to mark as current
 * @returns {Array} Updated steps
 */
export function markStepCurrent(steps, index) {
    return steps.map((step, i) => ({
        ...step,
        state: i < index ? 'COMPLETED' : i === index ? 'CURRENT' : 'PENDING',
    }));
}

/**
 * Mark step as completed
 *
 * @param {Array} steps - Current steps array
 * @param {number} index - Step index to mark complete
 * @returns {Array} Updated steps
 */
export function markStepCompleted(steps, index) {
    return steps.map((step, i) => ({
        ...step,
        state: i <= index ? 'COMPLETED' : step.state,
    }));
}

/**
 * Mark step as failed
 *
 * @param {Array} steps - Current steps array
 * @param {number} index - Step index that failed
 * @returns {Array} Updated steps
 */
export function markStepFailed(steps, index) {
    return steps.map((step, i) => ({
        ...step,
        state: i === index ? 'FAILED' : step.state,
    }));
}
