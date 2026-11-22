import { Backup } from '@/types/backup';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const MAX_VISIBLE_DATABASES = 3;

export default function BackupDatabasesCell({ backup }: { backup: Backup }) {
  const databases = backup.databases ?? (backup.database?.name ? [backup.database.name] : []);

  if (databases.length === 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {backup.type === 'pgbackrest' ? 'PostgreSQL cluster' : '-'}
      </span>
    );
  }

  const visible = databases.slice(0, MAX_VISIBLE_DATABASES);
  const remaining = databases.length - visible.length;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {visible.map((name) => (
        <span
          key={name}
          title={name}
          className="bg-muted/70 text-foreground max-w-36 truncate rounded px-1.5 py-0.5 font-mono text-xs"
        >
          {name}
        </span>
      ))}
      {remaining > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Show all ${databases.length} databases`}
              className="cursor-pointer"
            >
              <Badge variant="outline" className="hover:bg-accent font-mono text-xs">
                +{remaining}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Databases</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {databases.length}
                </Badge>
              </div>
              <div className="flex max-h-56 flex-wrap gap-1 overflow-y-auto">
                {databases.map((name) => (
                  <span key={name} className="bg-muted/70 text-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
