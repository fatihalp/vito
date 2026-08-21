# Vito Deployment Guide

Quick deployment reference for running Vito in production or development.

---

## 1. Required Services

| Service | Command | Purpose |
| :--- | :--- | :--- |
| **Web Server** | Nginx / Caddy + PHP-FPM or `php artisan serve` | Serves HTTP traffic and UI. |
| **Redis** | `redis-server` | Cache, atomic locks (`UniqueQueue`), and Horizon queues. |
| **Horizon** | `php artisan horizon` | Asynchronous background jobs (SSH, provisioning, backups). |
| **WebSocket** | `php artisan ws:serve --port=8085` | Real-time web terminal and broadcast events. |
| **Scheduler** | `* * * * * php artisan schedule:run` | Periodic health checks, metric gathering, SSL renewal. |

---

## 2. All-in-One Service Runner (`php artisan vito`)

To automatically launch all required services concurrently:

```bash
php artisan vito
```

### Options

```bash
# Include built-in HTTP server:
php artisan vito --serve

# Custom host & ports:
php artisan vito --serve --host=0.0.0.0 --port=8000 --ws-port=8085

# Exclude specific services:
php artisan vito --no-horizon
php artisan vito --no-schedule
php artisan vito --no-ws
```

---

## 3. Production Setup

```bash
cd /var/www/vito

# Install dependencies
composer install --no-dev --optimize-autoloader
npm ci && npm run build

# Environment & database
cp .env.example .env
php artisan key:generate
php artisan ssh-key:generate
php artisan migrate --force
php artisan storage:link

# Optimizations
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## 4. Supervisor Configuration

### Horizon (`/etc/supervisor/conf.d/vito-horizon.conf`)

```ini
[program:vito-horizon]
command=php /var/www/vito/artisan horizon
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/vito/storage/logs/horizon.log
stopwaitsecs=3600
```

### WebSocket (`/etc/supervisor/conf.d/vito-ws.conf`)

```ini
[program:vito-ws]
command=php /var/www/vito/artisan ws:serve --port=8085
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/vito/storage/logs/ws.log
stopwaitsecs=30
```

Apply supervisor configs:

```bash
sudo supervisorctl reread && sudo supervisorctl update && sudo supervisorctl start all
```

---

## 5. Cron Scheduler

Add to crontab (`crontab -e -u www-data`):

```cron
* * * * * cd /var/www/vito && php artisan schedule:run >> /dev/null 2>&1
```

---

## 6. Nginx Reverse Proxy (HTTP & WebSocket)

```nginx
server {
    listen 80;
    server_name vito.example.com;
    root /var/www/vito/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # WebSocket Proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```
