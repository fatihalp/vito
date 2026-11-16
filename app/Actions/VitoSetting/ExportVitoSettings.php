<?php

namespace App\Actions\VitoSetting;

use Illuminate\Support\Facades\File;
use RuntimeException;
use Throwable;
use ZipArchive;

class ExportVitoSettings
{
    public const PATHS = [
        'database.sqlite' => 'storage/database.sqlite',
        '.env' => '.env',
        'ssh-public.key' => 'storage/ssh-public.key',
        'ssh-private.pem' => 'storage/ssh-private.pem',
        'key-pairs' => 'storage/app/key-pairs',
        'server-logs' => 'storage/app/server-logs',
    ];

    public function export(string $zipFileName): string
    {
        $workspace = app(BackupWorkspace::class);
        $directory = $workspace->create();
        $zipPath = $directory.'/'.basename($zipFileName);
        $snapshot = $directory.'/database.sqlite';
        $zip = new ZipArchive;

        try {
            $workspace->snapshot(base_path(self::PATHS['database.sqlite']), $snapshot);

            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::EXCL) !== true) {
                throw new RuntimeException('Could not create the backup archive.');
            }

            foreach (self::PATHS as $name => $relative) {
                $path = $name === 'database.sqlite' ? $snapshot : base_path($relative);

                if (is_link($path)) {
                    throw new RuntimeException('Backup paths must not be symbolic links.');
                }

                if (File::isFile($path)) {
                    $added = $zip->addFile($path, $name);
                } elseif (File::isDirectory($path)) {
                    $added = $zip->addEmptyDir($name);
                    foreach (File::allFiles($path) as $file) {
                        if ($file->isLink() || ! $zip->addFile($file->getPathname(), $name.'/'.$file->getRelativePathname())) {
                            throw new RuntimeException('Could not add a backup file.');
                        }
                    }
                } else {
                    if ($name !== 'key-pairs' && $name !== 'server-logs') {
                        throw new RuntimeException('A required backup file is missing.');
                    }
                    $added = $zip->addEmptyDir($name);
                }

                if (! $added) {
                    throw new RuntimeException('Could not add a backup entry.');
                }
            }

            if (! $zip->close()) {
                throw new RuntimeException('Could not finish the backup archive.');
            }

            unlink($snapshot);
            chmod($zipPath, 0600);

            return $zipPath;
        } catch (Throwable $exception) {
            unset($zip);
            $workspace->remove($directory);

            throw $exception;
        }
    }
}
