#!/usr/bin/env python3
"""Genera con ElevenLabs las voces del onboarding.

  python3 tools/generar_voz.py            Presentación de bienvenida (config/intro.json → assets/audio/intro/)
  python3 tools/generar_voz.py --kira     Kira leyendo cada pregunta e introducción de sección
                                          (→ assets/audio/kira/<sha1 del texto>.mp3 + manifest.json)
Opciones: --force (regenera todo) · --only <escena> (solo presentación)

La clave se lee de ELEVENLABS_API_KEY; nunca se guarda en el proyecto ni llega al navegador.
Con --kira, solo se generan los textos nuevos o cambiados (el nombre del archivo es la huella del texto),
así que puedes ejecutarlo cada vez que edites preguntas.
"""
import hashlib
import json
import os
import pathlib
import sys
import unicodedata
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'config/intro.json').read_text(encoding='utf-8'))
el = cfg['elevenlabs']
key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
force = '--force' in sys.argv
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None
url = f"https://api.elevenlabs.io/v1/text-to-speech/{el['voiceId']}?output_format={el['outputFormat']}"


def tts(text, target, prev=None, nxt=None):
    body = {'text': text, 'model_id': el['modelId'], 'voice_settings': el['voiceSettings']}
    if prev: body['previous_text'] = prev
    if nxt: body['next_text'] = nxt
    req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'})
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            target.write_bytes(res.read())
        return True
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:400]
        print(f"✗ {target.name}: HTTP {e.code} · {detail}")
        if e.code in (401, 403):
            sys.exit('La clave no es válida o no tiene permiso de text-to-speech.')
        if e.code in (400, 404) and 'voice' in detail.lower():
            sys.exit('ElevenLabs no encuentra la voz. Si es de la Voice Library, añádela primero a «My Voices».')
        return False
    except urllib.error.URLError as e:
        sys.exit(f'Sin conexión con ElevenLabs: {e.reason}')


def kira_texts():
    """Mismos textos que lee Kira en la app (js/app.js → speakQuestion): intro de sección + pregunta."""
    load = lambda n: json.loads((ROOT / f'config/{n}.json').read_text(encoding='utf-8'))
    q, mods, agents = load('questions'), load('modules'), load('agents')
    texts = []
    texts += [s.get('intro') for s in q['sections']]
    texts += [x.get('prompt') for x in q['questions']]
    texts += [mods['sections']['modules']['intro'], mods['sections']['checklist']['intro'], mods['selection']['prompt']]
    all_mods = [m for g in mods['groups'] for m in g['modules']]
    texts += [mods['checklist']['promptTemplate'].replace('{module}', m['name']) for m in all_mods if m.get('requirements')]
    texts += [agents['section']['intro'], agents['selection']['prompt']]
    texts += [agents['agent']['promptTemplate'].replace('{dept}', 'otro departamento' if d.get('askName') else d['name']) for d in agents['departments']]
    for m in all_mods:
        if m.get('config'):
            texts.append(mods['configSection']['intro'].replace('{module}', m['name']))
            texts += [c['prompt'] for c in m['config']]
    return list(dict.fromkeys(t for t in texts if t))


if not key:
    sys.exit('Falta ELEVENLABS_API_KEY. Ejecuta: export ELEVENLABS_API_KEY="tu_clave"  y vuelve a intentarlo.')

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
scenes, ok = cfg['scenes'], 0
for i, scene in enumerate(scenes):
    if only and scene['id'] != only:
        continue
    target = out_dir / f"{scene['id']}.mp3"
    if target.exists() and not force:
        print(f"= {target.name} ya existe (usa --force para regenerar)"); continue
    say = lambda s: s.get('say') or s['caption']
    if tts(say(scene), target, say(scenes[i - 1]) if i else None, say(scenes[i + 1]) if i < len(scenes) - 1 else None):
        ok += 1; print(f"✓ {target.relative_to(ROOT)}")
print(f"\nListo: {ok} audio(s) de la presentación en {out_dir.relative_to(ROOT)}.")
