<?php

namespace App\Actions\Limits;

use App\Models\Server;
use Throwable;

class GetServerLimits
{
    public function get(Server $server): array
    {
        $hasNginx = $server->services()->where('type', 'webserver')->where('name', 'nginx')->exists();
        $phpServices = $server->services()->where('type', 'php')->get();
        $phpVersions = $phpServices->pluck('version')->filter()->values()->all();

        $nginxLimit = '1M';
        $phpLimits = [];

        foreach ($phpVersions as $ver) {
            $phpLimits[$ver] = [
                'version' => $ver,
                'upload_max_filesize' => '2M',
                'post_max_size' => '8M',
                'memory_limit' => '128M',
                'max_execution_time' => '30',
            ];
        }

        if ($server->isReady()) {
            try {
                $output = $server->ssh()->exec(
                    view('ssh.services.read-limits', [
                        'phpVersions' => $phpVersions,
                    ]),
                    'read-limits'
                );

                $lines = explode("\n", trim($output));
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (str_starts_with($line, 'NGINX:')) {
                        $val = trim(substr($line, 6));
                        if ($val !== '') {
                            $nginxLimit = $val;
                        }
                    } elseif (str_starts_with($line, 'PHP_')) {
                        $parts = explode(':', $line, 2);
                        $ver = substr($parts[0], 4);
                        if (isset($parts[1]) && isset($phpLimits[$ver])) {
                            $vals = explode('|', $parts[1]);
                            if (! empty($vals[0])) {
                                $phpLimits[$ver]['upload_max_filesize'] = $vals[0];
                            }
                            if (! empty($vals[1])) {
                                $phpLimits[$ver]['post_max_size'] = $vals[1];
                            }
                            if (! empty($vals[2])) {
                                $phpLimits[$ver]['memory_limit'] = $vals[2];
                            }
                            if (! empty($vals[3])) {
                                $phpLimits[$ver]['max_execution_time'] = $vals[3];
                            }
                        }
                    }
                }
            } catch (Throwable) {
                // If remote probe fails, retain defaults
            }
        }

        return [
            'has_nginx' => $hasNginx,
            'nginx_limit' => $nginxLimit,
            'php_versions' => array_values($phpLimits),
            'default_php' => $server->php()?->version,
        ];
    }
}
