import urllib.request
try:
    req = urllib.request.Request('http://127.0.0.1:3001/dashboard')
    with urllib.request.urlopen(req, timeout=10) as res:
        print('status', res.status)
        for k, v in res.getheaders():
            print(f'{k}: {v}')
        print(res.read(400).decode('utf-8', errors='replace'))
except Exception as e:
    print('error', e)
