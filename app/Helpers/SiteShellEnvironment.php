<?php

namespace App\Helpers;

use App\Models\Site;
use App\Tooling\ToolingRegistry;

final class SiteShellEnvironment
{
    
    public static function collect(Site $site): array
    {
        $user = $site->user;
        if ($user === '' || $user === null) {
            return [];
        }

        $home = home_path($user);
        $vitoBin = $home.'/.local/vito/bin';
        $localBin = $home.'/.local/bin';

        $paths = [$vitoBin, $localBin];

        foreach (ToolingRegistry::all() as $tool) {
            if ($tool->installedVersion($site) === null) {
                continue;
            }
            foreach ($tool->pathContributions($site) as $entry) {
                if ($entry !== '' && ! in_array($entry, $paths, true)) {
                    $paths[] = $entry;
                }
            }
        }

        $systemPaths = ['/usr/local/sbin', '/usr/local/bin', '/usr/sbin', '/usr/bin', '/sbin', '/bin'];
        foreach ($systemPaths as $sysPath) {
            if (! in_array($sysPath, $paths, true)) {
                $paths[] = $sysPath;
            }
        }

        return ['PATH' => implode(':', $paths)];
    }

    public static function wrap(Site $site, string $command, bool $cdToSitePath = false): string
    {
        $exports = '';
        foreach (self::collect($site) as $key => $value) {
            $exports .= sprintf('export %s=%s && ', $key, escapeshellarg($value));
        }

        $cd = $cdToSitePath && $site->path ? 'cd '.escapeshellarg($site->path).' && ' : '';

        return 'bash -c '.escapeshellarg($exports.$cd.$command);
    }
}
