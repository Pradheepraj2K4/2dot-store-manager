// Authentication utilities
const AUTH_KEY = 'inventory_auth';
const CUSTOM_PASSWORD_KEY = 'inventory_custom_password';
const DEV_AUTH_KEY = 'inventory_dev_auth';

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
 * Get the custom password from localStorage
 */
export function getCustomPassword() {
  return localStorage.getItem(CUSTOM_PASSWORD_KEY);
}

/**
 * Set the custom password in localStorage
 */
export function setCustomPassword(password) {
  if (password && password.trim()) {
    localStorage.setItem(CUSTOM_PASSWORD_KEY, password.trim());
  } else {
    localStorage.removeItem(CUSTOM_PASSWORD_KEY);
  }
}

/**
 * Validate password against both default and custom passwords
 */
export function validatePassword(password) {
  if (!password) return false;
  
  const defaultPassword = getDefaultPassword();
  const customPassword = getCustomPassword();

  return password === defaultPassword || (customPassword && password === customPassword);
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
export function login(password) {
  if (validatePassword(password)) {
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
}
