<?php

namespace App\Helpers;

class EnvParser
{
    
    private const SECRET_PATTERNS = ['PASSWORD', 'SECRET', 'TOKEN', 'KEY', 'PRIVATE'];

    
    public static function isSecretKey(string $key): bool
    {
        $upperKey = strtoupper($key);

        foreach (self::SECRET_PATTERNS as $pattern) {
            if (str_contains($upperKey, $pattern)) {
                return true;
            }
        }

        return false;
    }

    
    public static function parse(string $raw): array
    {
        $variables = [];
        $lines = explode("\n", $raw);

        foreach ($lines as $line) {
            $trimmedLine = trim($line);

            
            if ($trimmedLine === '' || str_starts_with($trimmedLine, '#')) {
                continue;
            }

            
            $equalsIndex = strpos($trimmedLine, '=');
            if ($equalsIndex === false) {
                continue;
            }

            $key = trim(substr($trimmedLine, 0, $equalsIndex));
            $value = substr($trimmedLine, $equalsIndex + 1);

            $wasDoubleQuoted = strlen($value) >= 2
                && str_starts_with($value, '"')
                && str_ends_with($value, '"');

            if (
                $wasDoubleQuoted ||
                (strlen($value) >= 2 && str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            if ($wasDoubleQuoted) {
                $value = preg_replace_callback('/\\\\(.)/s', fn (array $matches): string => match ($matches[1]) {
                    'n' => "\n",
                    'r' => "\r",
                    '"' => '"',
                    '\\' => '\\',
                    default => $matches[0],
                }, $value) ?? $value;
            }

            if ($key !== '') {
                $variables[] = [
                    'key' => $key,
                    'value' => $value,
                    'is_secret' => self::isSecretKey($key),
                ];
            }
        }

        return $variables;
    }

    
    public static function isRepresentable(string $content, array $variables): bool
    {
        $shapeOk = collect(explode("\n", $content))
            ->map(fn (string $line): string => trim($line))
            ->every(function (string $line): bool {
                if ($line === '' || str_starts_with($line, '#')) {
                    return true;
                }

                $index = strpos($line, '=');

                if ($index === false || preg_match('/^[^\s=]+\s*=/', $line) !== 1) {
                    return false;
                }

                $value = ltrim(substr($line, $index + 1));

                foreach (['"', "'"] as $quote) {
                    if (str_starts_with($value, $quote)) {
                        return self::closesQuote($value, $quote);
                    }
                }

                return true;
            });

        return $shapeOk && self::parse(self::stringify($variables)) === $variables;
    }

    
    private static function closesQuote(string $value, string $quote): bool
    {
        $escaped = false;
        $length = strlen($value);

        for ($i = 1; $i < $length; $i++) {
            if ($escaped) {
                $escaped = false;

                continue;
            }

            if ($quote === '"' && $value[$i] === '\\') {
                $escaped = true;

                continue;
            }

            if ($value[$i] === $quote) {
                return true;
            }
        }

        return false;
    }

    
    public static function stringify(array $variables): string
    {
        $lines = [];

        foreach ($variables as $variable) {
            $key = trim($variable['key']);
            $value = $variable['value'];

            if ($key === '') {
                continue;
            }

            $needsQuotes = preg_match('/\s/', $value) === 1
                || str_contains($value, '#')
                || str_starts_with($value, '"')
                || str_starts_with($value, "'");

            if (! $needsQuotes) {
                $lines[] = "{$key}={$value}";

                continue;
            }

            if (
                str_contains($value, '"')
                && ! str_contains($value, "'")
                && ! str_contains($value, '\\')
                && ! str_contains($value, "\n")
                && ! str_contains($value, "\r")
            ) {
                $lines[] = "{$key}='{$value}'";

                continue;
            }

            $escapedValue = str_replace(['\\', "\n", "\r", '"'], ['\\\\', '\\n', '\\r', '\\"'], $value);
            $lines[] = "{$key}=\"{$escapedValue}\"";
        }

        return implode("\n", $lines);
    }

    
    public static function patch(string $raw, array $values): string
    {
        $newline = str_contains($raw, "\r\n") ? "\r\n" : "\n";
        $lines = $raw === '' ? [] : (preg_split('/\r?\n/', $raw) ?: []);
        $matched = [];

        foreach ($lines as $index => $line) {
            foreach ($values as $key => $value) {
                if (preg_match('/^\s*(?:export\s+)?'.preg_quote($key, '/').'\s*=/', $line) !== 1) {
                    continue;
                }

                $matched[$key] = true;
                $lines[$index] = $value === null
                    ? null
                    : self::stringify([['key' => $key, 'value' => $value]]);
                break;
            }
        }

        $lines = array_values(array_filter($lines, fn (?string $line): bool => $line !== null));

        foreach ($values as $key => $value) {
            if ($value === null || isset($matched[$key])) {
                continue;
            }

            $lines[] = self::stringify([['key' => $key, 'value' => $value]]);
        }

        return implode($newline, $lines);
    }

    
    public static function secretKeys(?array $stored): array
    {
        if ($stored === null) {
            return [];
        }

        $keys = [];

        foreach ($stored as $entry) {
            if (is_string($entry)) {
                $keys[] = $entry;

                continue;
            }

        }

        return array_values(array_unique($keys));
    }

    
    public static function classify(array $parsed, ?array $stored): array
    {
        if ($stored === null) {
            return $parsed;
        }

        $secretKeys = array_flip(self::secretKeys($stored));

        return array_map(function ($variable) use ($secretKeys) {
            $variable['is_secret'] = isset($secretKeys[$variable['key']]);

            return $variable;
        }, $parsed);
    }

    
    public static function maskSecrets(array $variables): array
    {
        return array_map(function ($variable) {
            if ($variable['is_secret']) {
                $variable['value'] = '';
            }

            return $variable;
        }, $variables);
    }

    
    public static function mergeWithLive(array $incoming, array $live): array
    {
        $liveMap = [];
        foreach ($live as $variable) {
            $liveMap[$variable['key']] = $variable['value'];
        }

        return array_map(function ($variable) use ($liveMap) {
            $key = $variable['key'];

            if ($variable['is_secret'] && $variable['value'] === '' && isset($liveMap[$key])) {
                $variable['value'] = $liveMap[$key];
            }

            return $variable;
        }, $incoming);
    }
}
