<?php

namespace App\Traits;

trait ParsesVitoLimits
{
    /**
     * Extract and normalize limit values from a vito config array.
     *
     * @return array<string, int>
     */
    protected function extractVitoLimits(array $config): array
    {
        $rawLimits = [];
        if (isset($config['limits']) && is_array($config['limits'])) {
            $rawLimits = $config['limits'];
        }

        $limitKeys = [
            'client_max_body_size',
            'upload_max_filesize',
            'post_max_size',
            'memory_limit',
            'max_execution_time',
            'max_input_vars',
            'max_upload_size',
        ];

        foreach ($limitKeys as $key) {
            if (isset($config[$key]) && ! isset($rawLimits[$key])) {
                $rawLimits[$key] = $config[$key];
            }
        }

        $limits = [];

        foreach (['client_max_body_size', 'upload_max_filesize', 'post_max_size', 'memory_limit', 'max_upload_size'] as $sizeKey) {
            if (isset($rawLimits[$sizeKey])) {
                $parsed = $this->parseLimitToMb($rawLimits[$sizeKey]);
                if ($parsed !== null) {
                    $limits[$sizeKey] = $parsed;
                }
            }
        }

        if (isset($rawLimits['max_execution_time'])) {
            $parsed = $this->parseLimitToSeconds($rawLimits['max_execution_time']);
            if ($parsed !== null) {
                $limits['max_execution_time'] = $parsed;
            }
        }

        if (isset($rawLimits['max_input_vars'])) {
            $val = $rawLimits['max_input_vars'];
            if (is_numeric($val) && (int) $val > 0) {
                $limits['max_input_vars'] = (int) $val;
            }
        }

        return $limits;
    }

    /**
     * Parse human size values like '210M', '512MB', '1G', 210 to an integer representing megabytes.
     */
    protected function parseLimitToMb(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_int($value) && $value > 0) {
            return $value;
        }

        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d+)\s*(g|gb)$/i', $value, $matches)) {
            return ((int) $matches[1]) * 1024;
        }

        if (preg_match('/^(\d+)\s*(m|mb)?$/i', $value, $matches)) {
            return (int) $matches[1];
        }

        if (preg_match('/^(\d+)\s*(k|kb)$/i', $value, $matches)) {
            return max(1, (int) ceil(((int) $matches[1]) / 1024));
        }

        return null;
    }

    /**
     * Parse execution time values like 300, '300s', '5m' to seconds.
     */
    protected function parseLimitToSeconds(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        if (is_int($value) && $value > 0) {
            return $value;
        }

        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }

        if (preg_match('/^(\d+)\s*m$/i', $value, $matches)) {
            return ((int) $matches[1]) * 60;
        }

        if (preg_match('/^(\d+)\s*s?$/i', $value, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }
}
