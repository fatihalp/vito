<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RunServerCleanup
{
    /**
     * Only category keys are accepted. The files are found again on the server and
     * checked against the cleanup allowlist, so no client supplied path is ever used.
     *
     * @param  array<string, mixed>  $input
     */
    public function run(Server $server, array $input): void
    {
        $data = Validator::make($input, [
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => ['string', Rule::in(array_keys(ScanServerCleanup::CATEGORIES))],
        ])->validate();

        $items = collect(app(ScanServerCleanup::class)->items($server))
            ->whereIn('category', $data['categories']);

        if ($items->isEmpty()) {
            throw ValidationException::withMessages([
                'categories' => __('Nothing to clean up for the selected categories.'),
            ]);
        }

        $paths = fn (array $categories): array => $items->whereIn('category', $categories)->pluck('path')->all();

        $server->ssh()->exec(view('ssh.os.cleanup-run', [
            'truncate' => $paths(['large_logs']),
            'files' => $paths(['rotated_logs']),
            'directories' => $paths(['tool_cache', 'puppeteer_cache']),
            'vacuumJournal' => $items->contains('category', 'journal'),
            'cleanApt' => $items->contains('category', 'apt_cache'),
        ]), timeout: 300);
    }
}
