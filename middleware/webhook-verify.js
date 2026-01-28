import crypto from 'crypto';

/**
 * Webhook signature verification middleware for Linear
 * 
 * Validates webhook requests using HMAC-SHA256 signature
 * https://developers.linear.app/docs/graphql/webhooks#signature-verification
 */

/**
 * Middleware to verify Linear webhook signatures
 * 
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
export function verifyLinearWebhook(req, res, next) {
    const secret = process.env.LINEAR_WEBHOOK_SECRET;

    if (!secret) {
        console.error('LINEAR_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get signature from header
    const signature = req.headers['linear-signature'];

    if (!signature) {
        console.warn('Missing linear-signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        // Compute expected signature
        const body = JSON.stringify(req.body);
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(body);
        const expectedSignature = hmac.digest('hex');

        // Compare signatures (timing-safe)
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) {
            console.warn('Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // Signature valid - proceed
        next();
    } catch (error) {
        console.error('Webhook verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
}

/**
 * Extract webhook event type and action from Linear payload
 * 
 * @param {Object} payload - Linear webhook payload
 * @returns {{type: string, action: string, data: Object}}
 */
export function parseLinearWebhook(payload) {
    const { type, action, data } = payload;

    return {
        type,        // e.g., 'Issue', 'Comment'
        action,      // e.g., 'create', 'update', 'remove'
        data,        // Event-specific data
        webhookId: payload.webhookId,
        createdAt: payload.createdAt
    };
}
