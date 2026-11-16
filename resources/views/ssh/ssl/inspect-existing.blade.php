sudo -n python3 - <<'VITO_CERTIFICATE_INVENTORY'
import base64,json,re,shlex,subprocess,time
prefix=[]
started=time.monotonic()
try:
    config=subprocess.run(['nginx','-T'],capture_output=True,timeout=5)
except FileNotFoundError:
    config=None
if config is None or config.returncode:
    containers=subprocess.run(['docker','ps','--filter','label=com.docker.compose.service=nginx-mailcow','--format=json'],capture_output=True,timeout=3)
    rows=[json.loads(line) for line in containers.stdout.splitlines() if line][:2]
    if containers.returncode or len(rows)!=1 or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}',rows[0].get('Names','')):
        raise SystemExit('Certificate inventory unavailable')
    prefix=['docker','exec',rows[0]['Names']]
    config=subprocess.run(prefix+['nginx','-T'],capture_output=True,timeout=5)
if config.returncode or len(config.stdout)>2097152:
    raise SystemExit('Certificate inventory unavailable')
lexer=shlex.shlex(config.stdout.decode(),posix=True,punctuation_chars=';{}')
lexer.whitespace_split=True
lexer.commenters='#'
tokens=[]
for token in lexer:
    tokens.extend(list(token) if token and set(token)<=set(';{}') else [token])
paths=set()
malformed=0
for index,token in enumerate(tokens):
    if token!='ssl_certificate' or (index and tokens[index-1] not in [';','{','}']):
        continue
    if index+2>=len(tokens) or tokens[index+2]!=';':
        malformed+=1
    else:
        paths.add(tokens[index+1].encode())
paths=sorted(paths)
certificates=[]
unreadable=malformed
for path in paths[:50]:
    if time.monotonic()-started>15:
        break
    if not path.startswith(b'/') or b'$' in path or len(path)>4096:
        unreadable+=1
        continue
    try:
        if prefix:
            content=subprocess.run(prefix+['cat',path.decode()],capture_output=True,timeout=3)
            if content.returncode or len(content.stdout)>65536:
                unreadable+=1
                continue
            result=subprocess.run(['openssl','x509','-outform','PEM'],input=content.stdout,capture_output=True,timeout=1)
        else:
            result=subprocess.run(['openssl','x509','-in',path.decode(),'-outform','PEM'],capture_output=True,timeout=1)
        pem=result.stdout
        if result.returncode or not pem.startswith(b'-----BEGIN CERTIFICATE-----') or len(pem)>16384:
            unreadable+=1
            continue
        certificates.append(base64.b64encode(pem).decode())
    except (subprocess.TimeoutExpired,UnicodeDecodeError):
        unreadable+=1
print(json.dumps({'certificates':certificates,'discovered':len(paths)+malformed,'unreadable':unreadable,'complete':len(certificates)+unreadable==len(paths)+malformed}))
VITO_CERTIFICATE_INVENTORY
