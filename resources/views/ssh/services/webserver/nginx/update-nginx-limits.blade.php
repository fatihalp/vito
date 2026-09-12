sudo mkdir -p /etc/nginx/conf.d

echo "client_max_body_size {{ $client_max_body_size }};" | sudo tee /etc/nginx/conf.d/limits.conf > /dev/null

if ! sudo nginx -t; then
    echo 'VITO_SSH_ERROR' && exit 1
fi

if ! sudo systemctl reload nginx 2>/dev/null && ! sudo service nginx reload 2>/dev/null; then
    echo 'VITO_SSH_ERROR' && exit 1
fi
