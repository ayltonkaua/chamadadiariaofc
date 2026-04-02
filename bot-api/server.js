/**
 * Bot API Server
 * 
 * Express server with:
 * - API Key authentication
 * - escola_id validation middleware
 * - Rate limiting
 * - Multi-tenant WhatsApp routes
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { validateEscola } = require('./supabase');
const { initCronJobs } = require('./cron');
const { autoStartSessions } = require('./whatsapp');

const manualRoutes = require('./routes/manual');
const alertRoutes = require('./routes/alerts');

const app = express();
const PORT = process.env.PORT || 3002;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.error('❌ API_KEY is required in environment variables');
    process.exit(1);
}

// =====================
// Global Middleware
// =====================

app.use(cors({
    origin: (origin, callback) => {
        // Allow localhost
        if (!origin || origin.includes('localhost')) return callback(null, true);
        // Allow Vercel
        if (origin.includes('vercel.app')) return callback(null, true);
        // Allow custom domain
        if (origin.includes('chamadadiaria.com.br')) return callback(null, true);
        // Allow Render
        if (origin.includes('onrender.com')) return callback(null, true);
        callback(null, false);
    },
    credentials: true,
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        console.log(`${req.method} ${req.path} → ${res.statusCode} (${ms}ms)`);
    });
    next();
});

// =====================
// Simple Rate Limiting
// =====================

const rateLimits = {};
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window

function rateLimitMiddleware(req, res, next) {
    const key = req.headers['x-escola-id'] || req.ip;
    const now = Date.now();

    if (!rateLimits[key]) {
        rateLimits[key] = { count: 1, windowStart: now };
        return next();
    }

    if (now - rateLimits[key].windowStart > RATE_LIMIT_WINDOW) {
        rateLimits[key] = { count: 1, windowStart: now };
        return next();
    }

    rateLimits[key].count++;
    if (rateLimits[key].count > RATE_LIMIT_MAX) {
        return res.status(429).json({
            success: false,
            error: 'Rate limit excedido. Tente novamente em 1 minuto.',
        });
    }

    next();
}

// Cleanup stale rate limit entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(rateLimits)) {
        if (now - rateLimits[key].windowStart > RATE_LIMIT_WINDOW * 2) {
            delete rateLimits[key];
        }
    }
}, 5 * 60 * 1000);

// =====================
// API Key Middleware
// =====================

function apiKeyMiddleware(req, res, next) {
    const key = req.headers['x-api-key'];

    if (!key || key !== API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'API Key inválida ou ausente',
        });
    }

    next();
}

// =====================
// Escola ID Middleware
// =====================

async function escolaIdMiddleware(req, res, next) {
    const escolaId = req.headers['x-escola-id'];

    if (!escolaId) {
        return res.status(400).json({
            success: false,
            error: 'Header x-escola-id é obrigatório',
        });
    }

    // Validate escola exists and is active
    const validation = await validateEscola(escolaId);
    if (!validation.valid) {
        return res.status(403).json({
            success: false,
            error: validation.error,
        });
    }

    // Attach escola_id to request
    req.escolaId = escolaId;
    req.escola = validation.escola;
    next();
}

// =====================
// Health Check (no auth)
// =====================

app.get('/health', (req, res) => {
    res.json({
        name: 'Chamada Diária Bot API',
        version: '1.0.0',
        status: 'online',
        timestamp: new Date().toISOString(),
    });
});

// =====================
// Protected Routes
// =====================

app.use(apiKeyMiddleware);
app.use(rateLimitMiddleware);
app.use(escolaIdMiddleware);

// Mount routes
app.use('/', manualRoutes);
app.use('/', alertRoutes);

// =====================
// 404 Handler
// =====================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint não encontrado',
        path: req.path,
    });
});

// =====================
// Error Handler
// =====================

app.use((err, req, res, _next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Erro interno do servidor',
    });
});

// =====================
// Start Server
// =====================

app.listen(PORT, () => {
    console.log(`\n🤖 Bot API running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log('');

    // Initialize cron jobs
    initCronJobs();

    // Auto-reconnect saved sessions after 10s (give server time to stabilize)
    setTimeout(() => {
        autoStartSessions().catch(err => {
            console.error('❌ Auto-start failed:', err.message);
        });
    }, 10000);
});

