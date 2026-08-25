import { renderApp } from './app.js';
import { createCloudIntegrationClient } from './utils/cloudIntegration.js';

// Exchange a returning maccount SSO redirect (e.g. a #mtoken hash fragment)
// before the UI reads getUser(), so a signed-in user is reflected on first paint.
createCloudIntegrationClient().handleRedirect?.();

const root = document.getElementById('root');

if (root) {
  renderApp(root);
}
