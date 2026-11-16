<?php

namespace App\Actions\VitoSetting;

use Dotenv\Dotenv;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use PDO;
use phpseclib3\Crypt\PublicKeyLoader;
use RuntimeException;
use SQLite3;
use Throwable;
use ZipArchive;

class ImportVitoSettings
{
    public function import(array $input): void
    {
        if (config('app.demo')) {
            throw ValidationException::withMessages(['backup_file' => __('Import is disabled in demo mode.')]);
        }

        $validated = Validator::make($input, [
            'backup_file' => ['required', 'file', 'mimes:zip', 'max:1048576'],
        ])->validate();

        if (! class_exists(SQLite3::class)) {
            throw ValidationException::withMessages([
                'backup_file' => __('Restoring Vito requires the SQLite3 PHP extension.'),
            ]);
        }

        $lock = Cache::lock('vito-settings-import', 600);
        if (! $lock->get()) {
            throw ValidationException::withMessages([
                'backup_file' => __('Another settings import is already running.'),
            ]);
        }

        $workspace = app(BackupWorkspace::class);
        $extractPath = null;
        $recoveryPath = null;
        $completed = false;

        try {
            $extractPath = $workspace->create();
            $this->extract($validated['backup_file']->getPathname(), $extractPath);
            $recoveryPath = $workspace->create();
            $this->replace($extractPath, $recoveryPath, $workspace);
            $completed = true;
            Artisan::call('optimize:clear');
        } finally {
            if ($extractPath !== null) {
                $workspace->remove($extractPath);
            }
            if ($recoveryPath !== null && $completed) {
                $workspace->remove($recoveryPath);
            }
            $lock->release();
        }
    }

    private function replace(string $source, string $recovery, BackupWorkspace $workspace): void
    {
        $replaced = [];

        try {
            foreach (ExportVitoSettings::PATHS as $name => $relative) {
                if (! file_exists($source.'/'.$name)) {
                    continue;
                }

                $target = base_path($relative);
                if (is_link($target)) {
                    throw new RuntimeException('Restore paths must not be symbolic links.');
                }

                if ($name === 'database.sqlite') {
                    $workspace->snapshot($target, $recovery.'/'.$name);
                    $replaced[$name] = $target;
                    $workspace->restoreDatabase($source.'/'.$name, $target);
                    continue;
                }

                if (file_exists($target) && ! rename($target, $recovery.'/'.$name)) {
                    throw new RuntimeException('Could not preserve an existing settings file.');
                }

                $replaced[$name] = $target;
                if (! rename($source.'/'.$name, $target)) {
                    throw new RuntimeException('Could not restore a settings file.');
                }
            }
        } catch (Throwable $exception) {
            foreach (array_reverse($replaced, true) as $name => $target) {
                if ($name === 'database.sqlite') {
                    $workspace->restoreDatabase($recovery.'/'.$name, $target);
                    continue;
                }

                if (is_dir($target)) {
                    File::deleteDirectory($target);
                } elseif (file_exists($target)) {
                    unlink($target);
                }

                if (file_exists($recovery.'/'.$name) && ! rename($recovery.'/'.$name, $target)) {
                    throw new RuntimeException(
                        'Restore failed. Original settings are preserved in the private recovery directory.',
                        previous: $exception,
                    );
                }
            }

            throw $exception;
        }
    }

    private function extract(string $archive, string $to): void
    {
        $zip = new ZipArchive;

        if ($zip->open($archive) !== true) {
            $this->invalid();
        }

        try {
            $this->extractEntries($zip, $to);
        } finally {
            $zip->close();
        }

        foreach (['database.sqlite', '.env', 'ssh-public.key', 'ssh-private.pem'] as $required) {
            if (! is_file($to.'/'.$required) || filesize($to.'/'.$required) === 0) {
                $this->invalid();
            }
        }

        $database = $this->openVerifiedDatabase($to.'/database.sqlite');
        $this->assertKeyPair($to.'/ssh-private.pem', $to.'/ssh-public.key');
        $environment = $this->parseEnvironment($to.'/.env');
        $applicationKey = $this->applicationKey($environment);
        $this->assertServerCredentialsDecryptable($database, $environment, $applicationKey);
        $this->assertServerKeyPairs($database, $to);
    }

