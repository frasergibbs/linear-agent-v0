import 'dotenv/config';
import express from 'express';
import { verifyLinearWebhook } from './middleware/webhook-verify.js';
import { handleLinearWebhook } from './lib/linear-webhook.js';

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
        service: 'linear-agent-v0',
        timestamp: new Date().toISOString()
    });
});

/**
 * Linear webhook endpoint
 * 
 * Receives webhooks from Linear for:
 * - Issue.update (agent assignment)
 * - Comment.create (@v0 mentions)
 */
app.post('/webhook/linear', verifyLinearWebhook, async (req, res) => {
    try {
        const result = await handleLinearWebhook(req.body);

        res.json({
            success: result.success,
            message: result.message,
            ...(result.chatId && { chatId: result.chatId }),
            ...(result.demoUrl && { demoUrl: result.demoUrl })
        });
    } catch (error) {
        console.error('Webhook handler error:', error);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Start server
 */
app.listen(PORT, () => {
    console.log(`🚀 V0 Linear Agent listening on port ${PORT}`);
    console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook/linear`);
    console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});
