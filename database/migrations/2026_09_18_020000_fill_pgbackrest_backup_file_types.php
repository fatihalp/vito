<?php

use App\Models\Backup;
use App\Models\BackupFile;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['F' => 'full', 'D' => 'diff', 'I' => 'incr'] as $suffix => $type) {
            BackupFile::query()
                ->whereNull('type')
                ->where('name', 'like', '%'.$suffix)
                ->whereIn('backup_id', Backup::query()->where('type', 'pgbackrest')->select('id'))
                ->update(['type' => $type]);
        }
    }

    public function down(): void {}
};
