<?php

namespace App\Actions\Database;

use App\Enums\SiteResourceType;
use App\Models\Database;
use App\Models\Server;
use App\Models\SiteResource;
use App\Services\Database\Postgresql;
use App\Services\RuntimeProcess\RuntimeCommand;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class BrowsePostgresDatabase
{
    public function database(Database $database, array $input): array
    {
        return $this->browse($database->server, $database->name, $input);
    }

    public function resource(SiteResource $resource, array $input): array
    {
        if ($resource->type !== SiteResourceType::DATABASE || ! $resource->server) {
            throw ValidationException::withMessages(['database' => __('Select a database resource.')]);
        }

        $configuration = $resource->configuration;
        $database = ! empty($configuration['database_id'])
            ? Database::query()->where('server_id', $resource->server_id)->findOrFail($configuration['database_id'])
            : null;
        $name = $database?->name ?? $configuration['database_name'] ?? '';

        return $this->browse($resource->server, $name, $input, $configuration['runtime'] ?? []);
    }

    private function browse(Server $server, string $database, array $input, array $runtime = []): array
    {
        $data = Validator::make($input, [
            'schema' => ['nullable', 'string', 'max:128'],
            'table' => ['nullable', 'string', 'max:128'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
        ])->validate();
        $schema = $data['schema'] ?? 'public';
        $table = $data['table'] ?? null;

        if (str_starts_with($schema, 'pg_') || $schema === 'information_schema') {
            throw ValidationException::withMessages(['schema' => __('Select an application schema.')]);
        }

        if (! $table) {
            return ['tables' => $this->query($server, $database, $runtime, <<<'SQL'
                SELECT COALESCE(json_agg(json_build_object('schema', n.nspname, 'name', c.relname, 'estimated_rows', GREATEST(c.reltuples::bigint, 0)) ORDER BY n.nspname, c.relname), '[]')
                FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relkind IN ('r', 'p') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
                SQL)];
        }

        $schemaValue = $this->literal($schema);
        $tableValue = $this->literal($table);
        $columns = $this->query($server, $database, $runtime, <<<SQL
            SELECT COALESCE(json_agg(json_build_object('name', a.attname, 'type', pg_catalog.format_type(a.atttypid, a.atttypmod)) ORDER BY a.attnum), '[]')
            FROM pg_catalog.pg_attribute a
            JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = {$schemaValue} AND c.relname = {$tableValue} AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
            SQL);

        if ($columns === []) {
            throw ValidationException::withMessages(['table' => __('The table was not found or has no visible columns.')]);
        }
        if (count($columns) > 200) {
            throw ValidationException::withMessages(['table' => __('This table has too many columns for the browser.')]);
        }

        $select = implode(', ', array_map(function (array $column): string {
            $name = $this->identifier($column['name']);

            return $column['type'] === 'bytea'
                ? "'[Binary value omitted]' AS {$name}"
                : "CASE WHEN pg_column_size({$name}) > 65536 THEN '[Large value omitted]' ELSE LEFT({$name}::text, 2048) END AS {$name}";
        }, $columns));
        $relation = $this->identifier($schema).'.'.$this->identifier($table);
        $page = (int) ($data['page'] ?? 1);
        $offset = ($page - 1) * 25;
        $rows = $this->query($server, $database, $runtime, "SELECT COALESCE(json_agg(row_to_json(records)), '[]') FROM (SELECT {$select} FROM {$relation} LIMIT 26 OFFSET {$offset}) records");

        return ['columns' => $columns, 'rows' => array_slice($rows, 0, 25), 'page' => $page, 'has_more' => count($rows) > 25];
    }

    private function query(Server $server, string $database, array $runtime, string $sql): array
    {
        if ($database === '' || str_contains($database, '=') || str_contains($database, ':') || str_contains($database, "\0")) {
            throw ValidationException::withMessages(['database' => __('The database connection has not been registered.')]);
        }
        $driver = $runtime['driver'] ?? 'native';
        if (in_array($driver, ['docker', 'rootless_docker'], true)) {
            $validated = Validator::make($runtime, [
                'container' => ['required', 'string', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/'],
                'username' => ['required', 'string', 'max:63'],
            ])->validate();
            $prefix = app(RuntimeCommand::class)->prefix($server, $driver, (string) ($runtime['unix_user'] ?? ''));
            $command = $prefix.' exec -i '.escapeshellarg($validated['container']).' psql -h /var/run/postgresql -p 5432 -U '.escapeshellarg($validated['username']);
            $ssh = $server->ssh()->clearLog();
        } else {
            if ($server->database()?->name !== Postgresql::id()) {
                throw ValidationException::withMessages(['database' => __('The data browser currently supports PostgreSQL.')]);
            }
            $command = 'psql -h /var/run/postgresql -p 5432';
            $ssh = $server->ssh()->clearLog()->asUser('postgres');
        }

        $transaction = "BEGIN READ ONLY; SET LOCAL statement_timeout = '5s'; SET LOCAL lock_timeout = '1s'; SET LOCAL search_path = pg_catalog; ".$sql.'; COMMIT;';
        $output = $ssh->exec(
            $command.' -X -q -A -t -v ON_ERROR_STOP=1 --dbname='.escapeshellarg($database).' -c '.escapeshellarg($transaction),
            timeout: 15,
        );

        if (strlen($output) > 4 * 1024 * 1024) {
            throw ValidationException::withMessages(['table' => __('The response is too large for the browser.')]);
        }

        return json_decode(trim($output), true, flags: JSON_THROW_ON_ERROR);
    }

    private function identifier(string $value): string
    {
        return '"'.str_replace('"', '""', $value).'"';
    }

    private function literal(string $value): string
    {
        return "convert_from(decode('".bin2hex($value)."', 'hex'), 'UTF8')";
    }
}
