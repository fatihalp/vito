import Container from '@/components/container';
import Heading from '@/components/heading';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ServerLayout from '@/layouts/server/layout';
import { requestErrorMessage } from '@/lib/request-error';
import { Head, Link, usePage } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ArrowLeftIcon, LoaderCircleIcon, RefreshCwIcon } from 'lucide-react';
import { useState } from 'react';

type BrowserProps = { databaseName: string; dataUrl: string; backUrl: string };
type DatabaseTable = { schema: string; name: string; estimated_rows: number };
type TableRows = { columns: Array<{ name: string; type: string }>; rows: Record<string, string | null>[]; page: number; has_more: boolean };

function Browser({ databaseName, dataUrl, backUrl }: BrowserProps) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<DatabaseTable | null>(null);
  const [page, setPage] = useState(1);
  const tables = useQuery({
    queryKey: ['database-browser.tables', dataUrl],
    queryFn: async ({ signal }) => (await axios.get<{ tables: DatabaseTable[] }>(dataUrl, { signal })).data.tables,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const records = useQuery({
    queryKey: ['database-browser.rows', dataUrl, selected?.schema, selected?.name, page],
    queryFn: async ({ signal }) => (await axios.get<TableRows>(dataUrl, { signal, params: { schema: selected?.schema, table: selected?.name, page } })).data,
    enabled: selected !== null,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const error = tables.error ?? records.error;
  const visibleTables = (tables.data ?? []).filter((table) => `${table.schema}.${table.name}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Container>
      <Head title={`Browse ${databaseName}`} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Heading title={databaseName} description="Browse PostgreSQL tables and records without changing application data." />
        <div className="flex items-center gap-2">
          <Badge variant="outline">Read only</Badge>
          <Button variant="outline" asChild><Link href={backUrl}><ArrowLeftIcon />Back</Link></Button>
        </div>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{requestErrorMessage(error, 'Unable to read the database. Check server access and try again.')}</AlertDescription></Alert>}
      <div className="grid min-w-0 gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="min-w-0 rounded-lg border bg-card p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Tables ({tables.data?.length ?? 0})</span>
            <Button variant="ghost" size="icon" aria-label="Refresh table list" disabled={tables.isFetching} onClick={() => void tables.refetch()}><RefreshCwIcon className={tables.isFetching ? 'animate-spin' : ''} /></Button>
          </div>
          <Input aria-label="Filter tables" placeholder="Search tables…" value={filter} onChange={(event) => setFilter(event.target.value)} />
          <div className="mt-3 flex max-h-[65vh] flex-col gap-1 overflow-y-auto">
            {tables.isPending && <p className="text-muted-foreground p-2 text-sm">Loading tables…</p>}
            {tables.isSuccess && visibleTables.length === 0 && <p className="text-muted-foreground p-2 text-sm">No matching tables.</p>}
            {visibleTables.map((table) => (
              <Button key={`${table.schema}.${table.name}`} variant={selected?.name === table.name && selected.schema === table.schema ? 'secondary' : 'ghost'} className="h-auto justify-start py-2 text-left" onClick={() => { setSelected(table); setPage(1); }}>
                <span className="min-w-0"><span className="block truncate">{table.name}</span><span className="text-muted-foreground block text-xs">{table.schema} · ~{table.estimated_rows.toLocaleString()} rows</span></span>
              </Button>
            ))}
          </div>
        </aside>
        <section className="min-w-0 rounded-lg border bg-card p-3">
          {!selected ? <p className="text-muted-foreground p-6 text-sm">Select a table to see its columns and records.</p> : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-sm">{selected.schema}.{selected.name}</span>
                <Button variant="outline" size="sm" disabled={records.isFetching} onClick={() => void records.refetch()}><RefreshCwIcon className={records.isFetching ? 'animate-spin' : ''} />Refresh records</Button>
              </div>
              {records.isFetching && <p role="status" className="text-muted-foreground flex items-center gap-2 p-4 text-sm"><LoaderCircleIcon className="size-4 animate-spin" />Loading records…</p>}
              {records.data && !records.isFetching && (
                <>
                  <div className="overflow-auto rounded-md border">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/50"><tr>{records.data.columns.map((column) => <th key={column.name} className="whitespace-nowrap border-b p-3 font-medium"><span className="block">{column.name}</span><span className="text-muted-foreground font-normal">{column.type}</span></th>)}</tr></thead>
                      <tbody>{records.data.rows.map((row, index) => <tr key={index} className="border-b last:border-0">{records.data.columns.map((column) => <td key={column.name} className="max-w-96 min-w-28 break-words p-3 align-top font-mono">{row[column.name] === null ? <span className="text-muted-foreground italic">NULL</span> : row[column.name]}</td>)}</tr>)}</tbody>
                    </table>
                    {records.data.rows.length === 0 && <p className="text-muted-foreground p-6 text-sm">This table has no records.</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-xs">Page {page} · up to 25 rows. Long values are shortened; binary data is omitted.</p>
                    <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={!records.data.has_more || page >= 1000} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </Container>
  );
}

export default function DatabaseBrowser() {
  const { props } = usePage<BrowserProps>();

  return <ServerLayout><Browser {...props} /></ServerLayout>;
}
