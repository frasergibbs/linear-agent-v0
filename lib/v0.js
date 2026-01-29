/**
 * V0 Platform API Integration
 *
 * Uses the official v0-sdk to generate UI components via V0's Platform API.
 * V0 specializes in Next.js 14+ App Router with Tailwind CSS + shadcn/ui.
 *
 * @see V0_PLATFORM_SPEC.md for API reference
 */

import { v0 } from 'v0-sdk';

/** @type {Map<string, { chatId: string, projectId: string, latestVersionId?: string }>} */
const sessionStore = new Map();

/**
 * Create a new V0 chat session for UI component generation
 *
 * @param {Object} params
 * @param {string} params.prompt - Natural language description of UI to generate
 * @param {string} [params.system] - System context/instructions
 * @param {string} [params.projectId] - Optional V0 project ID
 * @param {'sync'|'async'|'experimental_stream'} [params.responseMode='async'] - Response mode
 * @returns {Promise<{ chatId: string, demoUrl: string, files: Array, chatUrl: string }>}
 */
export async function createV0Session({ prompt, system, projectId, responseMode = 'async' }) {
    const options = {
        message: prompt,
        config: {
            responseMode,
        },
    };

    if (system) options.system = system;
    if (projectId) options.projectId = projectId;

    const chat = await v0.chats.create(options);

    // Store session for multi-turn conversations
    sessionStore.set(chat.id, {
        chatId: chat.id,
        projectId: chat.project?.id,
        latestVersionId: chat.latestVersion?.id,
    });

    return {
        chatId: chat.id,
        demoUrl: chat.demo || `https://v0.dev/chat/${chat.id}`,
        chatUrl: `https://v0.dev/chat/${chat.id}`,
        files: chat.files || [],
        latestVersionId: chat.latestVersion?.id,
    };
}

/**
 * Initialize a V0 chat from an existing GitHub repository
 *
 * @param {Object} params
 * @param {string} params.repoUrl - GitHub repository URL
 * @param {string} [params.projectId] - Optional V0 project ID
 * @returns {Promise<{ chatId: string, demoUrl: string, chatUrl: string }>}
 */
export async function initFromRepo({ repoUrl, projectId }) {
    const options = {
        type: 'repo',
        repo: { url: repoUrl },
    };

    if (projectId) options.projectId = projectId;

    const chat = await v0.chats.init(options);

    sessionStore.set(chat.id, {
        chatId: chat.id,
        projectId: chat.project?.id,
        latestVersionId: chat.latestVersion?.id,
    });

    return {
        chatId: chat.id,
        demoUrl: chat.demo,
        chatUrl: `https://v0.dev/chat/${chat.id}`,
    };
}

/**
 * Continue an existing V0 chat session with follow-up message
 *
 * @param {Object} params
 * @param {string} params.chatId - Existing V0 chat ID
 * @param {string} params.message - Follow-up message/refinement
 * @returns {Promise<{ chatId: string, files: Array, latestVersionId: string }>}
 */
export async function continueV0Session({ chatId, message }) {
    const response = await v0.chats.sendMessage({
        chatId,
        message,
    });

    const session = sessionStore.get(chatId);
    if (session) {
        session.latestVersionId = response.latestVersion?.id;
    }

    return {
        chatId,
        files: response.files || [],
        latestVersionId: response.latestVersion?.id,
    };
}

/**
 * Create a deployment for a V0 chat to Vercel
 *
 * @param {Object} params
 * @param {string} params.chatId - V0 chat ID
 * @param {string} [params.projectId] - V0 project ID (uses stored session if not provided)
 * @param {string} [params.versionId] - Version to deploy (uses latest if not provided)
 * @returns {Promise<{ deploymentUrl: string, deploymentId: string }>}
 */
export async function deployToVercel({ chatId, projectId, versionId }) {
    const session = sessionStore.get(chatId);

    const deployment = await v0.deployments.create({
        projectId: projectId || session?.projectId,
        chatId,
        versionId: versionId || session?.latestVersionId,
    });

    return {
        deploymentUrl: deployment.url,
        deploymentId: deployment.id,
    };
}

/**
 * Create or find a V0 project
 *
 * @param {Object} params
 * @param {string} params.name - Project name
 * @param {string} [params.description] - Project description
 * @param {string} [params.vercelProjectId] - Link to existing Vercel project
 * @returns {Promise<{ projectId: string, name: string }>}
 */
export async function createOrFindProject({ name, description, vercelProjectId }) {
    // First try to find existing project
    const projects = await v0.projects.find();
    const existing = projects.find((p) => p.name === name);

    if (existing) {
        return { projectId: existing.id, name: existing.name };
    }

    // Create new project
    const options = { name };
    if (description) options.description = description;
    if (vercelProjectId) options.vercelProjectId = vercelProjectId;

    const project = await v0.projects.create(options);

    return { projectId: project.id, name: project.name };
}

/**
 * Get stored session data
 *
 * @param {string} chatId - V0 chat ID
 * @returns {{ chatId: string, projectId?: string, latestVersionId?: string } | undefined}
 */
export function getSessionData(chatId) {
    return sessionStore.get(chatId);
}

/**
 * Clear stored session data
 *
 * @param {string} chatId - V0 chat ID
 */
export function clearSession(chatId) {
    sessionStore.delete(chatId);
}

/**
 * Format a Linear issue into a V0-optimized prompt
 *
 * @param {Object} issue - Linear issue object
 * @param {string} issue.title - Issue title
 * @param {string} [issue.description] - Issue description
 * @param {Array<string>} [issue.labels] - Issue labels
 * @returns {string} V0-optimized prompt
 */
export function formatIssueForV0Prompt(issue) {
    const { title, description, labels = [] } = issue;

    // Extract UI-relevant labels
    const darkMode = labels.some((l) => l.toLowerCase().includes('dark'));
    const responsive = labels.some((l) => l.toLowerCase().includes('responsive'));
    const a11y = labels.some(
        (l) => l.toLowerCase().includes('a11y') || l.toLowerCase().includes('accessibility')
    );

    let prompt = `# Component Request: ${title}\n\n`;

    if (description) {
        prompt += `## Requirements\n${description}\n\n`;
    }

    // Design requirements from labels
    if (darkMode || responsive || a11y) {
        prompt += `## Design Requirements\n`;
        if (darkMode) prompt += `- Dark mode support with proper color schemes\n`;
        if (responsive) prompt += `- Fully responsive (mobile, tablet, desktop)\n`;
        if (a11y) prompt += `- WCAG 2.1 AA accessibility compliance\n`;
        prompt += `\n`;
    }

    return prompt;
}

/**
 * Determine V0 model tier based on issue complexity
 *
 * @param {number} complexity - Complexity level 1-5
 * @returns {'mini'|'pro'|'max'} V0 model tier
 */
export function getModelTier(complexity) {
    if (complexity <= 2) return 'mini';
    if (complexity === 3) return 'pro';
    return 'max';
}
