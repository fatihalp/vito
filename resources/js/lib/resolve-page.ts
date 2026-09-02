import type { ComponentType } from 'react';

type PageComponent = ComponentType<Record<string, unknown>>;

/**
 * Resolves an Inertia page name against the page glob, skipping `components` directories
 * so their modules stay in the chunks that statically import them.
 */
export async function resolvePage(pages: Record<string, () => Promise<unknown>>, name: string): Promise<PageComponent> {
  const page = pages[`./pages/${name}.tsx`];

  if (!page) {
    throw new Error(`Page not found: ${name}`);
  }

  const module = (await page()) as { default?: PageComponent };

  return module.default ?? (module as unknown as PageComponent);
}
