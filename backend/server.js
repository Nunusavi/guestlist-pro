import express from 'express';
import dotenv from 'dotenv';
import { info, error as logError, logRequest, logResponse } from './utils/logger.js';

// Load environment variables BEFORE importing modules that use them
dotenv.config();

// Middleware
import corsMiddleware from './api/services/cors.js';
import rateLimitMiddleware from './api/middleware/rateLimit.js';
import { authenticate } from './api/middleware/authenticate.js';

// Route handlers - Health & Debug
import healthHandler from './api/health.js';
import testDbHandler from './api/test-db.js';
import debugDbHandler from './api/debug-db.js';

// Route handlers - Auth
import loginHandler from './api/auth/login.js';
import verifyHandler from './api/auth/verify.js';
import logoutHandler from './api/auth/logout.js';

// Route handlers - Guest Read Operations (Batch 5)
import guestListHandler from './api/guests/list.js';
import guestSearchHandler from './api/guests/search.js';
import guestGetByIdHandler from './api/guests/get-by-id.js';

// Route handlers - Guest Check-In Operations (Batch 6)
import guestCheckInHandler from './api/guests/check-in.js';
import guestUndoCheckInHandler from './api/guests/undo-check-in.js';
import guestBulkCheckInHandler from './api/guests/bulk-check-in.js';

// Route handlers - Admin Statistics & Export (Batch 7)
import adminStatsHandler from './api/admin/stats.js';
import adminAuditLogHandler from './api/admin/audit-log.js';
import adminExportHandler from './api/admin/export.js';

// Route handlers - Admin User Management (Batch 8)
import adminUsherListHandler from './api/admin/ushers/list.js';
import adminUsherUpdateHandler from './api/admin/ushers/update.js';
import adminUsherCreateHandler from './api/admin/ushers/create.js';
import adminUsherDeleteHandler from './api/admin/ushers/delete.js';

// Validate critical env vars (warn only to avoid crash in early setup)
const requiredEnv = ['JWT_SECRET'];
for (const key of requiredEnv) {
    if (!process.env[key]) {
        logError(`Missing required environment variable: ${key}`);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Global Middleware =====
app.use(corsMiddleware);            // CORS
app.use(rateLimitMiddleware);       // Rate limiting
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const startTime = Date.now();
    logRequest(req);
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        logResponse(req, res.statusCode, duration);
    });
    next();
});

