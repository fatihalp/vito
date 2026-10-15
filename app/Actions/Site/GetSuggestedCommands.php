<?php

namespace App\Actions\Site;

use App\Models\Command;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class GetSuggestedCommands
{
    private const int LIMIT = 5;

    /**
     * The most recent distinct commands the user ran, across all projects and sites.
     *
     * @return array<int, string>
     */
    public function get(User $user): array
    {
        $ranByUser = fn (Builder $query): Builder => $query->where('user_id', $user->id);

        return Command::query()
            ->whereHas('executions', $ranByUser)
            ->withMax(['executions as last_run_id' => $ranByUser], 'id')
            ->orderByDesc('last_run_id')
            ->limit(50)
            ->get()
            ->filter(fn (Command $command): bool => $command->getVariables() === [])
            ->map(fn (Command $command): string => trim($command->command))
            ->unique()
            ->take(self::LIMIT)
            ->values()
            ->all();
    }
}
