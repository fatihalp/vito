<?php

namespace App\Actions\VitoSetting;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use PDO;
use RuntimeException;
use SQLite3;

class BackupWorkspace
{
    public function create(): string
    {
        $path = Storage::disk('tmp')->path('vito-backup-'.bin2hex(random_bytes(16)));

        if (! mkdir($path, 0700)) {
            throw new RuntimeException('Could not create a private backup directory.');
        }

        return $path;
    }

    public function snapshot(string $source, string $destination): void
    {
        if (! is_file($source)) {
            throw new RuntimeException('The Vito database file is missing.');
        }

        $connection = new PDO('sqlite:'.$source, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $connection->exec('PRAGMA busy_timeout = 10000');
        $connection->exec('VACUUM INTO '.$connection->quote($destination));
        chmod($destination, 0600);
    }

    public function restoreDatabase(string $source, string $destination): void
    {
        if (! class_exists(SQLite3::class)) {
            throw new RuntimeException('Restoring Vito requires the SQLite3 PHP extension.');
        }

        $from = new SQLite3($source, SQLITE3_OPEN_READONLY);
        $to = new SQLite3($destination, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
        $from->enableExceptions(true);
        $to->enableExceptions(true);
        $to->busyTimeout(10000);

        try {
            if (! $from->backup($to)) {
                throw new RuntimeException('Could not restore the Vito database.');
            }
        } finally {
            $from->close();
            $to->close();
        }

        chmod($destination, 0600);
    }

    public function remove(string $path): void
    {
        File::deleteDirectory($path);
    }
}
