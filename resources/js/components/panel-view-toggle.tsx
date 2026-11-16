import { useTranslate } from '@/hooks/use-translate';
import { Button } from '@/components/ui/button';
import { usePanelView } from '@/hooks/use-panel-view';

export default function PanelViewToggle({ label }: { label: string }) {
  const translateText = useTranslate();
  const { advanced, setView } = usePanelView();

  return (
    <div className="flex rounded-md border border-border p-0.5" role="group" aria-label={translateText(label)}>
      <Button size="sm" variant={advanced ? 'ghost' : 'secondary'} aria-pressed={!advanced} onClick={() => setView('basic')}>{translateText('Basic')}</Button>
      <Button size="sm" variant={advanced ? 'secondary' : 'ghost'} aria-pressed={advanced} onClick={() => setView('advanced')}>{translateText('Advanced')}</Button>
    </div>
  );
}
