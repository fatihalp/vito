<?php

namespace App\Support;

class LogCleaner
{
    public static function clean(?string $raw, bool $stripAnsi = false): string
    {
        if ($raw === null || $raw === '') {
            return '';
        }

        $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $raw));
        $output = [];
        $total = count($lines);

        $statusList = ['DONE', 'FAIL', 'FAILED', 'SKIPPED', 'OK', 'SUCCESS'];

        for ($i = 0; $i < $total; $i++) {
            $line = $lines[$i];

            if (str_contains($line, "\r")) {
                $parts = explode("\r", $line);
                $line = end($parts) ?: '';
            }

            $plain = self::stripAnsi($line);
            $trimmedPlain = trim($plain);

            if ($trimmedPlain !== '' && preg_match('/^\.{3,}$/', $trimmedPlain)) {
                $nextLine = isset($lines[$i + 1]) ? trim(self::stripAnsi($lines[$i + 1])) : '';
                if (in_array(strtoupper($nextLine), $statusList, true)) {
                    if (! empty($output)) {
                        $prev = array_pop($output);
                        $prevPlain = trim(self::stripAnsi($prev));
                        $dots = str_repeat('.', max(3, 40 - strlen($prevPlain)));
                        $status = self::cleanOrphanedAnsi(trim($lines[$i + 1]));
                        $formattedDots = $stripAnsi ? $dots : "\033[90m{$dots}\033[39m";
                        $output[] = rtrim($prev)." {$formattedDots} {$status}";
                        $i++;

                        continue;
                    }
                }
            }

            if (preg_match('/^(\.{3,})\s*('.implode('|', $statusList).')$/i', $trimmedPlain, $matches)) {
                if (! empty($output)) {
                    $prev = array_pop($output);
                    $prevPlain = trim(self::stripAnsi($prev));
                    $dots = str_repeat('.', max(3, 40 - strlen($prevPlain)));
                    $formattedDots = $stripAnsi ? $dots : "\033[90m{$dots}\033[39m";
                    $statusWord = $matches[2];
                    $statusPart = trim(substr($line, (int) strpos($line, $statusWord)));
                    $output[] = rtrim($prev)." {$formattedDots} {$statusPart}";

                    continue;
                }
            }

            $dotsReplacement = $stripAnsi ? '....................' : "\033[90m....................\033[39m";
            $line = preg_replace('/((?:\033\[90m)?\.(?:\033\[39m)?|\[90m\.\[39m|\.){15,}/', $dotsReplacement, $line);
            $line = self::cleanOrphanedAnsi($line);

            if ($stripAnsi) {
                $line = self::stripAnsi($line);
            }

            $output[] = $line;
        }

        $result = implode("\n", $output);

        return $stripAnsi ? self::stripAnsi($result) : $result;
    }

    public static function cleanOrphanedAnsi(string $text): string
    {
        return preg_replace('/(?<!\033)\[(?:\d{1,3}(?:;\d{1,3})*)?m/', '', $text) ?? $text;
    }

    public static function stripAnsi(string $text): string
    {
        $text = preg_replace('/\033\[[0-9;]*[a-zA-Z]/', '', $text) ?? $text;
        $text = preg_replace('/\033\][^\007\033]*(?:\007|\033\\\\)/', '', $text) ?? $text;

        return self::cleanOrphanedAnsi($text);
    }
}
