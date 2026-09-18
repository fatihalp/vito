import type { CellComponentProps } from '@forjedio/inertia-table-react';
import { Progress } from '@/components/ui/progress';

export function formatStorageMigrationProgress(progress: number): string {
  return progress > 0 && progress < 0.01 ? '<0.01%' : `${progress.toFixed(2)}%`;
}

export function StorageMigrationProgress({ value }: CellComponentProps) {
  const progress = Number(value ?? 0);

  return (
    <div className="flex min-w-36 items-center gap-2">
      <Progress value={progress} className="h-1.5" />
      <span className="text-muted-foreground text-xs tabular-nums">{formatStorageMigrationProgress(progress)}</span>
    </div>
  );
}
