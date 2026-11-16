import { Button } from '@/components/ui/button';
import { usePanelView } from '@/hooks/use-panel-view';

export default function PanelViewToggle({ label }: { label: string }) {
  const { advanced, setView } = usePanelView();

  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={label}>
      <Button size="sm" variant={advanced ? 'ghost' : 'secondary'} aria-pressed={!advanced} onClick={() => setView('basic')}>Basic</Button>
      <Button size="sm" variant={advanced ? 'secondary' : 'ghost'} aria-pressed={advanced} onClick={() => setView('advanced')}>Advanced</Button>
    </div>
  );
}
