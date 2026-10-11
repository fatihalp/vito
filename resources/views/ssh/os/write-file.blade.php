if [ "$(wc -c < {!! escapeshellarg($tmpPath) !!})" -eq {{ (int) $size }} ] && cat {!! escapeshellarg($tmpPath) !!} > {!! escapeshellarg($path) !!}; then
    rm -f {!! escapeshellarg($tmpPath) !!}
    echo 'File written successfully.'
else
    rm -f {!! escapeshellarg($tmpPath) !!}
    exit 1
fi
