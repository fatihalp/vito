<?php

namespace App\Actions\VitoSetting;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

class ExportVitoSettings
{
    /**
     * Paths relative to the project root that make up a Vito backup, keyed by their name inside the archive.
     *
     * @var array<string, string>
     */
    public const PATHS = [
        'database.sqlite' => 'storage/database.sqlite',
        '.env' => '.env',
        'ssh-public.key' => 'storage/ssh-public.key',
        'ssh-private.pem' => 'storage/ssh-private.pem',
        'key-pairs' => 'storage/app/key-pairs',
        'server-logs' => 'storage/app/server-logs',
    ];

    /**
     * Returns the absolute path of the archive written to the tmp disk.
     */
    public function export(string $zipFileName): string
    {
        $zipPath = Storage::disk('tmp')->path($zipFileName);
        $zip = new ZipArchive;

        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('Could not create zip file at '.$zipPath);
        }

        foreach (self::PATHS as $name => $relative) {
            $path = base_path($relative);

            if (File::isFile($path)) {
                $zip->addFile($path, $name);
            } elseif (File::isDirectory($path)) {
                foreach (File::allFiles($path) as $file) {
                    $zip->addFile($file->getRealPath(), $name.'/'.$file->getRelativePathname());
                }
            }
        }

        $zip->close();

        return $zipPath;
    }
}
