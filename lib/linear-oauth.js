import 'dotenv/config';
import { LinearClient } from '@linear/sdk';

/**
 * Linear OAuth Installation Flow
 * 
 * Handles OAuth 2.0 flow with `actor=app` to install the agent as a workspace app.
 * This creates the agent's identity and obtains an access token for API operations.
 */

/**
 * Build OAuth authorization URL for agent installation
 * 
 * @returns {string} Authorization URL to redirect admin to
 */
export function getAuthorizationUrl() {
    const baseUrl = process.env.BASE_URL || 'https://linear-agent.fraserandsam.com';
    const clientId = process.env.LINEAR_CLIENT_ID;

    if (!clientId) {
        throw new Error('LINEAR_CLIENT_ID environment variable is required');
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${baseUrl}/auth/callback`,
        response_type: 'code',
        // Only documented OAuth scopes for actor=app
        // See: https://linear.app/developers/agents#actor-and-scopes
        scope: 'read,write',
        actor: 'app',  // CRITICAL: Makes this an agent installation, not user auth
        state: generateState()  // CSRF protection
    });

    return `https://linear.app/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * 
 * @param {string} code - Authorization code from callback
 * @returns {Promise<{accessToken: string, agentUserId: string}>}
 */
export async function exchangeCodeForToken(code) {
    const baseUrl = process.env.BASE_URL || 'https://linear-agent.fraserandsam.com';
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET are required');
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${baseUrl}/auth/callback`,
            client_id: clientId,
            client_secret: clientSecret
        })
    });

    if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    const { access_token: accessToken } = await tokenResponse.json();

    // Get agent user ID
    const linearClient = new LinearClient({ accessToken });
    const viewer = await linearClient.viewer;

    return {
        accessToken,
        agentUserId: viewer.id,
        agentName: viewer.name,
        workspaceId: viewer.organization?.id
    };
}

/**
 * Get Linear client for the installed agent
 * 
 * @returns {LinearClient}
 */
export function getAgentLinearClient() {
    const accessToken = process.env.LINEAR_ACCESS_TOKEN;

    if (!accessToken) {
        throw new Error('LINEAR_ACCESS_TOKEN not set. Agent not installed yet. Visit /auth/install');
    }

    return new LinearClient({ accessToken });
}

/**
 * Generate CSRF state token
 */
function generateState() {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
}

/**
 * Verify CSRF state token
 * 
 * @param {string} state - State from callback
 * @returns {boolean}
 */
export function verifyState(state) {
    // In production, store state in session/redis and verify
    // For now, just check it exists
    return state && state.length > 0;
}
