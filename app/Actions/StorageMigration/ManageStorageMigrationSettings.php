<?php

namespace App\Actions\StorageMigration;

use App\Helpers\EnvParser;
use App\Models\StorageMigrationSetting;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Validator;

class ManageStorageMigrationSettings
{
    public function update(array $input): StorageMigrationSetting
    {
        $maxAllowed = (int) config('storage-migration.max_allowed_processes', 10);

        Validator::make($input, [
            'max_processes' => ['required', 'integer', 'min:1', "max:{$maxAllowed}"],
            'scan_max_processes' => ['required', 'integer', 'min:1', "max:{$maxAllowed}"],
        ])->validate();

        $setting = StorageMigrationSetting::current();
        $setting->max_processes = (int) $input['max_processes'];
        $setting->scan_max_processes = (int) $input['scan_max_processes'];
        $setting->save();

        return $setting;
    }

    public function apply(): StorageMigrationSetting
    {
        $setting = StorageMigrationSetting::current();

        $envPath = base_path('.env');
        $patched = EnvParser::patch(File::get($envPath), [
            'HORIZON_STORAGE_MIGRATION_MAX_PROCESSES' => (string) $setting->max_processes,
            'HORIZON_STORAGE_MIGRATION_SCAN_MAX_PROCESSES' => (string) $setting->scan_max_processes,
        ]);
        File::put($envPath, $patched);

        if (app()->configurationIsCached()) {
            Artisan::call('config:cache');
        }

        Artisan::call('horizon:terminate');

        $setting->applied_max_processes = $setting->max_processes;
        $setting->applied_scan_max_processes = $setting->scan_max_processes;
        $setting->applied_at = now();
        $setting->save();

        return $setting;
    }
}
