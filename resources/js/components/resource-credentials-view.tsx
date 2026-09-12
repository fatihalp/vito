import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const isSecretEnvKey = (key: string): boolean => {
  return /password|secret|token/i.test(key) || (/key/i.test(key) && !/key_id|keys/i.test(key));
};

interface ResourceCredentialsViewProps {
  environment: Record<string, string>;
  title?: string | null;
  subtitle?: string;
  type?: 'database' | 'cache' | 'storage' | 'websocket' | string;
  className?: string;
}

export default function ResourceCredentialsView({
  environment,
  title = 'Credentials',
  subtitle,
  type,
  className,
}: ResourceCredentialsViewProps) {
  const [masked, setMasked] = useState(true);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedDeeplink, setCopiedDeeplink] = useState(false);

  const envEntries = Object.entries(environment);

  if (envEntries.length === 0) {
    return null;
  }

  const defaultSubtitle = subtitle;

  const copyEnv = () => {
    const text = envEntries.map(([k, v]) => `${k}=${v}`).join('\n');
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedEnv(true);
        toast.success('Environment variables copied to clipboard');
        setTimeout(() => setCopiedEnv(false), 2000);
      })
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  let deeplinkLabel: string | null = null;
  let deeplinkValue: string | null = null;
  let maskedDeeplinkValue: string | null = null;

  if (type === 'database' || environment.DB_CONNECTION || environment.DB_HOST) {
    const conn = environment.DB_CONNECTION ?? 'pgsql';
    const host = environment.DB_HOST ?? '127.0.0.1';
    const port = environment.DB_PORT ?? (conn === 'pgsql' || conn === 'postgresql' ? '5432' : '3306');
    const database = environment.DB_DATABASE ?? '';
    const username = environment.DB_USERNAME ?? '';
    const password = environment.DB_PASSWORD ?? '';
    const scheme = conn === 'mysql' || conn === 'mariadb' ? 'mysql' : 'postgresql';

    deeplinkLabel = 'Deeplink';
    deeplinkValue = `${scheme}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    maskedDeeplinkValue = `${scheme}://${encodeURIComponent(username)}:••••••••@${host}:${port}/${database}`;
  } else if (type === 'cache' || environment.REDIS_HOST) {
    const host = environment.REDIS_HOST ?? '127.0.0.1';
    const port = environment.REDIS_PORT ?? '6379';
    const password = environment.REDIS_PASSWORD;

    deeplinkLabel = 'Redis CLI';
    deeplinkValue = password ? `redis-cli -h ${host} -p ${port} -a ${password}` : `redis-cli -h ${host} -p ${port}`;
    maskedDeeplinkValue = password ? `redis-cli -h ${host} -p ${port} -a ••••••••` : deeplinkValue;
  }

  const copyDeeplink = () => {
    if (!deeplinkValue) return;
    navigator.clipboard
      .writeText(deeplinkValue)
      .then(() => {
        setCopiedDeeplink(true);
        toast.success(`${deeplinkLabel} copied to clipboard`);
        setTimeout(() => setCopiedDeeplink(false), 2000);
      })
      .catch(() => toast.error('Failed to copy to clipboard'));
  };

  return (
    <div className={cn('w-full min-w-0 space-y-2.5', className)}>
      <div className="w-full min-w-0 space-y-1.5">
        {title && (
          <div>
            <h4 className="text-foreground text-xs font-medium">{title}</h4>
            {defaultSubtitle && <p className="text-muted-foreground text-xs">{defaultSubtitle}</p>}
          </div>
        )}

        <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border/60 bg-muted/20 p-3 font-mono text-xs">
          <div className="absolute top-2 right-2 z-10 flex items-center rounded border border-border/60 bg-background/80 p-0.5 backdrop-blur-xs">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => setMasked((m) => !m)}
              aria-label={masked ? 'Reveal secret values' : 'Hide secret values'}
              title={masked ? 'Reveal values' : 'Hide values'}
            >
              {masked ? <EyeIcon className="size-3" /> : <EyeOffIcon className="size-3" />}
            </Button>
            <div className="mx-0.5 my-auto h-3 w-px bg-border/60" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={copyEnv}
              aria-label="Copy environment variables"
              title="Copy to clipboard"
            >
              {copiedEnv ? <CheckIcon className="text-success size-3" /> : <CopyIcon className="size-3" />}
            </Button>
          </div>

          <div className="w-full min-w-0 space-y-1 overflow-x-auto pr-16">
            {envEntries.map(([key, value]) => {
              const isSecret = isSecretEnvKey(key);
              const displayValue = isSecret && masked ? '••••••••••••••••' : value;

              return (
                <div key={key} className="flex items-baseline whitespace-nowrap">
                  <span className="font-medium text-foreground/80">{key}</span>
                  <span className="text-muted-foreground/40 px-0.5 select-none">=</span>
                  <span className={cn('text-foreground font-normal', isSecret && masked && 'tracking-widest text-muted-foreground/70')}>
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {deeplinkLabel && deeplinkValue && (
        <div className="flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 font-mono text-xs">
          <div className="min-w-0 flex items-center gap-2">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase select-none">
              {deeplinkLabel}
            </span>
            <span className="min-w-0 truncate text-foreground/90">
              {masked ? maskedDeeplinkValue : deeplinkValue}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={copyDeeplink}
            aria-label={`Copy ${deeplinkLabel}`}
            title="Copy"
          >
            {copiedDeeplink ? <CheckIcon className="text-success size-3" /> : <CopyIcon className="size-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}
