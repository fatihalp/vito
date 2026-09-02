sudo rm -rf {!! escapeshellarg($path) !!}

sudo rm -f {!! escapeshellarg('/etc/caddy/sites-available/'.$domain) !!}

sudo rm -f {!! escapeshellarg('/etc/caddy/sites-enabled/'.$domain) !!}

echo "Site deleted"
