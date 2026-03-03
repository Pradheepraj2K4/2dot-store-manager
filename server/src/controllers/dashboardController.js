const transactionService = require('../services/transactionService');
const partyService = require('../services/partyService');

class DashboardController {
  getSummary(req, res, next) {
    try {
      const partyCounts = partyService.getPartyCounts();
      const txnSummary = transactionService.getSummary();
      const recentTransactions = transactionService.getRecentTransactions(10);
      const outstanding = transactionService.getOutstandingBalances();

      // Compute aggregates
      const totalReceivable = outstanding
        .filter((p) => p.type === 'customer' && p.current_balance > 0)
        .reduce((sum, p) => sum + p.current_balance, 0);

      const totalPayable = outstanding
        .filter((p) => p.type === 'supplier' && p.current_balance > 0)
        .reduce((sum, p) => sum + p.current_balance, 0);

      const topOutstanding = outstanding
        .filter((p) => Math.abs(p.current_balance) > 0)
        .sort((a, b) => Math.abs(b.current_balance) - Math.abs(a.current_balance))
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          partyCounts,
          txnSummary,
          recentTransactions,
          totalReceivable,
          totalPayable,
          topOutstanding,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new DashboardController();
