sudo rm -rf {!! escapeshellarg($path) !!}

sudo rm -f {!! escapeshellarg('/etc/nginx/sites-available/'.$domain) !!}

sudo rm -f {!! escapeshellarg('/etc/nginx/sites-enabled/'.$domain) !!}

echo "Site deleted"
