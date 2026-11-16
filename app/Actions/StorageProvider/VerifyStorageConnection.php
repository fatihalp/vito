<?php

namespace App\Actions\StorageProvider;

use App\StorageProviders\ReportsConnectionErrors;
use App\StorageProviders\StorageProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class VerifyStorageConnection
{
    public function verify(StorageProvider $provider, array $credentials): void
    {
        try {
            $connected = $provider->connect($credentials);
        } catch (Throwable $e) {
            Log::error('Failed to verify storage connection', [
                'provider' => $provider::id(),
                'exception' => get_class($e),
            ]);
            $connected = false;
        }

        if (! $connected) {
            throw ValidationException::withMessages([
                'provider' => ($provider instanceof ReportsConnectionErrors ? $provider->connectionError() : null)
                    ?? __("Couldn't connect to the provider"),
            ]);
        }
    }
}
