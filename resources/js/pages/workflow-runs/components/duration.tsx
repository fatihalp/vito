import { WorkflowRun } from '@/types/workflow-run';
import { useEffect, useState } from 'react';

const terminalStatuses = ['completed', 'failed'];

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }

  return `${remainingSeconds}s`;
};

export default function Duration({ workflowRun }: { workflowRun: WorkflowRun }) {
  const [now, setNow] = useState(() => Date.now());
  const isTerminal = terminalStatuses.includes(workflowRun.status);

  useEffect(() => {
    if (isTerminal) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [isTerminal]);

  if (isTerminal) {
    return workflowRun.duration;
  }

  const createdAt = new Date(workflowRun.created_at).getTime();
  const seconds = Number.isNaN(createdAt) ? workflowRun.duration_seconds : Math.max(0, Math.floor((now - createdAt) / 1000));

  return formatDuration(seconds);
}
