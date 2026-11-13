if [ -f {!! escapeshellarg($path) !!} ] && [ -r {!! escapeshellarg($path) !!} ]; then
    cat -- {!! escapeshellarg($path) !!}
else
    sudo -n sh -c 'if [ -f "$1" ]; then cat -- "$1"; fi' sh {!! escapeshellarg($path) !!}
fi
