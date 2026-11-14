import { useEffect, useSyncExternalStore } from 'react';
import { usePage } from '@inertiajs/react';
import { readQueryParam, replaceQueryParams } from '@/lib/url';

const storageKey = 'pure.panel-view';
const changeEvent = 'pure:panel-view';
type PanelView = 'basic' | 'advanced';
let currentView: PanelView = 'basic';

function isPanelView(value: string | null): value is PanelView {
  return value === 'basic' || value === 'advanced';
}

function getSnapshot(): PanelView {
  try {
    const saved = localStorage.getItem(storageKey);
    if (isPanelView(saved)) currentView = saved;
  } catch {}
  return currentView;
}

function subscribe(listener: () => void): () => void {
  window.addEventListener(changeEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener('storage', listener);
  };
}

function setView(view: PanelView): void {
  currentView = view;
  try {
    localStorage.setItem(storageKey, view);
  } catch {}
  window.dispatchEvent(new Event(changeEvent));
  replaceQueryParams({ view });
}

export function usePanelView() {
  const { url } = usePage();
  const storedView = useSyncExternalStore(subscribe, getSnapshot, () => 'basic' as PanelView);
  const urlView = readQueryParam(url, 'view');
  const view = isPanelView(urlView) ? urlView : storedView;

  useEffect(() => {
    replaceQueryParams({ view });
  }, [view]);

  return { advanced: view === 'advanced', setView };
}
