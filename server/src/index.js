const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { initializeDatabase } = require('./db/database');
const { errorHandler } = require('./middleware/errorHandler');
const ledgerRoutes = require('./routes/ledgerRoutes');
const ledgerTypeRoutes = require('./routes/accountRoutes');
const transactionRoutes = require('./routes/paymentRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const interestRoutes = require('./routes/interestRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const app = express();
const PORT = process.env.PORT || 3456;

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database
initializeDatabase();

// API Routes
app.use('/api/ledgers', ledgerRoutes);
app.use('/api/ledger-types', ledgerTypeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/interest', interestRoutes);
app.use('/api/expenses', expenseRoutes);

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
