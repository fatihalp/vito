import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import React, { ReactNode, useRef, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { parseAnsi } from '@/lib/ansi';
import { isPendingLog } from '@/lib/log';

function formatLogNode(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return null;
  }
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (isPendingLog(trimmed) || trimmed === 'Loading...') {
      return (
        <div className="flex h-full min-h-[200px] w-full items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return parseAnsi(node);
  }
  if (typeof node === 'number') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <React.Fragment key={index}>{formatLogNode(child)}</React.Fragment>
    ));
  }
  if (React.isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    if (props && 'children' in props) {
      return React.cloneElement(node, undefined, formatLogNode(props.children));
    }
  }
  return node;
}

export default function LogOutput({ className, children }: { className?: string; children: ReactNode }) {
  const endRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(false);

  const formattedContent = useMemo(() => {
    return formatLogNode(children);
  }, [children]);

  const isPending = useMemo(() => {
    const checkPending = (n: ReactNode): boolean => {
      if (typeof n === 'string') return isPendingLog(n) || n.trim() === 'Loading...';
      if (Array.isArray(n)) return n.some(checkPending);
      if (React.isValidElement(n)) {
        const props = n.props as { children?: ReactNode };
        return props?.children !== undefined ? checkPending(props.children) : false;
      }
      return false;
    };
    return checkPending(children);
  }, [children]);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [children, autoScroll]);

  return (
    <div className="relative w-full h-full flex flex-col flex-1 min-h-0">
      <ScrollArea
        className={cn(
          'bg-accent/50 text-accent-foreground relative h-[500px] w-full overflow-auto p-4 font-mono text-sm break-all whitespace-pre-wrap',
          className,
        )}
      >
        <div>{formattedContent}</div>
        <div ref={endRef} />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      {!isPending && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="bg-accent! absolute right-4 bottom-4 z-10"
              onClick={() => setAutoScroll(!autoScroll)}
            >
              <ArrowDown className={cn('h-4 w-4', autoScroll && 'animate-bounce')} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">{autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
