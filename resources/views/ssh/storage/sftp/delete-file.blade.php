curl -k -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('sftp://'.$host.':'.$port.'/') !!} -Q {!! escapeshellarg('rm '.$src) !!}
