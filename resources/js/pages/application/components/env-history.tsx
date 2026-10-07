import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { DiffEditor } from '@monaco-editor/react';
import { HistoryIcon, LoaderCircleIcon, RotateCcwIcon } from 'lucide-react';
import { Server } from '@/types/server';
import { Site } from '@/types/site';
import { EnvVersion } from '@/types/env';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DateTime from '@/components/date-time';
import { useAppearance } from '@/hooks/use-appearance';
import { useDialog } from '@/hooks/use-dialog';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

export default function EnvHistory({
  server,
  site,
  path,
  current,
  hasUnsavedChanges,
  onRestored,
}: {
  server: Server;
  site: Site;
  path: string;
  current: string;
  hasUnsavedChanges: boolean;
  onRestored: () => void;
}) {
  const { getActualAppearance } = useAppearance();
  const dialog = useDialog();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const versions = useQuery({
    queryKey: ['siteEnvVersions', site.id, path],
    queryFn: async () => {
      const response = await axios.get(route('application.env-versions', { server: server.id, site: site.id }), { params: { path } });
      return response.data as EnvVersion[];
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (selectedId === null && versions.data?.length) {
      setSelectedId(versions.data[0].id);
    }
  }, [selectedId, versions.data]);

  const content = useQuery({
    queryKey: ['siteEnvVersion', site.id, selectedId],
    queryFn: async () => {
      const response = await axios.get(
        route('application.env-versions.show', { server: server.id, site: site.id, envVersion: selectedId as number }),
      );
      return response.data.content as string;
    },
    enabled: selectedId !== null,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });

  const selected = versions.data?.find((version) => version.id === selectedId);

  const restore = (version: EnvVersion) => {
    dialog.confirm.open({
      title: `Restore version #${version.id}?`,
      description: hasUnsavedChanges
        ? 'The .env file on the server will be replaced with this version. Your unsaved changes in the editor will be discarded.'
        : 'The .env file on the server will be replaced with this version. The current content stays in the history.',
      confirmLabel: 'Restore',
      method: 'post',
      url: route('application.env-versions.restore', { server: server.id, site: site.id, envVersion: version.id }),
      onSuccess: () => {
        void versions.refetch();
        onRestored();
      },
    });
  };

  if (versions.isError) {
    return (
      <Alert variant="destructive" className="m-4 w-auto">
        <AlertDescription>{errorMessage(versions.error, 'Failed to load the .env history')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-1 flex-col md:flex-row min-h-[550px]">
      <div className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r overflow-y-auto max-h-[calc(100vh-240px)]">
        {versions.isPending ? (
          <div className="flex flex-col gap-2 p-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : versions.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <HistoryIcon className="size-6" />
            No versions recorded yet. A version is saved every time the .env file is changed from Vito.
          </div>
        ) : (
          <ul className="flex flex-col">
            {versions.data.map((version, index) => (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(version.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 border-b px-4 py-3 text-left text-sm hover:bg-muted/50 cursor-pointer',
                    version.id === selectedId && 'bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      #{version.id}
                      {index === 0 && <span className="ml-2 text-xs text-muted-foreground">latest</span>}
                    </span>
                    <Badge variant={version.source_color}>{version.source}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {version.user_name ?? 'System'} · <DateTime date={version.created_at} relative />
                  </span>
                  {version.restored_from_id && (
                    <span className="text-xs text-muted-foreground">Restored from #{version.restored_from_id}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-1 flex-col min-w-0">
        {selected && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">
              Left: version #{selected.id} (<DateTime date={selected.created_at} />) · Right: current file
            </span>
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => restore(selected)}>
              <RotateCcwIcon className="size-3.5" />
              Restore this version
            </Button>
          </div>
        )}
        <div className="flex-1" style={{ minHeight: 500 }}>
          {content.isError ? (
            <Alert variant="destructive" className="m-4 w-auto">
              <AlertDescription>{errorMessage(content.error, 'Failed to load this version')}</AlertDescription>
            </Alert>
          ) : content.isFetching ? (
            <div className="flex h-full items-center justify-center">
              <LoaderCircleIcon className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            content.data !== undefined && (
              <DiffEditor
                height="calc(100vh - 290px)"
                language="dotenv"
                original={content.data}
                modified={current}
                theme={getActualAppearance() === 'dark' ? 'vs-dark' : 'vs'}
                options={{ readOnly: true, fontSize: 14, automaticLayout: true, renderSideBySide: true, wordWrap: 'on' }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
