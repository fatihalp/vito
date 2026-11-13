import '../css/app.css';

import { createInertiaApp } from '@inertiajs/react';
import { createRoot } from 'react-dom/client';
import { useBootstrapStore } from './stores/bootstrap-store';
import './vito-table-setup';
import { resolvePage } from '@/lib/resolve-page';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';

const appName = 'Pure';

const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/**/components/**']);

useBootstrapStore.getState().hydrateFromCache();

createInertiaApp({
  resolve: (name) => resolvePage(pages, name),
  title: (title) => `${title} - ${appName}`,
  setup({ el, App, props }) {
    const root = createRoot(el!);

    root.render(
      <ThemeProvider attribute="class" defaultTheme="dark" storageKey="vito-theme" disableTransitionOnChange>
        <App {...props} />
        <Toaster richColors position="bottom-center" />
      </ThemeProvider>,
    );
  },
  progress: {
    color: 'var(--foreground)',
  },
});
