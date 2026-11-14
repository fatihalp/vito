import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { useBootstrapStore } from './stores/bootstrap-store';
import './vito-table-setup';
import { resolvePage } from '@/lib/resolve-page';

const appName = 'Pure';

const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/**/components/**']);

useBootstrapStore.getState().hydrateFromCache();

router.on('before', ({ detail: { visit } }) => {
  if (visit.method === 'get' && visit.url.origin === window.location.origin && visit.url.pathname === window.location.pathname) {
    visit.headers['X-Vito-Table-Navigation'] = '1';
  }
});

createInertiaApp({
  resolve: (name) => resolvePage(pages, name),
  title: (title) => `${title} - ${appName}`,
  setup({ el, App, props }) {
    const root = createRoot(el!);

    root.render(<App {...props} />);
  },
  progress: {
    color: 'var(--foreground)',
  },
});
