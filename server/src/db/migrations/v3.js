/** Migration v3 — no-op (all schema consolidated into v1) */
const VERSION = 3;
function up(_db) { /* already applied in v1 */ }
module.exports = { VERSION, up };
