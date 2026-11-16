<?php

namespace App\Actions\VitoSetting;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use ZipArchive;

class ImportVitoSettings
{
    public function import(array $input): void
    {
        if (config('app.demo')) {
            throw ValidationException::withMessages(['backup_file' => __('Import is disabled in demo mode.')]);
        }

        $validated = Validator::make($input, [
            'backup_file' => ['required', 'file', 'mimes:zip'],
        ])->validate();

        $uploaded = $validated['backup_file'];
        $extractPath = Storage::disk('tmp')->path('vito-'.Str::random(40));
        File::makeDirectory($extractPath, 0700);
        $umask = umask(0077);

        try {
            $this->extract($uploaded->getPathname(), $extractPath);

            foreach (ExportVitoSettings::PATHS as $name => $relative) {
                $source = $extractPath.'/'.$name;

                if (File::isFile($source)) {
                    File::move($source, base_path($relative));
                } elseif (File::isDirectory($source)) {
                    move_directory($source, base_path($relative));
                }
            }

            $this->restrictSecretPermissions();
        } finally {
            umask($umask);
            File::deleteDirectory($extractPath);
        }

        Artisan::call('optimize');
    }

    private function restrictSecretPermissions(): void
    {
        foreach ([storage_path('app/key-pairs'), storage_path('app/server-logs')] as $directory) {
            if (! File::isDirectory($directory)) {
                continue;
            }

            chmod($directory, 0700);
            foreach (File::directories($directory) as $child) {
                chmod($child, 0700);
            }
            foreach (File::allFiles($directory, true) as $file) {
                chmod($file->getPathname(), 0600);
            }
        }
    }

    private function extract(string $archive, string $to): void
    {
        $zip = new ZipArchive;

        if ($zip->open($archive) !== true) {
            throw ValidationException::withMessages(['backup_file' => __('The uploaded file is not a valid zip archive.')]);
        }

        $allowed = [];

        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);
            $top = Str::before($name, '/');

            if ($name === '' || str_contains($name, '..') || str_starts_with($name, '/') || ! array_key_exists($top, ExportVitoSettings::PATHS)) {
                continue;
            }

            $allowed[] = $name;
        }

        if ($allowed === []) {
            $zip->close();

            throw ValidationException::withMessages(['backup_file' => __('The archive does not contain a Vito backup.')]);
        }

        $zip->extractTo($to, $allowed);
        $zip->close();
    }
}
