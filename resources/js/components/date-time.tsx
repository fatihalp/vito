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
  /** Show "3 minutes ago" instead of the formatted date, with the exact date as a hover tooltip. */
  relative?: boolean;
}) {
  return (
    <time dateTime={date} className={className} title={relative ? moment(date).format(format) : undefined}>
      {relative ? moment(date).fromNow() : moment(date).format(format)}
    </time>
  );
}
