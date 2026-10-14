#!/usr/bin/env python3
"""Genera la narración de la presentación con ElevenLabs.

Lee config/intro.json (voz, modelo y frases) y crea assets/audio/intro/<escena>.mp3.
La clave de API se lee de la variable de entorno ELEVENLABS_API_KEY: nunca se guarda en el
proyecto ni llega al navegador. Los MP3 resultantes son archivos estáticos que se publican con la app.

Uso:
    export ELEVENLABS_API_KEY="tu_clave"      # en tu terminal, no en el código
    python3 tools/generar_voz.py              # genera los audios que falten
    python3 tools/generar_voz.py --force      # regenera todos (tras cambiar textos o la voz)
    python3 tools/generar_voz.py --only zak   # solo una escena
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / 'config/intro.json').read_text(encoding='utf-8'))
el = cfg['elevenlabs']
out_dir = ROOT / cfg['audioDir']
out_dir.mkdir(parents=True, exist_ok=True)

key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
if not key:
    sys.exit('Falta ELEVENLABS_API_KEY. Defínela en tu terminal antes de ejecutar el script.')

force = '--force' in sys.argv
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else None

url = f"https://api.elevenlabs.io/v1/text-to-speech/{el['voiceId']}?output_format={el['outputFormat']}"
ok = 0
for i, scene in enumerate(cfg['scenes']):
    if only and scene['id'] != only:
        continue
    target = out_dir / f"{scene['id']}.mp3"
    if target.exists() and not force:
        print(f"= {target.name} ya existe (usa --force para regenerar)")
        continue
    body = {
        'text': scene.get('say') or scene['caption'],
        'model_id': el['modelId'],
        'voice_settings': el['voiceSettings'],
    }
    if el.get('languageCode') and el['modelId'].startswith(('eleven_turbo_v2_5', 'eleven_flash_v2_5')):
        body['language_code'] = el['languageCode']  # solo lo aceptan los modelos v2.5
    # Encadenar con la frase anterior y la siguiente mejora la entonación entre escenas.
    if i > 0:
        body['previous_text'] = cfg['scenes'][i - 1].get('say') or cfg['scenes'][i - 1]['caption']
    if i < len(cfg['scenes']) - 1:
        body['next_text'] = cfg['scenes'][i + 1].get('say') or cfg['scenes'][i + 1]['caption']
    req = urllib.request.Request(
        url, data=json.dumps(body).encode('utf-8'), method='POST',
        headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            target.write_bytes(res.read())
        ok += 1
        print(f"✓ {target.relative_to(ROOT)}  ({target.stat().st_size // 1024} KB)")
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'replace')[:400]
        print(f"✗ {scene['id']}: HTTP {e.code} · {detail}")
        if e.code in (401, 403) or 'authentication_error' in detail:
            sys.exit('La clave de ElevenLabs no es válida o no tiene permiso de text-to-speech.')
        if e.code in (400, 404) and 'voice' in detail.lower():
            sys.exit(f"La voz {el['voiceId']} no existe o no está en tu biblioteca de ElevenLabs.")
    except urllib.error.URLError as e:
        sys.exit(f'Sin conexión con ElevenLabs: {e.reason}')

print(f"\nListo: {ok} audio(s) generado(s) en {out_dir.relative_to(ROOT)}. Vuelve a publicar la carpeta en Netlify.")
