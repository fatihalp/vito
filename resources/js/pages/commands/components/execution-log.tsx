import DateTime from '@/components/date-time';
import LogOutput from '@/components/log-output';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLogContent } from '@/hooks/use-log-content';
import { CommandExecution } from '@/types/command-execution';
import { ChevronDownIcon, DownloadIcon, LoaderCircleIcon, TerminalIcon } from 'lucide-react';
import { useState } from 'react';

export default function ExecutionLog({ execution, initiallyOpen = false }: { execution: CommandExecution; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { content, isLoading, error } = useLogContent({
    serverId: execution.server_id,
    logId: execution.log?.id ?? 0,
    enabled: open && !!execution.log,
  });

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-3 p-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start gap-3 px-1 py-1 text-left">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
              {execution.status === 'executing' ? <LoaderCircleIcon className="size-4 animate-spin" /> : <TerminalIcon className="size-4" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">Execution #{execution.id}</span>
                <Badge variant={execution.status_color}>{execution.status}</Badge>
              </div>
              <span className="text-muted-foreground text-xs"><DateTime date={execution.created_at} /></span>
            </div>
            <ChevronDownIcon className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        {execution.log && (
          <Button variant="outline" size="icon" className="size-8 shrink-0" asChild>
            <a href={route('logs.download', { server: execution.server_id, log: execution.log.id })} target="_blank" rel="noopener noreferrer" aria-label="Download log">
              <DownloadIcon />
            </a>
          </Button>
        )}
      </div>
      <CollapsibleContent className="border-t">
        {Object.keys(execution.variables).length > 0 && (
          <div className="bg-muted/30 flex flex-wrap gap-2 border-b p-3">
            {Object.keys(execution.variables).map((name) => (
              <Badge key={name} variant="outline" className="font-mono">
                {name}=••••••••
              </Badge>
            ))}
          </div>
        )}
        <LogOutput className="h-80 rounded-none border-0">
          {isLoading && 'Loading output...'}
          {error && <span className="text-destructive">{error}</span>}
          {!isLoading && !error && (content || (execution.status === 'executing' ? 'Waiting for output...' : 'No output was recorded.'))}
        </LogOutput>
      </CollapsibleContent>
    </Collapsible>
  );
}