// ===== Public Routes =====
app.get('/api/health', async (req, res) => {
    try { await healthHandler(req, res); }
    catch (err) { logError('Health check error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.get('/api/test-db', async (req, res) => {
    try { await testDbHandler(req, res); }
    catch (err) { logError('Test database error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.get('/api/debug-db', async (req, res) => {
    try { await debugDbHandler(req, res); }
    catch (err) { logError('Debug database error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// ===== Auth Routes =====
app.post('/api/auth/login', async (req, res) => {
    try { await loginHandler(req, res); }
    catch (err) { logError('Login error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.get('/api/auth/verify', authenticate, async (req, res) => {
    try { await verifyHandler(req, res); }
    catch (err) { logError('Verify error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/auth/logout', authenticate, async (req, res) => {
    try { await logoutHandler(req, res); }
    catch (err) { logError('Logout error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// ===== Guest Read Operations (Batch 5) - Protected =====
app.get('/api/guests', authenticate, async (req, res) => {
    try { await guestListHandler(req, res); }
    catch (err) { logError('Guest list error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/guests/search', authenticate, async (req, res) => {
    try { await guestSearchHandler(req, res); }
    catch (err) { logError('Guest search error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.get('/api/guests/:id', authenticate, async (req, res) => {
    try {
        // Extract ID from params and put in query for handler
        req.query.id = req.params.id;
        await guestGetByIdHandler(req, res);
    }
    catch (err) { logError('Guest get by ID error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// ===== Guest Check-In Operations (Batch 6) - Protected =====
app.post('/api/guests/check-in', authenticate, async (req, res) => {
    try { await guestCheckInHandler(req, res); }
    catch (err) { logError('Guest check-in error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/guests/undo-check-in', authenticate, async (req, res) => {
    try { await guestUndoCheckInHandler(req, res); }
    catch (err) { logError('Guest undo check-in error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/guests/bulk-check-in', authenticate, async (req, res) => {
    try { await guestBulkCheckInHandler(req, res); }
    catch (err) { logError('Guest bulk check-in error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// ===== Admin Statistics & Export (Batch 7) - Admin Only =====
app.get('/api/admin/stats', authenticate, async (req, res) => {
    try { await adminStatsHandler(req, res); }
    catch (err) { logError('Admin stats error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.get('/api/admin/audit-log', authenticate, async (req, res) => {
    try { await adminAuditLogHandler(req, res); }
    catch (err) { logError('Admin audit log error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/admin/export', authenticate, async (req, res) => {
    try { await adminExportHandler(req, res); }
    catch (err) { logError('Admin export error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// ===== Admin User Management (Batch 8) - Admin Only =====
app.get('/api/admin/ushers', authenticate, async (req, res) => {
    try { await adminUsherListHandler(req, res); }
    catch (err) { logError('Admin usher list error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.post('/api/admin/ushers', authenticate, async (req, res) => {
    try { await adminUsherCreateHandler(req, res); }
    catch (err) { logError('Admin usher create error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.put('/api/admin/ushers/:id', authenticate, async (req, res) => {
    try {
        // Extract ID from params and put in query for handler
        req.query.id = req.params.id;
        await adminUsherUpdateHandler(req, res);
    }
    catch (err) { logError('Admin usher update error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

app.delete('/api/admin/ushers/:id', authenticate, async (req, res) => {
    try {
        // Extract ID from params and put in query for handler
        req.query.id = req.params.id;
        await adminUsherDeleteHandler(req, res);
    }
    catch (err) { logError('Admin usher delete error', err); res.status(500).json({ success: false, error: 'Internal server error', message: err.message }); }
});

// Root
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'GuestList Pro API',
        version: '1.0.0',
        docs: '/api/health',
        endpoints: {
            public: [
                'GET /',
                'GET /api/health',
                'GET /api/test-db',
                'GET /api/debug-db'
            ],
            auth: [
                'POST /api/auth/login',
                'GET /api/auth/verify (protected)',
                'POST /api/auth/logout (protected)'
            ],
            guests: [
                'GET /api/guests (protected)',
                'POST /api/guests/search (protected)',
                'GET /api/guests/:id (protected)',
                'POST /api/guests/check-in (protected)',
                'POST /api/guests/undo-check-in (protected)',
                'POST /api/guests/bulk-check-in (protected)'
            ],
            admin: [
                'GET /api/admin/stats (admin only)',
                'GET /api/admin/audit-log (admin only)',
                'POST /api/admin/export (admin only)',
                'GET /api/admin/ushers (admin only)',
                'POST /api/admin/ushers (admin only)',
                'PUT /api/admin/ushers/:id (admin only)',
                'DELETE /api/admin/ushers/:id (admin only)'
            ]
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Route ${req.method} ${req.url} not found`,
        hint: 'Visit GET / for list of available endpoints'
    });
});

// Global error handler (final)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logError('Unhandled error', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.name || 'Internal Server Error',
        message: err.message || 'Something went wrong',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server only if not imported (e.g., tests)
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        info(`🚀 GuestList Pro API running on port ${PORT}`);
        info(`📍 Health check: http://localhost:${PORT}/api/health`);
        info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        info(`🔗 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
        info(`🛡️  Rate limit: ${process.env.RATE_LIMIT_MAX || 100} requests per ${process.env.RATE_LIMIT_WINDOW || 60000}ms`);
        info(`✅ Guest management endpoints loaded (Batches 5 & 6)`);
        info(`✅ Admin endpoints loaded (Batches 7 & 8)`);
    });

    // Graceful shutdown
    const shutdown = (signal) => {
        info(`${signal} received, shutting down gracefully`);
        process.exit(0);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;