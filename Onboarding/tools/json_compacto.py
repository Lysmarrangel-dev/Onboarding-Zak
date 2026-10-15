"""Guarda los JSON de configuración en formato legible: un campo por línea."""
import json

def dump_questions(d, path):
    out = ['{']
    out.append('  "meta": ' + json.dumps(d['meta'], ensure_ascii=False, indent=2).replace('\n', '\n  ') + ',')
    out.append('')
    out.append('  "sections": [')
    out.append(',\n'.join('    ' + json.dumps(s, ensure_ascii=False) for s in d['sections']))
    out.append('  ],')
    out.append('')
    out.append('  "questions": [')
    qs = []
    for q in d['questions']:
        head = {k: v for k, v in q.items() if k != 'fields'}
        lines = ['    {']
        items = list(head.items())
        lines.append('      ' + ', '.join(f'{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}' for k, v in items) + ',')
        lines.append('      "fields": [')
        lines.append(',\n'.join('        ' + json.dumps(f, ensure_ascii=False) for f in q['fields']))
        lines.append('      ]')
        lines.append('    }')
        qs.append('\n'.join(lines))
    out.append(',\n'.join(qs))
    out.append('  ],')
    out.append('')
    out.append('  "controlItems": [')
    out.append(',\n'.join('    ' + json.dumps(c, ensure_ascii=False) for c in d['controlItems']))
    out.append('  ]')
    out.append('}')
    text = '\n'.join(out) + '\n'
    json.loads(text)
    open(path, 'w').write(text)
