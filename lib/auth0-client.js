/**
 * Auth0 Management API Client
 * 
 * Fetches Linear Personal Access Tokens from Auth0 user metadata.
 * Users manually add their Linear PAT to their Auth0 profile:
 * 
 * Auth0 Dashboard → Users → [user] → Metadata → user_metadata:
 * {
 *   "linear_access_token": "lin_api_..."
 * }
 */

import { ManagementClient } from 'auth0';

/**
 * Initialize Auth0 Management API client
 * Requires Machine-to-Machine application with read:users scope
 */
const auth0 = new ManagementClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
    clientSecret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
});

/**
 * Get Linear token for a user by their email address
 * 
 * @param {string} email - User's email address (from Linear webhook)
 * @returns {Promise<string>} - Linear Personal Access Token
 * @throws {Error} - If user not found or token not configured
 */
export async function getLinearTokenForUser(email) {
    if (!email) {
        throw new Error('Email is required to fetch Linear token');
    }

    try {
        // Fetch user by email from Auth0
        const users = await auth0.getUsersByEmail(email);

        if (!users || users.length === 0) {
            throw new Error(
                `User with email ${email} not found in Auth0. ` +
                `User must be added to Auth0 before using V0 Linear Agent.`
            );
        }

        // Get first matching user
        const user = users[0];

        // Extract Linear token from user metadata
        const linearToken = user.user_metadata?.linear_access_token;

        if (!linearToken) {
            throw new Error(
                `User ${email} has not added Linear token to Auth0 profile. ` +
                `Please add 'linear_access_token' to user_metadata in Auth0 Dashboard.`
            );
        }

        console.log(`✅ Retrieved Linear token for user: ${email}`);
        return linearToken;

    } catch (error) {
        // Enhance error message for common issues
        if (error.statusCode === 401) {
            throw new Error(
                'Auth0 credentials invalid. Check AUTH0_MANAGEMENT_CLIENT_ID and AUTH0_MANAGEMENT_CLIENT_SECRET.'
            );
        }

        if (error.statusCode === 403) {
            throw new Error(
                'Auth0 Management API access denied. Ensure the application has "read:users" scope.'
            );
        }

        // Re-throw with original message
        throw error;
    }
}

/**
 * Validate Auth0 configuration on server startup
 * 
 * @returns {Promise<boolean>} - True if configuration is valid
 */
export async function validateAuth0Config() {
    const requiredVars = [
        'AUTH0_DOMAIN',
        'AUTH0_MANAGEMENT_CLIENT_ID',
        'AUTH0_MANAGEMENT_CLIENT_SECRET'
    ];

    const missing = requiredVars.filter(v => !process.env[v]);

    if (missing.length > 0) {
        console.error(`❌ Missing required Auth0 environment variables: ${missing.join(', ')}`);
        return false;
    }

    try {
        // Test Auth0 connection by fetching a client grant
        await auth0.getClientGrants({ audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/` });
        console.log('✅ Auth0 Management API connection successful');
        return true;
    } catch (error) {
        console.error('❌ Auth0 Management API connection failed:', error.message);
        return false;
    }
}
