sudo cp /etc/hosts /etc/hosts.vito-postgres.bak
sudo sed -i '/^# BEGIN VITO POSTGRES$/,/^# END VITO POSTGRES$/d' /etc/hosts
@if ($hosts !== [])
{
    echo '# BEGIN VITO POSTGRES'
@foreach ($hosts as $alias => $address)
    printf '%s %s\n' {!! escapeshellarg($address) !!} {!! escapeshellarg($alias) !!}
@endforeach
    echo '# END VITO POSTGRES'
} | sudo tee -a /etc/hosts > /dev/null
@endif

printf 'net.ipv4.ip_nonlocal_bind = 1\nnet.ipv6.ip_nonlocal_bind = 1\n' | sudo tee /etc/sysctl.d/60-vito-postgres.conf > /dev/null
sudo sysctl -q -p /etc/sysctl.d/60-vito-postgres.conf
