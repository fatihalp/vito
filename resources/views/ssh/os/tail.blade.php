if ! sudo test -f {!! escapeshellarg($path) !!}; then echo VITO_NO_FILE; exit 0; fi
sudo tail -n {{ (int) $lines }} {!! escapeshellarg($path) !!}
