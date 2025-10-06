import { info, error as logError } from '../utils/logger.js';

/**
 * Health Check Endpoint
 * GET /api/health
 * 
 * Returns system status and checks all critical services
 * No authentication required
 */

export default async function handler(req, res) {
    const startTime = Date.now();

    try {
        info('Health check requested');

        // System checks
        const checks = {
            server: checkServerHealth(),
            environment: checkEnvironmentVariables(),
            memory: checkMemoryUsage(),
            timestamp: new Date().toISOString(),
        };

        // Determine overall health status
        const allHealthy = Object.values(checks).every(
            (check) => check.status === 'healthy' || check.status === undefined
        );

        const response = {
            success: true,
            status: allHealthy ? 'healthy' : 'degraded',
            version: '1.0.0',
            uptime: `${Math.floor(process.uptime())}s`,
            responseTime: `${Date.now() - startTime}ms`,
            checks,
            endpoints: {
                available: [
                    'GET /api/health',
                    'POST /api/auth/login',
                    'GET /api/auth/verify',
                    'POST /api/auth/logout',
                    'GET /api/guests',
                    'POST /api/guests/search',
                    'POST /api/guests/check-in',
                    'POST /api/guests/undo-check-in',
                    'POST /api/guests/bulk-check-in',
                    'GET /api/admin/stats',
                    'GET /api/admin/audit-log',
                    'GET /api/admin/ushers',
                    'PUT /api/admin/ushers/:id',
                    'POST /api/sync/queue',
                    'GET /api/sync/status',
                ],
            },
        };

        info('Health check completed', {
            status: response.status,
            responseTime: response.responseTime
        });

        return res.status(allHealthy ? 200 : 503).json(response);

    } catch (err) {
        logError('Health check failed', err);

        return res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: 'Health check failed',
            message: err.message,
            timestamp: new Date().toISOString(),
        });
    }
}

/**
 * Check server basic health
 */
function checkServerHealth() {
    return {
        status: 'healthy',
        message: 'Server is running',
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
    };
}

/**
 * Check if required environment variables are set
 */
function checkEnvironmentVariables() {
    const requiredVars = [
        'DATABASE_URL',
        'JWT_SECRET',
        'FRONTEND_URL',
    ];

    const missing = requiredVars.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
        return {
            status: 'unhealthy',
            message: 'Missing required environment variables',
            missing,
        };
    }

    return {
        status: 'healthy',
        message: 'All environment variables configured',
        configured: requiredVars.length,
    };
}

/**
 * Check memory usage
 */
function checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const percentUsed = Math.round((usedMB / totalMB) * 100);

    return {
        status: percentUsed > 90 ? 'warning' : 'healthy',
        message: `Memory usage: ${percentUsed}%`,
        heapUsed: `${usedMB}MB`,
        heapTotal: `${totalMB}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`,
    };
}