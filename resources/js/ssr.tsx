import { createInertiaApp } from '@inertiajs/react';
import { resolvePage } from '@/lib/resolve-page';





const appName = import.meta.env.VITE_APP_NAME || 'Vito';

const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/**/components/**']);

createInertiaApp({
  resolve: (name) => resolvePage(pages, name),
  title: (title) => `${title} - ${appName}`,
  setup: ({ App, props }) => <App {...props} />,
});
