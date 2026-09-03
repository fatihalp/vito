import type { ComponentType } from 'react';

type PageComponent = ComponentType<Record<string, unknown>>;

export async function resolvePage(pages: Record<string, () => Promise<unknown>>, name: string): Promise<PageComponent> {
  const page = pages[`./pages/${name}.tsx`];

  if (!page) {
    throw new Error(`Page not found: ${name}`);
  }

  const module = (await page()) as { default?: PageComponent };

  return module.default ?? (module as unknown as PageComponent);
}
