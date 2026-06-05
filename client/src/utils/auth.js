// Authentication utilities
import { settingsApi, userApi } from '../api';

const AUTH_KEY = 'inventory_auth';
const DEV_AUTH_KEY = 'inventory_dev_auth';
const CURRENT_USER_KEY = 'inventory_current_user';

// Built-in identity used for the privileged Admin account
export const ADMIN_USERNAME = 'Admin';

// Permission keys (must match the user table columns: can_<key>)
export const PERMISSIONS = ['create', 'modify', 'delete', 'manage_settings'];

/**
 * Generate the default admin password based on current date
 * Formula: admin[(day[0]+month[0])-(|day[1] - month[1]|)]
 * Example: For 15/02, password is admin13 (calculation: (1+0)-(|5-2|) = 1-3 = 13)
 */
export function getDefaultPassword() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const day0 = parseInt(day[0]);
  const day1 = parseInt(day[1]);
  const month0 = parseInt(month[0]);
  const month1 = parseInt(month[1]);

  const firstPart = day0 + month0;
  const secondPart = Math.abs(day1 - month1);

  return `admin${firstPart}${secondPart}`;
}

/**
 * Generate the developer password based on current time
 * Formula: dev@2.MMss in 12hr format
 * Example: At 11:13 AM/PM, password is dev@2.1113
 */
export function getDevPassword() {
  const now = new Date();
  let hours = now.getHours();
  // Convert to 12hr format
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const mm = String(hours).padStart(2, '0');
  const ss = String(now.getMinutes()).padStart(2, '0');
  return `dev@2.${mm}${ss}`;
}

/**
 * Validate developer password (time-based)
 */
export function validateDevPassword(password) {
  if (!password) return false;
  return password === getDevPassword();
}

/**
 * Check if developer is authenticated (session only)
 */
export function isDevAuthenticated() {
  return sessionStorage.getItem(DEV_AUTH_KEY) === 'true';
}

/**
 * Login as developer
 */
export function devLogin(password) {
  if (validateDevPassword(password)) {
    sessionStorage.setItem(DEV_AUTH_KEY, 'true');
    return true;
  }
  return false;
}

/**
 * Logout developer
 */
export function devLogout() {
  sessionStorage.removeItem(DEV_AUTH_KEY);
}

/**
 * Get the custom password from server
 */
export async function getCustomPassword() {
  try {
    const res = await settingsApi.get('custom_password');
    const val = res.data?.value;
    return val ? String(val) : null;
  } catch {
    return null;
  }
}

/**
 * Set the custom password on server
 */
export async function setCustomPassword(password) {
  await settingsApi.update('custom_password', password && password.trim() ? password.trim() : '');
}

/**
 * Validate password against both default and custom passwords
 */
export async function validatePassword(password) {
  if (!password) return false;
  
  const defaultPassword = getDefaultPassword();
  if (password === defaultPassword) return true;

  const customPassword = await getCustomPassword();
  return customPassword && password === customPassword;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

/**
 * Login user
 */
export async function login(password) {
  if (await validatePassword(password)) {
    localStorage.setItem(AUTH_KEY, 'true');
    return true;
  }
  return false;
}

/**
 * Logout user
 */
export function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

/* ─── Multi-user authentication & permissions ─────────────────────── */

const ALL_PERMISSIONS = PERMISSIONS.reduce((acc, p) => ({ ...acc, [p]: true }), {});

function persistCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  localStorage.setItem(AUTH_KEY, 'true');
}

/**
 * Returns the currently logged-in user descriptor, or null.
 * Shape: { username, isAdmin, permissions: { create, modify, delete, manage_settings } }
 */
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Check whether the current user is allowed to perform an action.
 * Admin (and developer override) always return true.
 */
export function hasPermission(permission) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.isAdmin) return true;
  return Boolean(user.permissions?.[permission]);
}

/**
 * True when the active session is the privileged Admin / developer.
 */
export function isAdminUser() {
  const user = getCurrentUser();
  return Boolean(user?.isAdmin);
}

/**
 * Login a selected user with their password.
 * - Admin: authenticates with the date-based developer password OR the custom
 *   password configured in settings, and receives full access.
 * - Any user: the date-based developer password always grants override access.
 * - Created users: validated against their own password (server-side).
 */
export async function loginUser(username, password) {
  if (!password) return { ok: false, error: 'Password is required' };

  // Developer override — always works for any selected identity
  if (validateDevPassword(password)) {
    persistCurrentUser({ username: username || ADMIN_USERNAME, isAdmin: true, permissions: ALL_PERMISSIONS });
    return { ok: true };
  }

  // Built-in Admin account
  if (username === ADMIN_USERNAME) {
    if (await validatePassword(password)) {
      persistCurrentUser({ username: ADMIN_USERNAME, isAdmin: true, permissions: ALL_PERMISSIONS });
      return { ok: true };
    }
    return { ok: false, error: 'Invalid password' };
  }

  // Created users — validate against the server
  try {
    const res = await userApi.login(username, password);
    const u = res.data;
    persistCurrentUser({
      username: u.username,
      isAdmin: false,
      permissions: {
        create: Boolean(u.can_create),
        modify: Boolean(u.can_modify),
        delete: Boolean(u.can_delete),
        manage_settings: Boolean(u.can_manage_settings),
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Invalid username or password' };
  }
}
