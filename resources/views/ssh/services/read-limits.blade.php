NGINX_LIMIT=""
if [ -f /etc/nginx/conf.d/limits.conf ]; then
    NGINX_LIMIT=$(grep 'client_max_body_size' /etc/nginx/conf.d/limits.conf 2>/dev/null | head -n1 | awk '{print $2}' | tr -d ';')
fi
if [ -z "$NGINX_LIMIT" ] && [ -f /etc/nginx/nginx.conf ]; then
    NGINX_LIMIT=$(grep 'client_max_body_size' /etc/nginx/nginx.conf 2>/dev/null | head -n1 | awk '{print $2}' | tr -d ';')
fi
echo "NGINX:$NGINX_LIMIT"

@foreach($phpVersions as $ver)
UPLOAD=""
POST=""
MEM=""
TIME=""
INI="/etc/php/{{ $ver }}/fpm/php.ini"
if [ -f "$INI" ]; then
    UPLOAD=$(grep -E '^[; ]*upload_max_filesize[[:space:]]*=' "$INI" 2>/dev/null | head -n1 | awk -F'=' '{print $2}' | tr -d ' ' | tr -d '\r')
    POST=$(grep -E '^[; ]*post_max_size[[:space:]]*=' "$INI" 2>/dev/null | head -n1 | awk -F'=' '{print $2}' | tr -d ' ' | tr -d '\r')
    MEM=$(grep -E '^[; ]*memory_limit[[:space:]]*=' "$INI" 2>/dev/null | head -n1 | awk -F'=' '{print $2}' | tr -d ' ' | tr -d '\r')
    TIME=$(grep -E '^[; ]*max_execution_time[[:space:]]*=' "$INI" 2>/dev/null | head -n1 | awk -F'=' '{print $2}' | tr -d ' ' | tr -d '\r')
fi
echo "PHP_{{ $ver }}:$UPLOAD|$POST|$MEM|$TIME"
@endforeach
