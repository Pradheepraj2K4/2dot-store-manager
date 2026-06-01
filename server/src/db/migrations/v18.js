/**
 * Migration v18 — System CASH ledger
 *
 * 1. Adds `is_system` column to the `ledgers` table (default 0).
 * 2. Seeds a dedicated built-in ledger type named 'CASH'.
 *    Behaviour is 'customer' because a cash sale debits the ledger
 *    (increases its balance) exactly like a customer settling on the
 *    spot — the standard application for a cash account in billing.
 * 3. Seeds a built-in CASH ledger tied to that 'CASH' type.
 *    Both the type and the ledger are marked is_system = 1 so they
 *    cannot be edited/deleted and the CASH ledger always appears as
 *    the default option for cash sales.
 */

const VERSION = 18;

function up(db) {
  // 1. Add is_system flag to ledgers
  db.exec(`ALTER TABLE ledgers ADD COLUMN is_system INTEGER NOT NULL DEFAULT 0;`);

  // 2. Seed the dedicated CASH ledger type (idempotent)
  db.prepare(`
    INSERT OR IGNORE INTO ledger_types (name, behaviour, is_system)
    VALUES ('CASH', 'customer', 1)
  `).run();

  const cashType = db.prepare(
    `SELECT id FROM ledger_types WHERE name = 'CASH' LIMIT 1`
  ).get();

  if (!cashType) return; // safety: should always exist after the insert above

  // 3. Seed the CASH ledger (idempotent — skip if it already exists)
  db.prepare(`
    INSERT OR IGNORE INTO ledgers
      (ledger_type_id, name, phone, place, address, gst_no, state_code, igst_status,
       current_balance, interest_rate, interest_scheme, is_system)
    SELECT ?, 'CASH', '', '', '', '', '', 'NO', 0, 0, 'NONE', 1
    WHERE NOT EXISTS (SELECT 1 FROM ledgers WHERE name = 'CASH' AND is_system = 1)
  `).run(cashType.id);
}

module.exports = { VERSION, up };
