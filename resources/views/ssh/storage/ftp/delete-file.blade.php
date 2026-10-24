curl {{ $passive }} -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('ftp'.$ssl.'://'.$host.':'.$port.'/'.$src) !!} -Q {!! escapeshellarg('DELE /'.$src) !!}
