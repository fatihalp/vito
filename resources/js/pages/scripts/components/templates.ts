export interface ScriptTemplate {
  id: string;
  label: string;
  name: string;
  category: 'Deploy' | 'Cache' | 'Database' | 'Queues' | 'Maintenance' | 'Server';
  description: string;
  content: string;
  isPopular?: boolean;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'deploy-optimize',
    label: 'Deploy & Optimize',
    name: 'Deploy & Optimize',
    category: 'Deploy',
    isPopular: true,
    description: 'Pull latest code, install composer dependencies, migrate database, and optimize caches',
    content: `cd \${SITE_PATH}

echo "--> Pulling latest code changes..."
git pull origin \${BRANCH:-main}

echo "--> Installing composer dependencies..."
composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "--> Running database migrations..."
php artisan migrate --force

echo "--> Optimizing Laravel caches..."
php artisan optimize:clear
php artisan optimize

echo "--> Restarting queue workers..."
php artisan queue:restart

echo "Deployment finished successfully!"`,
  },
  {
    id: 'optimize-warm-cache',
    label: 'Optimize & Warm Cache',
    name: 'Optimize & Warm Cache',
    category: 'Cache',
    isPopular: true,
    description: 'Clear previous cache and cache config, routes, views, and events for production speed',
    content: `cd \${SITE_PATH}

echo "--> Clearing old caches..."
php artisan optimize:clear

echo "--> Caching configuration..."
php artisan config:cache

echo "--> Caching routes..."
php artisan route:cache

echo "--> Caching views..."
php artisan view:cache

echo "--> Caching events..."
php artisan event:cache

echo "Laravel caches warmed up successfully!"`,
  },
  {
    id: 'purge-all-caches',
    label: 'Purge All Caches',
    name: 'Purge All Caches',
    category: 'Cache',
    isPopular: true,
    description: 'Flush application, config, route, view, and compiled class caches',
    content: `cd \${SITE_PATH}

echo "--> Flushing application cache..."
php artisan cache:clear

echo "--> Clearing route cache..."
php artisan route:clear

echo "--> Clearing config cache..."
php artisan config:clear

echo "--> Clearing view cache..."
php artisan view:clear

echo "--> Clearing event cache..."
php artisan event:clear

echo "--> Clearing compiled classes..."
php artisan clear-compiled

echo "All Laravel caches purged!"`,
  },
  {
    id: 'maintenance-down',
    label: 'Maintenance Mode (Down)',
    name: 'Enable Maintenance Mode',
    category: 'Maintenance',
    description: 'Take application offline with a custom secret bypass token',
    content: `cd \${SITE_PATH}

# Enable maintenance mode with bypass token
# Access your site at: https://your-site.com/\${SECRET_TOKEN:-bypass123}
php artisan down --secret="\${SECRET_TOKEN:-bypass123}" --render="errors::503"

echo "Application is now in maintenance mode."
echo "Bypass URL secret: \${SECRET_TOKEN:-bypass123}"`,
  },
  {
    id: 'maintenance-up',
    label: 'Maintenance Mode (Up)',
    name: 'Disable Maintenance Mode',
    category: 'Maintenance',
    description: 'Bring the application back online out of maintenance mode',
    content: `cd \${SITE_PATH}

php artisan up

echo "Application is now online and live!"`,
  },
  {
    id: 'migrate-force',
    label: 'Run Migrations',
    name: 'Run Migrations (Force)',
    category: 'Database',
    description: 'Safely execute all pending database migrations in production force mode',
    content: `cd \${SITE_PATH}

echo "--> Running database migrations..."
php artisan migrate --force

echo "Database migrations completed!"`,
  },
  {
    id: 'migrate-fresh-seed',
    label: 'Fresh & Seed DB',
    name: 'Fresh Migration & Seed',
    category: 'Database',
    description: 'Drop all tables, re-run all migrations and seed data (Dev/Staging)',
    content: `cd \${SITE_PATH}

echo "--> Dropping all tables, migrating fresh and seeding..."
php artisan migrate:fresh --seed --force

echo "Database fresh migration and seed completed!"`,
  },
  {
    id: 'restart-queues',
    label: 'Restart Queues & Horizon',
    name: 'Restart Queues & Horizon',
    category: 'Queues',
    description: 'Gracefully restart queue workers and instruct Horizon to reload',
    content: `cd \${SITE_PATH}

echo "--> Restarting queue workers..."
php artisan queue:restart

echo "--> Terminating Horizon for reload..."
php artisan horizon:terminate 2>/dev/null || true

echo "Queue workers and Horizon restarted successfully!"`,
  },
  {
    id: 'fix-storage-permissions',
    label: 'Fix Storage & Permissions',
    name: 'Fix Storage Link & Permissions',
    category: 'Server',
    description: 'Create storage symlink and apply write permissions to storage & cache folders',
    content: `cd \${SITE_PATH}

echo "--> Creating storage symlink..."
php artisan storage:link 2>/dev/null || true

echo "--> Setting write permissions for storage and bootstrap/cache..."
chmod -R 775 storage bootstrap/cache
chmod -R 775 storage/logs storage/framework 2>/dev/null || true

echo "Storage symlink and permissions updated!"`,
  },
  {
    id: 'mysql-backup-dump',
    label: 'MySQL Backup Dump',
    name: 'MySQL Database Backup',
    category: 'Database',
    description: 'Create a timestamped compressed MySQL database dump file',
    content: `DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="\${BACKUP_DIR:-/tmp/backups}"

mkdir -p "$BACKUP_DIR"

echo "--> Exporting database \${DB_DATABASE}..."
mysqldump -u \${DB_USER:-root} -p'\${DB_PASSWORD}' \${DB_DATABASE} > "$BACKUP_DIR/\${DB_DATABASE}_$DATE.sql"

echo "--> Compressing SQL dump..."
gzip -f "$BACKUP_DIR/\${DB_DATABASE}_$DATE.sql"

echo "Database backup created at: $BACKUP_DIR/\${DB_DATABASE}_$DATE.sql.gz"`,
  },
  {
    id: 'purge-monitoring-logs',
    label: 'Purge Telescope & Pulse',
    name: 'Purge Monitoring Data',
    category: 'Maintenance',
    description: 'Purge old records from Laravel Telescope and Laravel Pulse database tables',
    content: `cd \${SITE_PATH}

echo "--> Pruning Laravel Telescope entries..."
php artisan telescope:prune --hours=0 2>/dev/null || true

echo "--> Purging Laravel Pulse entries..."
php artisan pulse:clear --force 2>/dev/null || true

echo "Monitoring data purged successfully!"`,
  },
  {
    id: 'reload-php-fpm',
    label: 'Reload PHP-FPM / OPcache',
    name: 'Reload PHP-FPM & Reset OPcache',
    category: 'Server',
    description: 'Reload PHP-FPM service to clear OPcache bytecode and reload worker pool',
    content: `PHP_VER="\${PHP_VERSION:-8.3}"

echo "--> Reloading PHP-FPM for PHP $PHP_VER..."
if systemctl is-active --quiet php$PHP_VER-fpm; then
    sudo systemctl reload php$PHP_VER-fpm
elif systemctl is-active --quiet php-fpm; then
    sudo systemctl reload php-fpm
else
    echo "PHP-FPM service for PHP $PHP_VER not found."
fi

echo "PHP-FPM reloaded successfully!"`,
  },
];
