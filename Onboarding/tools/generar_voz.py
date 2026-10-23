#!/usr/bin/env python3
"""Genera las voces del onboarding con la voz de Kira (la misma del CRM ZAK y del brochure).

  python3 tools/generar_voz.py            Presentación de bienvenida (config/intro.json → assets/audio/intro/)
  python3 tools/generar_voz.py --kira     Kira leyendo cada pregunta e introducción de sección
                                          (→ assets/audio/kira/<sha1 del texto>.mp3 + manifest.json)
Opciones: --force (regenera todo) · --only <escena> (solo presentación)

Requisito: pip install lameenc   (codifica el audio a MP3; no hace falta ffmpeg)

El audio lo genera el backend del CRM (POST /api/kira/tts, voz Gemini «Aoede»): aquí no hay
ninguna clave de API. La URL está en config/intro.json → kiraVoice.ttsUrl; se puede cambiar con
la variable KIRA_TTS_URL (p. ej. http://localhost:3000/api/kira/tts con el backend en local).
Con --kira, solo se generan los textos nuevos o cambiados (el nombre del archivo es la huella del texto),
así que puedes ejecutarlo cada vez que edites preguntas.
"""
import base64
import hashlib
import json
import os
import pathlib
import sys
import time
import unicodedata
import urllib.error
import urllib.request

try:
    import lameenc
except ImportError:
    sys.exit('Falta el codificador MP3. Ejecuta: pip install lameenc  y vuelve a intentarlo.')

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'config/intro.json').read_text(encoding='utf-8'))
kv = cfg['kiraVoice']
url = os.environ.get('KIRA_TTS_URL', '').strip() or kv['ttsUrl']
force = '--force' in sys.argv
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None


def to_mp3(pcm, rate):
    enc = lameenc.Encoder()
    enc.set_bit_rate(kv.get('mp3Kbps', 64))
    enc.set_in_sample_rate(rate)
    enc.set_channels(1)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


def tts(text, target):
    req = urllib.request.Request(url, data=json.dumps({'text': text}).encode('utf-8'), method='POST',
                                 headers={'Content-Type': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                body = json.loads(res.read().decode('utf-8'))
            if body.get('voice') and body['voice'] != kv['voice']:
                print(f"! El backend usa la voz «{body['voice']}» y config/intro.json dice «{kv['voice']}».")
            target.write_bytes(to_mp3(base64.b64decode(body['audioBase64']), int(body.get('sampleRate', 24000))))
            return True
        except urllib.error.HTTPError as e:
            detail = e.read().decode('utf-8', 'replace')[:300]
            print(f"✗ {target.name}: HTTP {e.code} · {detail}")
            if e.code == 404:
                sys.exit(f'El backend no tiene /api/kira/tts ({url}). Despliega la versión actual del CRM.')
            if e.code == 400:
                return False
        except urllib.error.URLError as e:
            print(f"✗ {target.name}: sin conexión con {url} ({e.reason})")
        time.sleep(2 * (attempt + 1))  # límite de uso de Gemini TTS: espera y reintenta
    return False


def kira_texts():
    """Mismos textos que lee Kira en la app (js/app.js → speakQuestion): intro de sección + pregunta."""
    load = lambda n: json.loads((ROOT / f'config/{n}.json').read_text(encoding='utf-8'))
    q, mods = load('questions'), load('modules')
    texts = []
    texts += [s.get('intro') for s in q['sections']]
    texts += [x.get('prompt') for x in q['questions']]
    texts += [mods['sections']['modules']['intro'], mods['selection']['prompt']]
    all_mods = [m for g in mods['groups'] for m in g['modules']]
    for m in all_mods:
        if m.get('config'):
            texts.append(mods['configSection']['intro'].replace('{module}', m['name']))
            texts += [c['prompt'] for c in m['config']]
    return list(dict.fromkeys(t for t in texts if t))


print(f"Voz de Kira («{kv['voice']}») desde {url}\n")

if '--kira' in sys.argv:
    out = ROOT / 'assets/audio/kira'
    out.mkdir(parents=True, exist_ok=True)
    texts = kira_texts()
    keys, made = [], 0
    for t in texts:
        h = hashlib.sha1(unicodedata.normalize('NFC', t).encode('utf-8')).hexdigest()
        target = out / f'{h}.mp3'
        if target.exists() and not force:
            keys.append(h); continue
        if tts(t, target):
            keys.append(h); made += 1
            print(f"✓ {made:>3} · {t[:70]}")
    (out / 'manifest.json').write_text(json.dumps(sorted(set(keys))), encoding='utf-8')
    print(f"\nListo: {made} audio(s) nuevos · {len(keys)} de {len(texts)} textos con voz. Vuelve a publicar la carpeta.")
    sys.exit(0)

out_dir = ROOT / cfg['audioDir']
out_dir.mkdir(parents=True, exist_ok=True)
ok = 0
for scene in cfg['scenes']:
    if only and scene['id'] != only:
        continue
    target = out_dir / f"{scene['id']}.mp3"
    if target.exists() and not force:
        print(f"= {target.name} ya existe (usa --force para regenerar)"); continue
    if tts(scene.get('say') or scene['caption'], target):
        ok += 1; print(f"✓ {target.relative_to(ROOT)}")
print(f"\nListo: {ok} audio(s) de la presentación en {out_dir.relative_to(ROOT)}.")
