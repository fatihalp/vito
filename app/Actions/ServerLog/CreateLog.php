<?php

namespace App\Actions\ServerLog;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;

class CreateLog
{
    
    public function create(Server $server, array $input): void
    {
        $this->validate($input);

        $server->logs()->create([
            'is_remote' => true,
            'name' => $input['path'],
            'type' => 'remote',
            'disk' => 'ssh',
        ]);
    }

    private function validate(array $input): void
    {
        Validator::make($input, [
            'path' => ['required', 'string', 'max:500', 'regex:/^\/[A-Za-z0-9._\/@+-]+$/'],
        ])->validate();
    }
}
