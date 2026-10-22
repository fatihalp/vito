export interface PhpVersions {
  status: 'unknown' | 'current' | 'outdated' | 'error' | 'no_php';
  checking: boolean;
  checked_at: string | null;
  versions: {
    installed: string;
    latest: string;
    unsupported: boolean;
    outdated: boolean;
  }[];
}
