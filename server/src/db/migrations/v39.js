/**
 * Migration v39 — Per-batch freight allocation
 *
 * When a purchase carries a freight charge, that charge is spread evenly across
 * every purchased unit and stored on each stocked batch as a per-unit freight
 * rate. The sale side then adds this to the batch's cost rate so the landed
 * cost (purchase rate + freight) is reflected when selling from that batch.
 *
 *   • item_batches.freight_rate — per-unit freight added to the batch cost.
 */

const VERSION = 39;

function up(db) {
  db.exec(`
    ALTER TABLE item_batches ADD COLUMN freight_rate REAL NOT NULL DEFAULT 0;
  `);
}

module.exports = { VERSION, up };
