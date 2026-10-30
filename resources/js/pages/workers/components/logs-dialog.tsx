import { useState } from 'react';
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LogOutput from '@/components/log-output';
import DateTime from '@/components/date-time';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ExternalLinkIcon, HistoryIcon, TerminalIcon } from 'lucide-react';
import { WorkerLog } from '@/types/worker';

type WorkerLogsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: number;
  workerId: number;
};

export default function WorkerLogsDialog({ open, onOpenChange, serverId, workerId }: WorkerLogsDialogProps) {
  const [activeTab, setActiveTab] = useState<'output' | 'history'>('output');

  const query = useQuery({
    queryKey: ['workerLog', workerId],
    queryFn: async () => {
      const response = await axios.get(`/servers/${serverId}/workers/${workerId}/logs`);
      return {
        logs: (response.data.logs ?? '') as string,
        history: (response.data.history ?? []) as WorkerLog[],
      };
    },
    refetchInterval: 2500,
    enabled: open,
  });

  const historyList = query.data?.history ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="flex flex-row items-center justify-between gap-4 pr-6">
          <div className="flex flex-col gap-1">
            <DialogTitle>Worker logs</DialogTitle>
            <DialogDescription className="sr-only">View worker logs and start/stop history</DialogDescription>
          </div>
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'output' | 'history')}>
            <TabsList className="h-7 bg-muted/60 p-0.5">
              <TabsTrigger value="output" className="h-6 text-xs px-2.5 gap-1.5">
                <TerminalIcon className="size-3.5" />
                <span>Output</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="h-6 text-xs px-2.5 gap-1.5">
                <HistoryIcon className="size-3.5" />
                <span>History</span>
                {historyList.length > 0 && (
                  <span className="text-[10px] bg-background text-foreground px-1 py-0.2 rounded-full font-mono">
                    {historyList.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {activeTab === 'output' ? (
          <LogOutput>{query.isLoading ? 'Loading...' : (query.data?.logs || 'No log output available.')}</LogOutput>
        ) : (
          <div className="max-h-[500px] min-h-[300px] overflow-y-auto flex flex-col gap-2 p-1">
            {historyList.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-12 gap-2">
                <HistoryIcon className="size-8 stroke-1 text-muted-foreground/60" />
                <span className="text-sm">No start/stop history recorded for this worker yet.</span>
              </div>
            ) : (
              <div className="divide-y divide-border border rounded-md overflow-hidden bg-card">
                {historyList.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant={item.type_color || 'secondary'} className="capitalize shrink-0 text-xs font-medium">
                        {item.type}
                      </Badge>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm text-foreground truncate font-medium">
                          {item.description || `Worker ${item.type}`}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {item.user ? `by ${item.user.name} (${item.user.email})` : (item.user_name ? `by ${item.user_name}` : 'by System')}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <DateTime date={item.created_at} className="text-xs text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Link href={`/servers/${serverId}/workers/${workerId}/log`}>
              <ExternalLinkIcon className="size-3.5" />
              <span>Full page view</span>
            </Link>
          </Button>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
