import moment from 'moment';
import { usePage } from '@inertiajs/react';
import { SharedData } from '@/types';
import { formatRelativeDate } from '@/lib/format-relative-date';

export default function DateTime({
  date,
  format = 'YYYY-MM-DD HH:mm:ss',
  className,
  relative = false,
}: {
  date: string;
  format?: string;
  className?: string;
  
  relative?: boolean;
}) {
  const { locale = 'en' } = usePage<SharedData>().props;
  const value = moment(date);
  return (
    <time dateTime={date} className={className} title={relative ? value.format(format) : undefined}>
      {relative ? formatRelativeDate(value.valueOf(), locale) : value.format(format)}
    </time>
  );
}
