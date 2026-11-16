<?php

namespace App\Actions\Ci;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;

class ResolveCiRunnerTargetServer
{
    public function resolve(array $input): Server
    {
        $target = Validator::make($input, ['server_id' => ['required', 'integer']])->validate();

        return Server::query()->findOrFail($target['server_id']);
    }
}
