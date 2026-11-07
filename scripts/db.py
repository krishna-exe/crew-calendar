"""Runs SQL on the Supabase project named in .env.local, using the Management API."""
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKEN_FILE = pathlib.Path.home() / '.config/supabase/access-token'


def project_ref():
    env = (ROOT / '.env.local').read_text()
    return re.search(r'VITE_SUPABASE_URL=https://(\w+)\.supabase\.co', env).group(1)


def management_api(method, path, body=None):
    request = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{project_ref()}{path}',
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            'Authorization': f'Bearer {TOKEN_FILE.read_text().strip()}',
            'Content-Type': 'application/json',
            'User-Agent': 'crew-calendar-scripts',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            text = response.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        raise SystemExit(f'{method} {path} failed: {error.code} {error.read().decode()[:800]}')


def sql(query):
    return management_api('POST', '/database/query', {'query': query})
