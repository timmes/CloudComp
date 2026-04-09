/**
 * @module main
 *
 * Application entry point.  Loaded by index.html as a module.
 * Imports the monolith UI (which sets up window.* bindings),
 * then initialises the app once the DOM is ready.
 */

// Set up the compatibility bridge (window.appData + window.__stateAPI)
// MUST be imported before monolith-ui.js
import './bridge.js';

// Load the monolith UI — this executes immediately and assigns
// all onclick-referenced functions to window.*
import './views/monolith-ui.js';

// Bootstrap once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.initApp());
} else {
  window.initApp();
}
