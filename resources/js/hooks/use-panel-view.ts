import { useSyncExternalStore } from 'react';

const storageKey = 'pure.panel-view';
const changeEvent = 'pure:panel-view';
type PanelView = 'basic' | 'advanced';
let currentView: PanelView = 'basic';

function getSnapshot(): PanelView {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'basic' || saved === 'advanced') currentView = saved;
  } catch {
    return currentView;
  }
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
  } catch {
    return;
  } finally {
    window.dispatchEvent(new Event(changeEvent));
  }
}

export function usePanelView() {
  const view = useSyncExternalStore(subscribe, getSnapshot, () => 'basic' as PanelView);
  return { advanced: view === 'advanced', setView };
}
