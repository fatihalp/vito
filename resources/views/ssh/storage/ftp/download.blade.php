curl {{ $passive }} -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('ftp'.$ssl.'://'.$host.':'.$port.'/'.$src) !!} -o {!! escapeshellarg($dest) !!}
