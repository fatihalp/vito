import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import React, { ReactNode, useRef, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, ClockArrowDownIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { parseAnsi } from '@/lib/ansi';

function formatLogNode(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return null;
  }
  if (typeof node === 'string') {
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(false);

  const formattedContent = useMemo(() => {
    return formatLogNode(children);
  }, [children]);

  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [children, autoScroll]);

  const toggleAutoScroll = () => {
    setAutoScroll(!autoScroll);
  };

  return (
    <div className="relative w-full h-full flex flex-col flex-1 min-h-0">
      <ScrollArea
        ref={scrollRef}
        className={cn(
          'bg-accent/50 text-accent-foreground relative h-[500px] w-full overflow-auto p-4 font-mono text-sm break-all whitespace-pre-wrap',
          className,
        )}
      >
        <div>{formattedContent}</div>
        <div ref={endRef} />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
      <Button
        variant="outline"
        size="icon"
        className="bg-accent! absolute right-4 bottom-4 z-10"
        onClick={toggleAutoScroll}
        title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{autoScroll ? <ClockArrowDownIcon className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}</div>
          </TooltipTrigger>
          <TooltipContent side="left">{autoScroll ? 'Turn off auto scroll' : 'Auto scroll down'}</TooltipContent>
        </Tooltip>
      </Button>
    </div>
  );
}
