import moment from 'moment';
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
  const value = moment(date);
  return (
    <time dateTime={date} className={className} title={relative ? value.format(format) : undefined}>
      {relative ? formatRelativeDate(value.valueOf()) : value.format(format)}
    </time>
  );
}
