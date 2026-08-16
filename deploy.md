# Vito Dağıtım ve Servis Rehberi (Deployment Guide)

Bu rehber, Vito'nun sağlıklı çalışabilmesi için gereken servisleri, otomatik başlatma komutunu ve canlı ortam (production) yapılandırmasını içerir.

---

## 1. Gerekli Servisler

Vito aşağıdaki bileşen ve servislerin çalışmasına ihtiyaç duyar:

| Servis | Komut / Süreç | Açıklama |
| :--- | :--- | :--- |
| **Web Server** | Nginx / Caddy / PHP-FPM veya `php artisan serve` | HTTP isteklerini ve web arayüzünü sunar. |
| **Redis** | `redis-server` | Önbellek, atomik kilitler (`UniqueQueue`) ve kuyruklar (Horizon) için zorunludur. |
| **Queue Worker (Horizon)** | `php artisan horizon` | Sunucu kurulumları, SSH komutları, firewall/ağ senkronizasyonları, yedekleme gibi tüm arka plan işlerini yürütür. |
| **WebSocket Sunucusu** | `php artisan ws:serve` (Port: `8085`) | Web tabanlı interaktif SSH terminali ve anlık durum bildirimleri (broadcast events) için gereklidir. |
| **Zamanlayıcı (Scheduler)** | `php artisan schedule:run` (Cron) veya `php artisan schedule:work` | Sunucu sağlık kontrolleri, otomatik güncellemeler, metrik toplama, SSL yenileme ve ağ mutabakatı işlerini tetikler. |

---

## 2. Servisleri Otomatik Çalıştırma (`php artisan vito`)

Gerekli tüm arka plan servislerini tek bir komutla çalıştırmak için:

```bash
php artisan vito
```

Bu komut eşzamanlı olarak:
- **Laravel Horizon** (`php artisan horizon`)
- **Zamanlayıcı İşçisi** (`php artisan schedule:work`)
- **WebSocket Sunucusu** (`php artisan ws:serve`)

servislerini başlatır ve çıktılarını renkli konsol logları ile canlı olarak gösterir. `Ctrl+C` ile durdurulduğunda tüm alt süreçleri güvenli ve temiz bir şekilde kapatır.

### Seçenekler ve Parametreler

```bash
# Dahili web sunucusu ile birlikte başlatmak için:
php artisan vito --serve

# Özel port ve host belirterek başlatmak için:
php artisan vito --serve --host=0.0.0.0 --port=8000 --ws-port=8085

# İstenmeyen servisleri devre dışı bırakmak için:
php artisan vito --no-horizon
php artisan vito --no-schedule
php artisan vito --no-ws
```

---

## 3. Canlı Ortam (Production) Kurulum Adımları

### 3.1. Kod ve Bağımlılıklar

```bash
cd /var/www/vito

# 1. Ortam dosyasını hazırlayın
cp .env.example .env
# .env dosyasındaki APP_URL, DB_*, REDIS_*, WS_* değerlerini düzenleyin

# 2. PHP bağımlılıklarını kurun
composer install --no-dev --optimize-autoloader

# 3. Uygulama anahtarlarını üretin
php artisan key:generate
php artisan ssh-key:generate

# 4. Veritabanı tablolarını oluşturun
php artisan migrate --force

# 5. Depolama linkini oluşturun
php artisan storage:link

# 6. Ön yüz (Frontend) varlıklarını derleyin
npm ci
npm run build

# 7. Önbellekleri optimize edin
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

## 4. Production Servis Yöneticisi Yapılandırması (Supervisor & Cron)

Canlı ortamda servislerin sürekli ayakta kalması ve yeniden başlatılabilmesi için **Supervisor** ve **Crontab** kullanılmalıdır.

### 4.1. Supervisor: Laravel Horizon (`/etc/supervisor/conf.d/vito-horizon.conf`)

```ini
[program:vito-horizon]
process_name=%(program_name)s
command=php /var/www/vito/artisan horizon
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/vito/storage/logs/horizon.log
stopwaitsecs=3600
```

### 4.2. Supervisor: WebSocket Server (`/etc/supervisor/conf.d/vito-ws.conf`)

```ini
[program:vito-ws]
process_name=%(program_name)s
command=php /var/www/vito/artisan ws:serve --port=8085
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/www/vito/storage/logs/ws.log
stopwaitsecs=30
```

Supervisor'ı güncellemek ve servisleri başlatmak için:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

### 4.3. Cron: Laravel Zamanlayıcı

Sunucu crontab dosyasına (`crontab -e -u www-data`) aşağıdaki satırı ekleyin:

```cron
* * * * * cd /var/www/vito && php artisan schedule:run >> /dev/null 2>&1
```

---

## 5. Nginx Yapılandırması (Web & WebSocket Reverse Proxy)

```nginx
server {
    listen 80;
    server_name vito.yourdomain.com;
    root /var/www/vito/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;
    charset utf-8;

    # Normal HTTP İstekleri
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # WebSocket Proxy (/ws/)
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

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

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
