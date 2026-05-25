/**
 * @module views/theme
 *
 * Light/dark theme toggle. The initial theme is applied by an inline
 * script in index.html <head> to avoid a flash of light content on
 * first render. This module handles the user-facing toggle.
 */

const STORAGE_KEY = 'cc-theme';

/** @returns {'light' | 'dark'} */
function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** @param {'light' | 'dark'} theme */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
}

export function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
