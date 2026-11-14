<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;

function generate_public_key(string $privateKeyPath, string $publicKeyPath): void
{
    if (file_exists($privateKeyPath)) {
        chmod($privateKeyPath, 0400);
        exec('ssh-keygen -y -f '.escapeshellarg($privateKeyPath).' > '.escapeshellarg($publicKeyPath));
    }
}

function generate_key_pair(string $path): void
{
    File::ensureDirectoryExists(dirname($path));

    if (file_exists($path)) {
        @unlink($path);
    }
    if (file_exists("{$path}.pub")) {
        @unlink("{$path}.pub");
    }

    exec("ssh-keygen -t ed25519 -N '' -q -f ".escapeshellarg($path));

    if (! file_exists($path)) {
        throw new RuntimeException('Failed to generate SSH key pair.');
    }

    chmod($path, 0400);
}

function convert_time_format(string $string): string
{
    $string = preg_replace('/(\d+)m/', '$1 minutes', $string);
    $string = preg_replace('/(\d+)s/', '$1 seconds', (string) $string);
    $string = preg_replace('/(\d+)d/', '$1 days', (string) $string);

    return (string) preg_replace('/(\d+)h/', '$1 hours', (string) $string);
}

function get_public_key_content(): string
{
    if (cache()->has('ssh_public_key_content')) {
        return cache()->get('ssh_public_key_content');
    }

    if (! file_exists(storage_path(config('core.ssh_public_key_name')))) {
        Artisan::call('ssh-key:generate --force');
    }

    $content = file_get_contents(storage_path(config('core.ssh_public_key_name')));

    if ($content === false) {
        return '';
    }

    $content = str($content)
        ->replace("\n", '')
        ->toString();

    cache()->put('ssh_public_key_content', $content, 60 * 60 * 24);

    return $content;
}

function tail(string $filepath, int $lines = 1, bool $adaptive = true): string
{
    
    $f = @fopen($filepath, 'rb');
    if ($f === false) {
        return '';
    }

    
    
    if (! $adaptive) {
        $buffer = 4096;
    } else {
        $buffer = ($lines < 2 ? 64 : ($lines < 10 ? 512 : 4096));
    }

    
    fseek($f, -1, SEEK_END);

    
    
    if (fread($f, 1) != "\n") {
        $lines -= 1;
    }

    
    $output = '';
    $chunk = '';

    
    while (ftell($f) > 0 && $lines >= 0) {
        
        $seek = min(ftell($f), $buffer);

        
        fseek($f, -$seek, SEEK_CUR);

        
        $output = ($chunk = fread($f, $seek)).$output;

        
        fseek($f, -mb_strlen($chunk !== false ? $chunk : '', '8bit'), SEEK_CUR);

        
        $lines -= substr_count($chunk !== false ? $chunk : '', "\n");
    }

    
    
    while ($lines++ < 0) {
        
        $output = substr($output, strpos($output, "\n") + 1);
    }

    
    fclose($f);

    return trim($output);
}

function home_path(string $user): string
{
    if ($user === 'root') {
        return '/root';
    }

    return '/home/'.$user;
}

function format_webserver_config(string $config): string
{
    $lines = explode("\n", trim($config));
    $indent = 0;
    $formattedLines = [];
    $lastWasEmpty = false;

    foreach ($lines as $line) {
        $trimmed = trim($line);

        if ($trimmed === '') {
            if (! $lastWasEmpty) {
                $formattedLines[] = '';
                $lastWasEmpty = true;
            }

            continue;
        }

        $lastWasEmpty = false;

        if ($trimmed === '}') {
            $indent--;
            if (end($formattedLines) === '') {
                array_pop($formattedLines);
            }
        }

        $formattedLines[] = str_repeat('    ', max(0, $indent)).$trimmed;

        if (str_ends_with($trimmed, '{')) {
            $indent++;
        }
    }

    while (! empty($formattedLines) && $formattedLines[0] === '') {
        array_shift($formattedLines);
    }
    while (! empty($formattedLines) && end($formattedLines) === '') {
        array_pop($formattedLines);
    }

    return implode("\n", $formattedLines)."\n";
}

function user(): ?User
{
    return Auth::user();
}

function move_directory(string $from, string $to): void
{
    
    if (File::exists($to)) {
        File::deleteDirectory($to);
    }

    
    File::ensureDirectoryExists(dirname($to));

    
    if (! File::copyDirectory($from, $to)) {
        throw new RuntimeException("Could not copy [$from] to [$to]");
    }

    File::deleteDirectory($from);
}
