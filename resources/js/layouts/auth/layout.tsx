import { useTranslate } from '@/hooks/use-translate';
import { RequestFeedback } from '@/components/request-feedback';
import AppLogo from '@/components/app-logo';
import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';
import { SharedData } from '@/types';

interface AuthLayoutProps {
  name?: string;
  title?: string;
  description?: string;
  showFooter?: boolean;
}

export default function AuthLayout({ children, title, description, showFooter = true }: PropsWithChildren<AuthLayoutProps>) {
  const translateText = useTranslate();
  const page = usePage<SharedData>();
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <RequestFeedback />
      <div className="bg-card w-full max-w-sm rounded-2xl p-6 shadow-xl sm:p-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-4">
            <Link href="/" className="flex flex-col items-center gap-2 font-medium">
              <AppLogo className="text-2xl" />
              <span className="sr-only">{title ?? translateText("Home")}</span>
            </Link>

            {(title || description) && (
              <div className="space-y-2 text-center">
                {title && <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>}
                {description && <p className="text-muted-foreground text-center text-sm">{description}</p>}
              </div>
            )}
          </div>
          {children}
          {showFooter && (
            <div className="text-muted-foreground text-center text-xs">
              Pure{' '}
              <a
                href={`https://github.com/vitodeploy/vito/releases/tag/${page.props.version}`}
                className="hover:text-primary cursor-pointer"
                target="_blank"
              >
                {page.props.version}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
