curl -k -u {!! escapeshellarg($username.':'.$password) !!} {!! escapeshellarg('sftp://'.$host.':'.$port.'/'.$src) !!} -o {!! escapeshellarg($dest) !!}
