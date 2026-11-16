<?php

namespace App\Actions\StorageProvider;

use App\Models\StorageProvider;
use App\StorageProviders\ReportsConnectionErrors;
use App\StorageProviders\S3;
use Illuminate\Support\Facades\Log;
use Throwable;

class TestStorageProviderConnection
{
    public function test(StorageProvider $storageProvider, ?string $mode): array
    {
        if (! $storageProvider->hasProviderHandler()) {
            return ['connected' => false];
        }

        $handler = $storageProvider->provider();
        $readOnly = $mode === 'read' && $handler instanceof S3;

        try {
            $connected = $readOnly
                ? $handler->canRead($storageProvider->credentials)
                : $handler->connect($storageProvider->credentials);
        } catch (Throwable $e) {
            Log::error('Failed to test storage provider connection', [
                'storage_provider_id' => $storageProvider->id,
                'exception' => get_class($e),
            ]);
            $connected = false;
        }

        $reportsError = ! $connected && $handler instanceof ReportsConnectionErrors;

        return [
            'connected' => $connected,
            'error' => $reportsError ? $handler->connectionError() : null,
        ];
    }
}
