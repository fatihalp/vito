import { useTranslate } from '@/hooks/use-translate';
import { cn } from '@/lib/utils';
import { type HTMLAttributes } from 'react';

export default function InputError({ message, className = '', ...props }: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
  const translateText = useTranslate();
  return message ? (
    <p role="alert" {...props} className={cn('whitespace-pre-line text-sm text-destructive', className)}>
      {translateText(message)}
    </p>
  ) : null;
}
