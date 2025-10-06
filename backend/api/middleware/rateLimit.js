import { info, warn } from '../../utils/logger.js';

/**
 * Rate Limiting Middleware
 * Limits requests per IP address
 */

class RateLimiter {
    constructor() {
        this.requests = new Map();
        this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX) || 100;
        this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW) || 60000; // 1 minute

        // Clean up old entries every minute
        setInterval(() => this.cleanup(), 60000);
    }

    /**
     * Check if request should be rate limited
     * @param {string} identifier - IP address or user ID
     * @returns {object} Rate limit info
     */
    checkLimit(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];

        // Remove old requests outside the time window
        const validRequests = userRequests.filter(
            timestamp => now - timestamp < this.windowMs
        );

        // Check if limit exceeded
        if (validRequests.length >= this.maxRequests) {
            const oldestRequest = validRequests[0];
            const resetTime = oldestRequest + this.windowMs;
            const retryAfter = Math.ceil((resetTime - now) / 1000);

            return {
                allowed: false,
                remaining: 0,
                resetTime,
                retryAfter,
            };
        }

        // Add current request
        validRequests.push(now);
        this.requests.set(identifier, validRequests);

        return {
            allowed: true,
            remaining: this.maxRequests - validRequests.length,
            resetTime: now + this.windowMs,
            retryAfter: 0,
        };
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [identifier, requests] of this.requests.entries()) {
            const validRequests = requests.filter(
                timestamp => now - timestamp < this.windowMs
            );

            if (validRequests.length === 0) {
                this.requests.delete(identifier);
                cleaned++;
            } else {
                this.requests.set(identifier, validRequests);
            }
        }

        if (cleaned > 0) {
            info('Rate limiter cleaned', { entriesRemoved: cleaned });
        }
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            activeUsers: this.requests.size,
            maxRequests: this.maxRequests,
            windowMs: this.windowMs,
        };
    }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit middleware
 */
export function rateLimitMiddleware(req, res, next) {
    // Get client identifier (IP address)
    const identifier =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket.remoteAddress ||
        'unknown';

    // Check rate limit
    const limitInfo = rateLimiter.checkLimit(identifier);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', rateLimiter.maxRequests);
    res.setHeader('X-RateLimit-Remaining', limitInfo.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(limitInfo.resetTime).toISOString());

    if (!limitInfo.allowed) {
        warn('Rate limit exceeded', {
            ip: identifier,
            retryAfter: limitInfo.retryAfter
        });

        res.setHeader('Retry-After', limitInfo.retryAfter);

        return res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${limitInfo.retryAfter} seconds.`,
            retryAfter: limitInfo.retryAfter,
        });
    }

    next();
}

// Export both the middleware and limiter instance
export { rateLimiter };
export default rateLimitMiddleware;