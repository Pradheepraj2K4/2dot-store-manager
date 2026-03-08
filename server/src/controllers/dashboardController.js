const ledgerService = require('../services/ledgerService');
const transactionService = require('../services/paymentService');
const ledgerTypeService = require('../services/accountService');
const settingsRepository = require('../repositories/settingsRepository');
const expenseService = require('../services/expenseService');

class DashboardController {
  getSummary(req, res, next) {
    try {
      const ledgerCounts = ledgerService.getLedgerCounts();
      const ledgers = ledgerService.getAllWithOutstanding();
      const recentTransactions = transactionService.getRecentTransactions(10);
      const ledgerTypes = ledgerTypeService.getAllTypes();

      // Outstanding balances grouped by ledger type
      const outstandingByType = {};
      for (const lt of ledgerTypes) {
        outstandingByType[lt.id] = {
          id: lt.id,
          name: lt.name,
          behaviour: lt.behaviour,
          total: 0,
          count: 0,
        };
      }
      for (const l of ledgers) {
        if (l.current_balance !== 0 && l.status === 'active' && outstandingByType[l.ledger_type_id]) {
          outstandingByType[l.ledger_type_id].total += Math.abs(l.current_balance);
          outstandingByType[l.ledger_type_id].count += 1;
        }
      }

      const totalReceivable = ledgers
        .filter((l) => l.behaviour === 'customer' && l.current_balance > 0 && l.status === 'active')
        .reduce((sum, l) => sum + l.current_balance, 0);

      const totalPayable = ledgers
        .filter((l) => l.behaviour === 'supplier' && l.current_balance > 0 && l.status === 'active')
        .reduce((sum, l) => sum + l.current_balance, 0);

      const topOutstanding = ledgers
        .filter((l) => Math.abs(l.current_balance) > 0 && l.status === 'active')
        .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance))
        .slice(0, 5);

      const expenseModuleEnabled = settingsRepository.get('expense_module_enabled');
      const expenseEnabled = expenseModuleEnabled === true || expenseModuleEnabled === 'true';

      let expenseSummary = null;
      if (expenseEnabled) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const todayLocal = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
        expenseSummary = {
          todayTotal: expenseService.getTodayTotal(),
          monthTotal: expenseService.getMonthTotal(),
          byCategory: expenseService.getSummary({ fromDate: monthStart, toDate: todayLocal }).byCategory,
        };
      }

      res.json({
        success: true,
        data: {
          ledgerCounts,
          totalLedgers: ledgers.length,
          activeLedgers: ledgers.filter(l => l.status === 'active').length,
          recentTransactions,
          totalReceivable,
          totalPayable,
          topOutstanding,
          outstandingByType: Object.values(outstandingByType),
          expenseSummary,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
