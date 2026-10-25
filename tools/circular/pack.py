#!/usr/bin/env python3
"""Pack a built circular (PDF + PNG) into encrypted hub files and print the "circ" object.

Usage: python3 tools/circular/pack.py OUTDIR BASE STATUS
  OUTDIR  folder written by build.py; BASE  file base name printed by build.py; STATUS draft|final
Writes data/circulars/<BASE>.pdf.json and .png.json (encrypted with key.json via tools/encrypt.mjs,
plaintext stays in a temp folder outside the repo) and prints the JSON to put on the ev2 item and the
matching pri item as "circ".
"""
import base64, json, os, subprocess, sys, tempfile

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
outdir, base, status = sys.argv[1], sys.argv[2], sys.argv[3]
dest = os.path.join(root, 'data', 'circulars'); os.makedirs(dest, exist_ok=True)
circ = {'st': status, 'name': base}
with tempfile.TemporaryDirectory() as td:
    for ext, mime in (('pdf', 'application/pdf'), ('png', 'image/png')):
        src = os.path.join(outdir, f'{base}.{ext}')
        plain = os.path.join(td, f'{base}.{ext}.json')
        json.dump({'name': f'{base}.{ext}', 'type': mime, 'b64': base64.b64encode(open(src, 'rb').read()).decode()}, open(plain, 'w'))
        rel = f'data/circulars/{base}.{ext}.json'
        if os.path.exists(os.path.join(root, 'key.json')):
            subprocess.run(['node', os.path.join(root, 'tools', 'encrypt.mjs'), plain, os.path.join(root, rel)], check=True, capture_output=True)
        else:
            sys.exit('key.json missing: refusing to publish an unencrypted circular')
        circ[ext] = rel
print(json.dumps(circ, ensure_ascii=False))
