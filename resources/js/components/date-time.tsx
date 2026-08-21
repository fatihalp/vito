import moment from 'moment';

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
  return (
    <time dateTime={date} className={className} title={relative ? moment(date).format(format) : undefined}>
      {relative ? moment(date).fromNow() : moment(date).format(format)}
    </time>
  );
}
