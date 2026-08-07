import React from 'react';

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: false,
    collapseGroups: true,
  });
}

// ---------------------------------------------------------------------------
// Demo mode: seed localStorage with a fake authenticated session so the app
// runs fully without a backend. Activated by: yarn start-demo
// ---------------------------------------------------------------------------
declare const DEMO_MODE: boolean;
if (typeof DEMO_MODE !== 'undefined' && DEMO_MODE) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { seedDemoState } = require('./demo/seedDemoState');
  seedDemoState();
}

import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);

