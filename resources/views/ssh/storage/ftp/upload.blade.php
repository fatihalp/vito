curl {{ $passive }} -T {!! escapeshellarg($src) !!} -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('ftp'.$ssl.'://'.$host.':'.$port.'/'.$dest) !!}
