import * as React from 'react';
import { cn } from '@/lib/utils';
import { NetworkIcon, ServerIcon, FileCode2Icon } from 'lucide-react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export function LaravelIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#FF2D20" />
      <path
        d="M17.8 7.3l-4.5 2.6-4.5-2.6 4.5-2.6 4.5 2.6zM8.3 8.2v5.2l-4.5-2.6V5.6l4.5 2.6zm.9.5l4.5 2.6v5.2l-4.5-2.6V8.7zm9.9 2.1l-4.5 2.6v5.2l4.5-2.6v-5.2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function SymfonyIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#000000" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="serif"
        fontStyle="italic"
        fontWeight="bold"
        fontSize="13"
      >
        sf
      </text>
    </svg>
  );
}

export function StatamicIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#FF269E" />
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="15"
      >
        S
      </text>
    </svg>
  );
}

export function WordPressIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#21759B" />
      <circle cx="12" cy="12" r="8.5" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
      <path
        d="M6 12c0 2.4 1.4 4.5 3.4 5.5L6.3 9.4C6.1 10.2 6 11.1 6 12zm7.4 5.3l2.8-8c0-.1 0-.2-.1-.2h-1.6c-.1 0-.2.1-.1.2l2.3 6.6-1.8 1.4zm-4.3-.2l-2.4-7c0-.1 0-.2.1-.2h1.6c.1 0 .2.1.2.2l1.7 5.2.9-2.8-.7-2.4c0-.1 0-.2.1-.2h1.5c.1 0 .2.1.2.2l1.6 5.2 1.3-4.2c.4-.3.9-.5 1.5-.5.1 0 .3 0 .4.1L15.3 17c-.9.6-2.1 1-3.3 1-1.1 0-2.1-.3-2.9-.9z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function PhpMyAdminIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#F39C12" />
      <path
        d="M6.5 17.5L12 6.5l5.5 11H6.5zm5.5-8.2l-3.2 6.4h6.4L12 9.3z"
        fill="#FFFFFF"
      />
      <path
        d="M12 11l2.5 5h-5L12 11z"
        fill="#E67E22"
      />
    </svg>
  );
}

export function PhpIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#777BB4" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize="10"
        letterSpacing="0.5"
      >
        php
      </text>
    </svg>
  );
}

export function NextjsIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#000000" />
      <path
        d="M14.5 16.5L8.5 7.5H7v9h1.5v-6.3l5.3 7.8c.2.2.4.2.7.2h0v-10.7h-1.5v7.5zM15.5 7.5v5.5l1.5 2V7.5h-1.5z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function NuxtjsIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#00DC82" />
      <path
        d="M7 16.5l4-7 4 7H7zm5.5-2.2l-1.5-2.7-1.5 2.7h3zm3.5 2.2l3-5.3 3 5.3H16z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function NodejsIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#339933" />
      <path
        d="M12 5.5l6 3.5v7l-6 3.5-6-3.5V9l6-3.5zm0 1.8L7.5 9.7v4.6l4.5 2.6 4.5-2.6V9.7L12 7.3z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function BunIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#FBF0DF" stroke="#E6D3B3" strokeWidth="1" />
      <ellipse cx="12" cy="13" rx="6" ry="4.5" fill="#E8BA7B" />
      <circle cx="10" cy="12.5" r="1" fill="#333333" />
      <circle cx="14" cy="12.5" r="1" fill="#333333" />
      <ellipse cx="8.5" cy="14" rx="1.2" ry="0.8" fill="#FF8A80" />
      <ellipse cx="15.5" cy="14" rx="1.2" ry="0.8" fill="#FF8A80" />
    </svg>
  );
}

export function Html5Icon({ className, size = 24, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-md', className)}
      fill="none"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#E34F26" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="system-ui, sans-serif"
        fontWeight="900"
        fontSize="11"
      >
        HTML
      </text>
    </svg>
  );
}

export function LoadBalancerIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md bg-blue-600 text-white shrink-0',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <NetworkIcon className="size-3.5 text-white" />
    </div>
  );
}

export function OtherIcon({ className, size = 24, ...props }: IconProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md bg-slate-700 text-white shrink-0',
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <FileCode2Icon className="size-3.5 text-white" />
    </div>
  );
}

export function getSiteTypeIcon(typeKey: string, size = 24, className?: string) {
  const normalized = (typeKey || '').toLowerCase();

  switch (normalized) {
    case 'laravel':
      return <LaravelIcon size={size} className={className} />;
    case 'symfony':
      return <SymfonyIcon size={size} className={className} />;
    case 'statamic':
      return <StatamicIcon size={size} className={className} />;
    case 'wordpress':
      return <WordPressIcon size={size} className={className} />;
    case 'phpmyadmin':
      return <PhpMyAdminIcon size={size} className={className} />;
    case 'php':
    case 'phpsite':
    case 'phpblank':
      return <PhpIcon size={size} className={className} />;
    case 'nextjs':
    case 'next':
      return <NextjsIcon size={size} className={className} />;
    case 'nuxtjs':
    case 'nuxt':
      return <NuxtjsIcon size={size} className={className} />;
    case 'node':
    case 'nodejs':
    case 'nodesite':
      return <NodejsIcon size={size} className={className} />;
    case 'bun':
    case 'bunsite':
      return <BunIcon size={size} className={className} />;
    case 'html':
    case 'static':
      return <Html5Icon size={size} className={className} />;
    case 'loadbalancer':
      return <LoadBalancerIcon size={size} className={className} />;
    case 'blank':
    default:
      return <OtherIcon size={size} className={className} />;
  }
}
