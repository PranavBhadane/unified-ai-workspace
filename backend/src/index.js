import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/env.js';
import { testConnection } from './config/db.js';
import syncManager from './services/sync/syncManager.js';
import geminiService from './services/ai/geminiService.js';
import logger from './utils/logger.js';
import requestIdMiddleware from './middleware/requestId.js';
import errorHandler from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import connectionsRoutes from './routes/connectionsRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import gmailRoutes from './routes/gmailRoutes.js';
import driveRoutes from './routes/driveRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import entitiesRoutes from './routes/entitiesRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import logsRoutes from './routes/logsRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardBuilderRoutes from './routes/dashboardBuilderRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

syncManager.setSocketIO(io);

// Core Middleware
app.use(cors({
  origin: [config.clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(requestIdMiddleware);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  return res.json({
    success: true,
    status: 'online',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    version: '1.0.0',
    requestId: req.requestId
  });
});

// Mount modular routes with module tagging
app.use('/api/auth', (req, res, next) => { req.moduleName = 'auth'; next(); }, authRoutes);
app.use('/api/connections', (req, res, next) => { req.moduleName = 'connections'; next(); }, connectionsRoutes);
app.use('/api/whatsapp', (req, res, next) => { req.moduleName = 'whatsapp'; next(); }, whatsappRoutes);
app.use('/api/gmail', (req, res, next) => { req.moduleName = 'gmail'; next(); }, gmailRoutes);
app.use('/api/drive', (req, res, next) => { req.moduleName = 'drive'; next(); }, driveRoutes);
app.use('/api/ai', (req, res, next) => { req.moduleName = 'ai'; next(); }, aiRoutes);
app.use('/api/entities', (req, res, next) => { req.moduleName = 'entities'; next(); }, entitiesRoutes);
app.use('/api/sync', (req, res, next) => { req.moduleName = 'sync'; next(); }, syncRoutes);
app.use('/api/settings', (req, res, next) => { req.moduleName = 'settings'; next(); }, settingsRoutes);
app.use('/api/dashboard', (req, res, next) => { req.moduleName = 'dashboard'; next(); }, dashboardRoutes);
app.use('/api/dashboards', (req, res, next) => { req.moduleName = 'dashboards'; next(); }, dashboardBuilderRoutes);
app.use('/api/documents', (req, res, next) => { req.moduleName = 'documents'; next(); }, documentRoutes);
app.use('/api/reports', (req, res, next) => { req.moduleName = 'reports'; next(); }, reportRoutes);
app.use('/api/logs', (req, res, next) => { req.moduleName = 'logs'; next(); }, logsRoutes);

// Centralized Error Handler
app.use(errorHandler);

// Socket.IO event handlers
io.on('connection', (socket) => {
  logger.info('socket', 'client_connected', `Socket client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    logger.info('socket', 'client_disconnected', `Socket client disconnected: ${socket.id}`);
  });
});

// Startup logic
async function startServer() {
  const dbTest = await testConnection();
  if (!dbTest.connected) {
    logger.error('system', 'db_connection_failed', `Database connection failed: ${dbTest.error}`);
    process.exit(1);
  }
  logger.info('system', 'db_connected', `Connected to MySQL (${dbTest.version}) database: ${dbTest.database}`);

  // Load persisted AI model and settings from MySQL
  await geminiService.loadPersistedSettings();

  // Recover interrupted sync jobs
  await syncManager.recoverStartup();

  server.listen(config.port, '127.0.0.1', () => {
    logger.info('system', 'server_started', `Backend Server listening on http://127.0.0.1:${config.port} (env: ${config.nodeEnv})`);
    console.log(`=======================================================`);
    console.log(` Unified AI Workspace - Backend Server Running`);
    console.log(` Local URL: http://127.0.0.1:${config.port}`);
    console.log(` Environment: ${config.nodeEnv}`);
    console.log(` Active Gemini Model: ${config.gemini.model}`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  logger.error('system', 'server_fatal', `Server failed to start: ${err.message}`, { error: err });
  process.exit(1);
});
