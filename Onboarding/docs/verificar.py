#!/usr/bin/env python3
"""Compara el cuestionario .docx con config/questions.json.
Uso (macOS):  python3 docs/verificar.py ruta/al/Onboarding.docx
Imprime cada pregunta del documento y si su texto, sección y orden coinciden en el JSON."""
import json, re, subprocess, sys, difflib, pathlib

docx = sys.argv[1] if len(sys.argv) > 1 else 'Onboarding.docx'
txt = subprocess.run(['textutil', '-convert', 'txt', '-stdout', docx], capture_output=True, text=True, check=True).stdout
doc, sec = [], None
for line in txt.splitlines():
    s = line.strip()
    if not s:
        continue
    m = re.match(r'^(\d+)\.\s+(.*)$', s)
    if m and not line.startswith('\t'):
        sec = int(m.group(1)); continue
    if s.startswith('•'):
        doc.append((sec, s.lstrip('•').strip()))

root = pathlib.Path(__file__).resolve().parent.parent
schema = json.loads((root / 'config/questions.json').read_text())
secs = {s['id']: s['number'] for s in schema['sections']}
qs = [q for q in schema['questions'] if secs[q['section']] > 0]
# Textos cambiados a pedido de iTech (revisión del 14-10-2026): se aceptan como coincidencia.
APROBADOS = {'4.5': 'Objetivos de la llamada', '5.5': 'hacer o responder', '8.5': 'post-venta', '12.2': 'KPIs desea visualizar'}
qs = [q for q in qs if q.get('source') != 'itech']  # preguntas nuevas de iTech (p. ej. 9.4) no están en el documento
ok = 0
for (dsec, dtext), q in zip(doc, qs):
    sim = difflib.SequenceMatcher(None, dtext.rstrip('?').lower(), q['formTitle'].rstrip('?').lower()).ratio()
    good = secs[q['section']] == dsec and (sim > 0.9 or APROBADOS.get(q['id'], '\0') in q['formTitle'])
    ok += good
    print(f"{'OK ' if good else 'REV'} {q['id']:>5}  {sim:.2f}  {dtext[:90]}")
print(f"\nDocumento: {len(doc)} · JSON: {len(qs)} · Coinciden: {ok}")
sys.exit(0 if ok == len(doc) == len(qs) else 1)