    private function extractEntries(ZipArchive $zip, string $to): void
    {
        $total = 0;
        if ($zip->numFiles > 100000) {
            $this->invalid();
        }

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $entry = $zip->statIndex($i);
            $name = $entry['name'] ?? '';
            $parts = explode('/', rtrim($name, '/'));
            $top = $parts[0] ?? '';
            $size = $entry['size'] ?? 0;
            $total += $size;

            if ($this->isUnsafeEntryName($name, $parts) || $total > 1073741824) {
                $this->invalid();
            }
            if (! array_key_exists($top, ExportVitoSettings::PATHS)) {
                continue;
            }
            if (count($parts) > 1 && ! in_array($top, ['key-pairs', 'server-logs'], true)) {
                $this->invalid();
            }
            if ($this->isSymbolicLink($zip, $i)) {
                $this->invalid();
            }

            $this->extractEntry($zip, $name, $size, $to);
        }
    }

    private function isUnsafeEntryName(string $name, array $parts): bool
    {
        return $name === ''
            || str_contains($name, "\0")
            || str_contains($name, '\\')
            || in_array('..', $parts, true)
            || in_array('.', $parts, true)
            || in_array('', $parts, true);
    }

    private function isSymbolicLink(ZipArchive $zip, int $index): bool
    {
        $zip->getExternalAttributesIndex($index, $system, $attributes);

        return $system === ZipArchive::OPSYS_UNIX && (($attributes >> 16) & 0170000) === 0120000;
    }

    private function extractEntry(ZipArchive $zip, string $name, int $size, string $to): void
    {
        $destination = $to.'/'.$name;
        $isDirectory = str_ends_with($name, '/');
        $directory = $isDirectory ? $destination : dirname($destination);
        if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
            throw new RuntimeException('Could not create a restore directory.');
        }
        if ($isDirectory) {
            return;
        }

        $stream = $zip->getStream($name);
        $file = fopen($destination, 'xb');
        if ($stream === false || $file === false) {
            if (is_resource($stream)) {
                fclose($stream);
            }
            if (is_resource($file)) {
                fclose($file);
            }
            $this->invalid();
        }

        chmod($destination, 0600);
        try {
            if (stream_copy_to_stream($stream, $file, $size + 1) !== $size) {
                $this->invalid();
            }
        } finally {
            fclose($stream);
            fclose($file);
        }
    }

    private function openVerifiedDatabase(string $path): PDO
    {
        try {
            $database = new PDO('sqlite:'.$path, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            if ($database->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') {
                $this->invalid();
            }
            foreach (['users', 'servers', 'migrations'] as $table) {
                $database->query('SELECT 1 FROM "'.$table.'" LIMIT 0');
            }
        } catch (\PDOException) {
            $this->invalid();
        }

        return $database;
    }

    private function assertKeyPair(string $privatePath, ?string $publicPath): void
    {
        try {
            $key = PublicKeyLoader::loadPrivateKey(file_get_contents($privatePath));
            if ($publicPath === null) {
                return;
            }
            $public = PublicKeyLoader::loadPublicKey(file_get_contents($publicPath));
            if ($key->getPublicKey()->toString('OpenSSH') !== $public->toString('OpenSSH')) {
                $this->invalid();
            }
        } catch (\Exception) {
            $this->invalid();
        }
    }

    private function parseEnvironment(string $path): array
    {
        try {
            return Dotenv::parse(file_get_contents($path));
        } catch (\Exception) {
            $this->invalid();
        }
    }

    private function applicationKey(array $environment): string
    {
        $applicationKey = $this->decodeKey($environment['APP_KEY'] ?? '');
        if (! is_string($applicationKey) || ! Encrypter::supported($applicationKey, config('app.cipher'))) {
            $this->invalid();
        }

        return $applicationKey;
    }

    private function decodeKey(string $key): string|false
    {
        return str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
    }

    private function assertServerCredentialsDecryptable(PDO $database, array $environment, string $applicationKey): void
    {
        $columns = $database->query('PRAGMA table_info(servers)')->fetchAll(PDO::FETCH_COLUMN, 1);
        if (! in_array('authentication', $columns, true)) {
            return;
        }

        $encrypter = new Encrypter($applicationKey, config('app.cipher'));
        $previousKeys = array_filter(explode(',', $environment['APP_PREVIOUS_KEYS'] ?? ''));
        $encrypter->previousKeys(array_map(fn (string $key): string => (string) $this->decodeKey($key), $previousKeys));
        $credentials = $database->query('SELECT authentication FROM servers WHERE authentication IS NOT NULL');
        try {
            while (($value = $credentials->fetchColumn()) !== false) {
                $encrypter->decryptString($value);
            }
        } catch (\Exception) {
            $this->invalid();
        }
    }

    private function assertServerKeyPairs(PDO $database, string $to): void
    {
        $serverIds = $database->query('SELECT id FROM servers')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($serverIds as $id) {
            $private = $to.'/key-pairs/'.$id;
            if (! is_file($private) || filesize($private) === 0) {
                $this->invalid();
            }
            $this->assertKeyPair($private, is_file($private.'.pub') ? $private.'.pub' : null);
        }
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages([
            'backup_file' => __('The archive is not a complete, valid Vito backup.'),
        ]);
    }
}
