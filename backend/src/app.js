/**
 * Express Application Configuration
 * Main app setup and middleware configuration
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();

// Security Middleware
app.use(helmet());

// CORS Configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.FRONTEND_PROD_URL || 'https://itsm.madison88.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key']
};

app.use(cors(corsOptions));

// Compression
app.use(compression());

// Request Logging
app.use(morgan('combined'));

// Body Parser Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  skip: (req) => req.path === '/health' || process.env.NODE_ENV !== 'production'
});

app.use('/api/', apiLimiter);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/config', require('./routes/config.routes'));
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/tickets', require('./routes/tickets.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/kb', require('./routes/knowledgebase.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/sla-rules', require('./routes/sla.routes'));
app.use('/api/bi', require('./routes/bi.routes'));
app.use('/api/audit', require('./routes/audit.routes'));
app.use('/api/ticket-templates', require('./routes/ticket-templates.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Placeholder routes - to be implemented
const { adminRouter, teamsRouter, changesRouter, assetsRouter } = require('./routes/placeholder.routes');
app.use('/api/admin', adminRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/changes', require('./routes/changes.routes'));
app.use('/api/assets', require('./routes/assets.routes'));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error Handler Middleware - map service errors to correct HTTP status
app.use((err, req, res, next) => {
  let status = err.status;
  const message = err.message || 'Internal Server Error';
  if (status == null) {
    const lower = message.toLowerCase();
    if (lower.includes('forbidden') || lower.includes('insufficient permissions')) status = 403;
    else if (lower.includes('not found')) status = 404;
    else if (lower.includes('required') || lower.includes('invalid') || lower.includes('validation') || lower.includes('must be')) status = 400;
    else if (lower.includes('already exists') || lower.includes('duplicate') || lower.includes('pending') && lower.includes('override')) status = 409;
    else status = 500;
  }

  console.error('Error:', {
    status,
    message,
    stack: err.stack,
    url: req.originalUrl
  });

  res.status(status).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const db = require('./config/database');
app.set('db', db);

let redisClient;
try {
  redisClient = require('./config/redis');
} catch {
  redisClient = null;
}
app.set('redis', redisClient);

module.exports = app;
