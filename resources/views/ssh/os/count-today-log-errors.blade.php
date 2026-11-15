if ! sudo test -f {!! escapeshellarg($path) !!}; then echo 0; exit 0; fi
sudo tail -n 100000 {!! escapeshellarg($path) !!} 2>/dev/null | grep -cE "^\[$(date +%Y-%m-%d)[ T][^]]*\] [^ ]+\.(ERROR|CRITICAL|ALERT|EMERGENCY):" || true
