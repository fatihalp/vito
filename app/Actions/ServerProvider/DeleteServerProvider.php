<?php

namespace App\Actions\ServerProvider;

use App\Contracts\Actions\ServerProvider\DeleteServerProvider as DeleteServerProviderContract;
use App\Models\ServerProvider;
use Illuminate\Validation\ValidationException;

class DeleteServerProvider implements DeleteServerProviderContract
{
    public function delete(ServerProvider $serverProvider): void
    {
        if ($serverProvider->servers()->exists()) {
            throw ValidationException::withMessages([
                'provider' => 'This server provider is being used by a server.',
            ]);
        }

        $serverProvider->delete();
    }
}
