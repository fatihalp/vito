<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notification_channels')->orderBy('id')->each(function (object $row): void {
            if ($row->data === null || $this->isEncrypted((string) $row->data)) {
                return;
            }

            DB::table('notification_channels')->where('id', $row->id)->update(['data' => Crypt::encryptString((string) $row->data)]);
        });
    }

    public function down(): void
    {
        DB::table('notification_channels')->orderBy('id')->each(function (object $row): void {
            if ($row->data === null || ! $this->isEncrypted((string) $row->data)) {
                return;
            }

            DB::table('notification_channels')->where('id', $row->id)->update(['data' => Crypt::decryptString((string) $row->data)]);
        });
    }

    private function isEncrypted(string $value): bool
    {
        try {
            Crypt::decryptString($value);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
};
