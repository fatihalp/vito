import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function Container({ className, children }: { className?: string; children?: ReactNode }) {
  const filteredClassName = className
    ?.split(/\s+/)
    .filter((c) => !['max-w-4xl', 'max-w-5xl', 'max-w-6xl', 'max-w-7xl'].includes(c))
    .join(' ');

  return <div className={cn('w-full max-w-none space-y-5 px-4 py-5', filteredClassName)}>{children}</div>;
}
