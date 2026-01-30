/**
 * Agent Plans
 *
 * Generates checklist-style plans for Linear's Activity Timeline.
 * Agent Plans are managed via agentSessionUpdate mutation, NOT agentActivityCreate.
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
        { text: 'Analyze issue requirements', state: 'completed' },
    ];

    if (needsSelection) {
        steps.push({ text: 'Wait for repository selection', state: 'inProgress' });
        steps.push({ text: 'Import repository context', state: 'pending' });
    } else if (hasRepo) {
        steps.push({ text: 'Import repository context', state: 'inProgress' });
    }

    steps.push(
        { text: 'Generate UI components with V0', state: hasRepo ? 'pending' : 'inProgress' },
        { text: 'Review generated code', state: 'pending' },
        { text: 'Deploy preview to Vercel', state: 'pending' }
    );

    return steps;
}

/**
 * Create or update an Agent Plan in Linear
 *
 * Agent Plans are managed via agentSessionUpdate, not agentActivityCreate.
 * The plan field accepts an array of {content, status} objects.
 *
 * @param {Object} params
 * @param {string} params.sessionId - Agent session ID
 * @param {Array<{text: string, state: string}>} params.steps - Plan steps
 */
export async function createAgentPlan({ sessionId, steps }) {
    const linearClient = getAgentLinearClient();

    // Agent Plans use updateAgentSession with plan field
    // Status values: pending | inProgress | completed | canceled
    await linearClient.updateAgentSession(sessionId, {
        plan: steps.map((step) => ({
            content: step.text,
            status: step.state,
        })),
    });
}

/**
 * Update an existing plan's step states
 *
 * @param {Object} params
 * @param {string} params.sessionId - Agent session ID
 * @param {Array<{text: string, state: string}>} params.steps - Updated steps (full replacement)
 */
export async function updateAgentPlan({ sessionId, steps }) {
    // Agent Plans require full array replacement on update
    await createAgentPlan({ sessionId, steps });
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
        state: i < index ? 'completed' : i === index ? 'inProgress' : 'pending',
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
        state: i <= index ? 'completed' : step.state,
    }));
}

/**
 * Mark step as failed (canceled in Linear API terms)
 *
 * @param {Array} steps - Current steps array
 * @param {number} index - Step index that failed
 * @returns {Array} Updated steps
 */
export function markStepFailed(steps, index) {
    return steps.map((step, i) => ({
        ...step,
        state: i === index ? 'canceled' : step.state,
    }));
}
