/** Migration v2 — no-op (all schema consolidated into v1) */
const VERSION = 2;
function up(_db) { /* already applied in v1 */ }
module.exports = { VERSION, up };
