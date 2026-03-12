@if($ssl && $domain)
{
    admin off
    frankenphp
}

{{ $domain }} {
    root * {{ $root }}
    encode zstd gzip
    tls {{ $email }}

    reverse_proxy /ws/* 127.0.0.1:{{ $wsPort }} {
        header_up Upgrade {>Upgrade}
        header_up Connection {>Connection}
    }

    php_server
}
@else
{
    auto_https off
    admin off
    frankenphp
}

:{{ $port }} {
    root * {{ $root }}
    encode zstd gzip

    reverse_proxy /ws/* 127.0.0.1:{{ $wsPort }} {
        header_up Upgrade {>Upgrade}
        header_up Connection {>Connection}
    }

    php_server
}
@endif
