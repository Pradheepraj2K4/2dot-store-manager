const { getDb } = require('../db/database');

const PUBLIC_COLUMNS = `
  id, username, can_create, can_modify, can_delete, can_manage_settings, status, created_at
`;

function toBool(v) {
  return v ? 1 : 0;
}

class UserRepository {
  getAll() {
    const db = getDb();
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY username ASC`).all();
  }

  // Lightweight list for the login screen (no password exposed)
  getLoginList() {
    const db = getDb();
    return db.prepare(`SELECT id, username FROM users WHERE status = 'active' ORDER BY username ASC`).all();
  }

  getById(id) {
    const db = getDb();
    return db.prepare(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = ?`).get(id);
  }

  getByUsername(username) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  create({ username, password, can_create, can_modify, can_delete, can_manage_settings }) {
    const db = getDb();
    const info = db.prepare(`
      INSERT INTO users (username, password, can_create, can_modify, can_delete, can_manage_settings)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      username.trim(),
      password,
      toBool(can_create),
      toBool(can_modify),
      toBool(can_delete),
      toBool(can_manage_settings)
    );
    return this.getById(info.lastInsertRowid);
  }

  update(id, { username, password, can_create, can_modify, can_delete, can_manage_settings, status }) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) return null;
    db.prepare(`
      UPDATE users
      SET username = ?, password = ?, can_create = ?, can_modify = ?, can_delete = ?, can_manage_settings = ?, status = ?
      WHERE id = ?
    `).run(
      (username ?? existing.username).trim(),
      // Keep existing password when none supplied
      password && password.length ? password : existing.password,
      toBool(can_create),
      toBool(can_modify),
      toBool(can_delete),
      toBool(can_manage_settings),
      status || existing.status,
      id
    );
    return this.getById(id);
  }

  delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  // Validates credentials; returns the public user record on success, else null
  authenticate(username, password) {
    const db = getDb();
    const row = db.prepare("SELECT * FROM users WHERE username = ? AND status = 'active'").get(username);
    if (!row) return null;
    if (row.password !== password) return null;
    return this.getById(row.id);
  }
}

module.exports = new UserRepository();
