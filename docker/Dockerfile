FROM ubuntu:24.04

WORKDIR /var/www/html

ENV DEBIAN_FRONTEND=noninteractive

# upgrade
RUN apt-get update && apt-get upgrade -y && apt-get autoremove -y

# requirements
RUN apt-get install -y software-properties-common curl zip unzip gcc redis-server git \
  cron gnupg gosu ca-certificates supervisor libcap2-bin libpng-dev \
  dnsutils librsvg2-bin fswatch wget openssh-client

# frankenphp
RUN ARCH=$(dpkg --print-architecture) \
  && if [ "$ARCH" = "amd64" ]; then ARCH="x86_64"; elif [ "$ARCH" = "arm64" ]; then ARCH="aarch64"; fi \
  && curl -L -o /usr/local/bin/frankenphp \
    "https://github.com/dunglas/frankenphp/releases/latest/download/frankenphp-linux-${ARCH}" \
  && chmod +x /usr/local/bin/frankenphp \
  && setcap cap_net_bind_service=+ep /usr/local/bin/frankenphp

# create php wrapper so @php and /usr/bin/env php work with FrankenPHP
RUN printf '#!/bin/sh\nexec /usr/local/bin/frankenphp php-cli "$@"\n' > /usr/local/bin/php \
  && chmod +x /usr/local/bin/php

# composer (uses FrankenPHP's bundled PHP)
RUN curl -sS https://getcomposer.org/installer | /usr/local/bin/frankenphp php-cli -- --install-dir=/usr/local/bin --filename=composer

# app
RUN rm -rf /var/www/html
COPY . /var/www/html
RUN rm -rf /var/www/html/.git /var/www/html/vendor /var/www/html/node_modules
RUN COMPOSER_ALLOW_SUPERUSER=1 /usr/local/bin/frankenphp php-cli /usr/local/bin/composer install --no-dev --no-scripts \
  && /usr/local/bin/frankenphp php-cli artisan package:discover --ansi
RUN chown -R www-data:www-data /var/www/html \
  && chmod -R 755 /var/www/html/storage /var/www/html/bootstrap/cache

RUN echo "* * * * * cd /var/www/html && /usr/local/bin/frankenphp php-cli artisan schedule:run >> /var/log/cron.log 2>&1" | crontab -

# supervisord
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# start
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80

CMD ["/start.sh"]
