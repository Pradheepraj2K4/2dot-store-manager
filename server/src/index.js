const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { initializeDatabase } = require('./db/database');
const { errorHandler } = require('./middleware/errorHandler');
const { triggerDailyBackup } = require('./utils/backupService');
const { register, httpRequestCounter } = require('./utils/metrics');
const ledgerRoutes = require('./routes/ledgerRoutes');
const ledgerTypeRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/paymentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const interestRoutes = require('./routes/interestRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const interestSchemeRoutes = require('./routes/interestSchemeRoutes');
const transactionCategoryRoutes = require('./routes/transactionCategoryRoutes');

const app = express();
const PORT = process.env.PORT || 3456;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request metrics
app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.labels(req.method, req.path, String(res.statusCode)).inc();
  });
  next();
});

// After every successful write request, trigger a daily backup (best-effort)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        setImmediate(triggerDailyBackup);
      }
    });
  }
  next();
});

// Initialize database
initializeDatabase();

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// API Routes
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/ledger-types', ledgerTypeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/interest', interestRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/interest-schemes', interestSchemeRoutes);
app.use('/api/transaction-categories', transactionCategoryRoutes);

// Serve React build in production
// CLIENT_DIST_PATH is injected by the Electron wrapper when running packaged,
// so the client/dist folder can be replaced without rebuilding Electron.
const clientBuildPath = process.env.CLIENT_DIST_PATH
  || path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`2DotInventory server running on http://localhost:${PORT}`);
});

module.exports = app;
