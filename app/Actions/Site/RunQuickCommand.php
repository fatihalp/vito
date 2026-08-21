<?php

namespace App\Actions\Site;

use App\Models\CommandExecution;
use App\Models\Site;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class RunQuickCommand
{
    
    public function run(Site $site, User $user, array $input): CommandExecution
    {
        $validated = Validator::make($input, [
            'command' => ['required', 'string'],
        ])->validate();

        $commandText = $validated['command'];
        $command = $site->commands()
            ->where('is_raw', true)
            ->get()
            ->first(fn ($candidate): bool => hash_equals($candidate->command, $commandText));

        if (! $command) {
            $command = app(CreateCommand::class)->create($site, [
                'name' => Str::limit($commandText, 80),
                'command' => $commandText,
            ], true);
        } else {
            $command->touch();
        }

        return app(ExecuteCommand::class)->execute($command, $user, []);
    }
}
