<?php

namespace App\Actions\VitoSetting;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use PDO;
use Dotenv\Dotenv;
use Illuminate\Encryption\Encrypter;
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
            throw ValidationException::withMessages(['backup_file' => __('Restoring Vito requires the SQLite3 PHP extension.')]);
        }

        $lock = Cache::lock('vito-settings-import', 600);
        if (! $lock->get()) {
            throw ValidationException::withMessages(['backup_file' => __('Another settings import is already running.')]);
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
                    throw new RuntimeException('Restore failed. Original settings are preserved in the private recovery directory.', previous: $exception);
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
            $total = 0;
            if ($zip->numFiles > 100000) {
                $this->invalid();
            }

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $entry = $zip->statIndex($i);
                $name = $entry['name'] ?? '';
                $parts = explode('/', rtrim($name, '/'));
                $top = $parts[0] ?? '';
                $total += $entry['size'] ?? 0;

                if ($name === '' || str_contains($name, "\0") || str_contains($name, '\\') || in_array('..', $parts, true) || in_array('.', $parts, true) || in_array('', $parts, true) || $total > 1073741824) {
                    $this->invalid();
                }
                if (! array_key_exists($top, ExportVitoSettings::PATHS)) {
                    continue;
                }
                if (count($parts) > 1 && ! in_array($top, ['key-pairs', 'server-logs'], true)) {
                    $this->invalid();
                }

                $zip->getExternalAttributesIndex($i, $system, $attributes);
                if ($system === ZipArchive::OPSYS_UNIX && (($attributes >> 16) & 0170000) === 0120000) {
                    $this->invalid();
                }

                $destination = $to.'/'.$name;
                $directory = str_ends_with($name, '/') ? $destination : dirname($destination);
                if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
                    throw new RuntimeException('Could not create a restore directory.');
                }
                if (str_ends_with($name, '/')) {
                    continue;
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
                    if (stream_copy_to_stream($stream, $file, ($entry['size'] ?? 0) + 1) !== ($entry['size'] ?? 0)) {
                        $this->invalid();
                    }
                } finally {
                    fclose($stream);
                    fclose($file);
                }
            }
        } finally {
            $zip->close();
        }

        foreach (['database.sqlite', '.env', 'ssh-public.key', 'ssh-private.pem'] as $required) {
            if (! is_file($to.'/'.$required) || filesize($to.'/'.$required) === 0) {
                $this->invalid();
            }
        }

        try {
            $database = new PDO('sqlite:'.$to.'/database.sqlite', options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            if ($database->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') {
                $this->invalid();
            }
            foreach (['users', 'servers', 'migrations'] as $table) {
                $database->query('SELECT 1 FROM "'.$table.'" LIMIT 0');
            }
        } catch (\PDOException) {
            $this->invalid();
        }

        try {
            $key = PublicKeyLoader::loadPrivateKey(file_get_contents($to.'/ssh-private.pem'));
            $public = PublicKeyLoader::loadPublicKey(file_get_contents($to.'/ssh-public.key'));
            if ($key->getPublicKey()->toString('OpenSSH') !== $public->toString('OpenSSH')) {
                $this->invalid();
            }
        } catch (\Exception) {
            $this->invalid();
        }

        try {
            $environment = Dotenv::parse(file_get_contents($to.'/.env'));
            $applicationKey = $environment['APP_KEY'] ?? '';
            if (str_starts_with($applicationKey, 'base64:')) {
                $applicationKey = base64_decode(substr($applicationKey, 7), true);
            }
            if (! is_string($applicationKey) || ! Encrypter::supported($applicationKey, config('app.cipher'))) {
                $this->invalid();
            }
        } catch (\Exception) {
            $this->invalid();
        }

        $columns = $database->query('PRAGMA table_info(servers)')->fetchAll(PDO::FETCH_COLUMN, 1);
        if (in_array('authentication', $columns, true)) {
            $encrypter = new Encrypter($applicationKey, config('app.cipher'));
            $previousKeys = array_filter(explode(',', $environment['APP_PREVIOUS_KEYS'] ?? ''));
            $previousKeys = array_map(fn (string $key): string => str_starts_with($key, 'base64:') ? (string) base64_decode(substr($key, 7), true) : $key, $previousKeys);
            $encrypter->previousKeys($previousKeys);
            $credentials = $database->query('SELECT authentication FROM servers WHERE authentication IS NOT NULL');
            try {
                while (($value = $credentials->fetchColumn()) !== false) {
                    $encrypter->decryptString($value);
                }
            } catch (\Exception) {
                $this->invalid();
            }
        }

        $serverIds = $database->query('SELECT id FROM servers')->fetchAll(PDO::FETCH_COLUMN);
        foreach ($serverIds as $id) {
            $private = $to.'/key-pairs/'.$id;
            if (! is_file($private) || filesize($private) === 0) {
                $this->invalid();
            }
            try {
                $key = PublicKeyLoader::loadPrivateKey(file_get_contents($private));
                if (is_file($private.'.pub')) {
                    $public = PublicKeyLoader::loadPublicKey(file_get_contents($private.'.pub'));
                    if ($key->getPublicKey()->toString('OpenSSH') !== $public->toString('OpenSSH')) {
                        $this->invalid();
                    }
                }
            } catch (\Exception) {
                $this->invalid();
            }
        }
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['backup_file' => __('The archive is not a complete, valid Vito backup.')]);
    }
}
