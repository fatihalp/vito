import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

export default function InputError({ message, className = '', ...props }: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
  return message ? (
    <p role="alert" {...props} className={cn('whitespace-pre-line text-sm text-destructive', className)}>
      {message}
    </p>
  ) : null;
}
