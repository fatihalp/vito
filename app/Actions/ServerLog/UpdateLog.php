<?php

namespace App\Actions\ServerLog;

use App\Models\ServerLog;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateLog
{
    
    public function update(ServerLog $serverLog, array $input): void
    {
        if (! $serverLog->is_remote) {
            throw ValidationException::withMessages(['path' => __('Only remote log paths can be changed.')]);
        }

        Validator::make($input, [
            'path' => ['required', 'string', 'max:500', 'regex:/^\/[A-Za-z0-9._\/@+-]+$/'],
        ])->validate();

        $serverLog->update([
            'name' => $input['path'],
        ]);
    }
}
