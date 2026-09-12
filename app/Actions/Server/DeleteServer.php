<?php

namespace App\Actions\Server;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

use Illuminate\Validation\ValidationException;

class DeleteServer
{
    public function delete(Server $server, array $input): void
    {
        $this->validate($server, $input);

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
        ])->validate();
    }
}
