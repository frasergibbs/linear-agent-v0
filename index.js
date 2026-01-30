import express from 'express';
import 'dotenv/config';
import { verifyLinearWebhook } from './middleware/webhook-verify.js';
import { handleLinearWebhook } from './lib/linear-webhook.js';
import {
    getAuthorizationUrl,
    exchangeCodeForToken,
    verifyState
} from './lib/linear-oauth.js';

const app = express();
const PORT = process.env.PORT || 3324;

// Middleware
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'v0-linear-agent',
        timestamp: new Date().toISOString()
    });
});

/**
 * OAuth Installation Flow
 */

// Step 1: Admin initiates installation
app.get('/auth/install', (req, res) => {
    try {
        const authUrl = getAuthorizationUrl();
        res.redirect(authUrl);
    } catch (error) {
        console.error('Failed to generate auth URL:', error);
        res.status(500).json({
            error: 'OAuth configuration error',
            message: error.message
        });
    }
});

// Step 2: Linear redirects back with authorization code
app.get('/auth/callback', async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
        console.error('OAuth error:', error, error_description);
        return res.status(400).send(`
      <h1>Installation Failed</h1>
      <p>Error: ${error}</p>
      <p>Description: ${error_description || 'No description provided'}</p>
    `);
    }

    // Verify CSRF state
    if (!verifyState(state)) {
        return res.status(400).send('<h1>Invalid state parameter (CSRF check failed)</h1>');
    }

    try {
        // Exchange code for access token
        const { accessToken, agentUserId, agentName, workspaceId } = await exchangeCodeForToken(code);

        console.log('✅ Agent installed successfully!');
        console.log('Agent User ID:', agentUserId);
        console.log('Agent Name:', agentName);
        console.log('Workspace ID:', workspaceId);

        // In production, store these in a database
        // For now, display them for manual .env configuration
        res.send(`
      <h1>🎉 V0 Agent Installed!</h1>
      <p><strong>Agent successfully installed in your Linear workspace.</strong></p>
      <h2>Configuration</h2>
      <p>Add these to your <code>.env</code> file on rainworth-server:</p>
      <pre>
LINEAR_ACCESS_TOKEN=${accessToken}
LINEAR_V0_AGENT_USER_ID=${agentUserId}
      </pre>
      <p><strong>Next steps:</strong></p>
      <ol>
        <li>SSH to rainworth-server</li>
        <li>Edit <code>/home/fraser/services/linear-agent-v0/.env</code></li>
        <li>Add the values above</li>
        <li>Restart service: <code>sudo systemctl restart linear-agent-v0</code></li>
        <li>Assign an issue to <strong>${agentName}</strong> to test!</li>
      </ol>
    `);
    } catch (error) {
        console.error('Token exchange failed:', error);
        res.status(500).send(`
      <h1>Installation Error</h1>
      <p>Failed to complete installation: ${error.message}</p>
    `);
    }
});

/**
 * Linear Webhook Endpoint
 */
app.post('/webhook/linear', verifyLinearWebhook, async (req, res) => {
    try {
        // Debug: log raw payload structure
        console.log('📦 Raw webhook payload:', JSON.stringify(req.body, null, 2));

        await handleLinearWebhook(req.body);
        res.status(200).json({ received: true });
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            error: 'Webhook processing failed',
            message: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 V0 Linear Agent listening on port ${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/linear`);
    console.log(`🔐 OAuth install: http://localhost:${PORT}/auth/install`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});
