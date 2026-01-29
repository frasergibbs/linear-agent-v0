/**
 * Session Storage
 *
 * Persistent storage for V0 chat sessions to enable multi-turn conversations.
 * In production, this would use Redis or a database.
 *
 * Maps Linear session IDs to V0 chat data.
 */

/** @type {Map<string, SessionData>} */
const sessionStore = new Map();

/**
 * @typedef {Object} SessionData
 * @property {string} linearSessionId - Linear agent session ID
 * @property {string} chatId - V0 chat ID
 * @property {string} [projectId] - V0 project ID
 * @property {string} [latestVersionId] - Latest V0 version ID
 * @property {string} [chatUrl] - V0 chat URL
 * @property {string} [deploymentUrl] - Vercel deployment URL
 * @property {string} [repoUrl] - Associated GitHub repo
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * Store a new session
 *
 * @param {Object} params
 * @param {string} params.linearSessionId - Linear agent session ID
 * @param {string} params.chatId - V0 chat ID
 * @param {string} [params.projectId] - V0 project ID
 * @param {string} [params.chatUrl] - V0 chat URL
 * @param {string} [params.repoUrl] - GitHub repository URL
 */
export function storeSession({ linearSessionId, chatId, projectId, chatUrl, repoUrl }) {
    const now = new Date().toISOString();
    sessionStore.set(linearSessionId, {
        linearSessionId,
        chatId,
        projectId,
        chatUrl,
        repoUrl,
        createdAt: now,
        updatedAt: now,
    });
    console.log(`📦 Session stored: ${linearSessionId} -> ${chatId}`);
}

/**
 * Get session by Linear session ID
 *
 * @param {string} linearSessionId - Linear agent session ID
 * @returns {SessionData | undefined}
 */
export function getSession(linearSessionId) {
    return sessionStore.get(linearSessionId);
}

/**
 * Update session data
 *
 * @param {string} linearSessionId - Linear agent session ID
 * @param {Partial<SessionData>} updates - Fields to update
 */
export function updateSession(linearSessionId, updates) {
    const existing = sessionStore.get(linearSessionId);
    if (existing) {
        sessionStore.set(linearSessionId, {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
        });
        console.log(`📦 Session updated: ${linearSessionId}`);
    }
}

/**
 * Delete session
 *
 * @param {string} linearSessionId - Linear agent session ID
 */
export function deleteSession(linearSessionId) {
    sessionStore.delete(linearSessionId);
    console.log(`📦 Session deleted: ${linearSessionId}`);
}

/**
 * Check if session exists
 *
 * @param {string} linearSessionId - Linear agent session ID
 * @returns {boolean}
 */
export function hasSession(linearSessionId) {
    return sessionStore.has(linearSessionId);
}

/**
 * Get all sessions (for debugging)
 *
 * @returns {SessionData[]}
 */
export function getAllSessions() {
    return Array.from(sessionStore.values());
}
