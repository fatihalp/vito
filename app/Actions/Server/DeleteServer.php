<?php

namespace App\Actions\Server;

use Throwable;
use App\Notifications\FailedToDeleteServerFromProvider;
use App\Models\ServerLog;
use App\Facades\Notifier;
use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

use Illuminate\Validation\ValidationException;

class DeleteServer
{
    public function delete(Server $server, array $input): void
    {
        $this->validate($server, $input);

        if ((bool) ($input['delete_from_provider'] ?? false)) {
            try {
                $server->provider()->delete();
            } catch (Throwable $e) {
                ServerLog::log($server, 'delete-server-from-provider-failed', $e->getMessage());
                Notifier::send($server, new FailedToDeleteServerFromProvider($server));
            }
        }

        $server->delete();
    }

    private function validate(Server $server, array $input): void
    {
        if ($server->is_self) {
            throw ValidationException::withMessages([
                'name' => 'The server hosting Vito cannot be deleted.',
            ]);
        }

        Validator::make($input, [
            'name' => [
                'required',
                Rule::in([$server->name]),
            ],
            'delete_from_provider' => ['nullable', 'boolean'],
        ])->validate();
    }
}
