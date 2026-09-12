<?php

namespace App\Actions\Server;

use App\Models\Server;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class GetServerCommandHistory
{
    /**
     * @return array{source: string, items: array<int, array{timestamp: string, user: string, pwd: ?string, target_user: ?string, command: string}>}
     */
    public function handle(Server $server, array $input = []): array
    {
        if (! $server->isReady()) {
            throw ValidationException::withMessages([
                'server' => 'Commands history is unavailable while the server is offline.',
            ]);
        }

        $validated = Validator::make($input, [
            'source' => ['nullable', 'string', 'in:sudo,bash'],
            'lines' => ['nullable', 'integer', 'min:20', 'max:500'],
            'search' => ['nullable', 'string', 'max:200'],
        ])->validate();

        $source = $validated['source'] ?? 'sudo';
        $lines = (int) ($validated['lines'] ?? 100);
        $search = $validated['search'] ?? null;

        if ($source === 'bash') {
            return [
                'source' => 'bash',
                'items' => $this->getBashHistory($server, $lines, $search),
            ];
        }

        return [
            'source' => 'sudo',
            'items' => $this->getSudoCommands($server, $lines, $search),
        ];
    }

    /**
     * @return array<int, array{timestamp: string, user: string, pwd: ?string, target_user: ?string, command: string}>
     */
    private function getSudoCommands(Server $server, int $lines, ?string $search): array
    {
        $searchArg = '';
        if ($search !== null && $search !== '') {
            $escaped = escapeshellarg($search);
            $searchArg = " | grep -i {$escaped}";
        }

        $cmd = "journalctl _COMM=sudo -n {$lines} --no-pager -o short-iso 2>/dev/null{$searchArg} || (grep -E 'sudo:.*COMMAND=' /var/log/auth.log 2>/dev/null{$searchArg} | tail -n {$lines})";

        try {
            $output = $server->ssh()->exec($cmd);
        } catch (Throwable) {
            return [];
        }

        $items = [];
        $linesArray = array_filter(array_map('trim', explode("\n", (string) $output)));

        foreach (array_reverse($linesArray) as $line) {
            $parsed = $this->parseSudoLine($line);
            if ($parsed !== null) {
                $items[] = $parsed;
            }
        }

        return $items;
    }

    /**
     * @return ?array{timestamp: string, user: string, pwd: ?string, target_user: ?string, command: string}
     */
    private function parseSudoLine(string $line): ?array
    {
        if (! str_contains($line, 'COMMAND=')) {
            return null;
        }

        $timestamp = '';
        if (preg_match('/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)/', $line, $timeMatch)) {
            $timestamp = substr(str_replace('T', ' ', $timeMatch[1]), 0, 19);
        } elseif (preg_match('/^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})/', $line, $timeMatch)) {
            $timestamp = $timeMatch[1];
        }

        $user = 'root';
        if (preg_match('/:\s+([a-zA-Z0-9_\-\.]+)\s*:\s+TTY=/', $line, $userMatch)) {
            $user = $userMatch[1];
        }

        $pwd = null;
        if (preg_match('/PWD=([^;]+)/', $line, $pwdMatch)) {
            $pwd = trim($pwdMatch[1]);
        }

        $targetUser = 'root';
        if (preg_match('/USER=([^;]+)/', $line, $targetUserMatch)) {
            $targetUser = trim($targetUserMatch[1]);
        }

        $command = '';
        if (preg_match('/COMMAND=(.*)$/', $line, $cmdMatch)) {
            $command = trim($cmdMatch[1]);
        }

        if (empty($command)) {
            return null;
        }

        return [
            'timestamp' => $timestamp ?: 'Recently',
            'user' => $user,
            'pwd' => $pwd,
            'target_user' => $targetUser,
            'command' => $command,
        ];
    }

    /**
     * @return array<int, array{timestamp: string, user: string, pwd: ?string, target_user: ?string, command: string}>
     */
    private function getBashHistory(Server $server, int $lines, ?string $search): array
    {
        $searchFilter = '';
        if ($search !== null && $search !== '') {
            $escaped = escapeshellarg($search);
            $searchFilter = " | grep -i {$escaped}";
        }

        $cmd = "sh -c '
            [ -f /root/.bash_history ] && awk \"{print \\\"root|\\\" \\$0}\" /root/.bash_history | tail -n {$lines};
            for h in /home/*/.bash_history; do
                if [ -f \"\$h\" ]; then
                    u=\$(basename \$(dirname \"\$h\"))
                    awk -v u=\"\$u\" \"{print u \\\"|\\\" \\$0}\" \"\$h\" | tail -n {$lines}
                fi
            done
        '{$searchFilter}";

        try {
            $output = $server->ssh()->exec($cmd);
        } catch (Throwable) {
            return [];
        }

        $items = [];
        $linesArray = array_filter(array_map('trim', explode("\n", (string) $output)));

        foreach (array_reverse($linesArray) as $line) {
            if (str_contains($line, '|')) {
                [$user, $command] = explode('|', $line, 2);
                $command = trim($command);
                if (! empty($command)) {
                    $items[] = [
                        'timestamp' => 'Shell session',
                        'user' => trim($user),
                        'pwd' => null,
                        'target_user' => null,
                        'command' => $command,
                    ];
                }
            }
        }

        return $items;
    }
}
