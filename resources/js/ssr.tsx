import { createInertiaApp } from '@inertiajs/react';
import { route } from 'ziggy-js';
import { resolvePage } from '@/lib/resolve-page';





const appName = import.meta.env.VITE_APP_NAME || 'Vito';

const pages = import.meta.glob(['./pages/**/*.tsx', '!./pages/**/components/**']);

createInertiaApp({
  resolve: (name) => resolvePage(pages, name),
  title: (title) => `${title} - ${appName}`,
  setup: ({ App, props }) => {
    const ziggy = (
      props.initialPage.props as unknown as {
        ziggy?: { location: string } & Record<string, unknown>;
      }
    ).ziggy;

    if (!ziggy) {
      return <App {...props} />;
    }

    
    (globalThis as any).route = (name?: unknown, params?: unknown, absolute?: boolean) =>
      route(name as any, params as any, absolute, {
        ...ziggy,
        location: new URL(ziggy.location),
      } as any);
    

    return <App {...props} />;
  },
});
