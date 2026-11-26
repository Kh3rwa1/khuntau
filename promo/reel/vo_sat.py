# The Santali reel's voice through Bodhan (https://console.bodhan.ai/api-docs/). The key comes from the environment only.
#   BODHAN_API_KEY=sk-... python3 promo/reel/vo_sat.py draft     Bodhan's indic-translate drafts every line in Ol Chiki from the
#                                                               English script -> promo/reel/vo_sat.json + brag-output/reel/sat/draft.md
#                                                               (a DRAFT: Dulor corrects it in vo_sat.json before anything is voiced)
#   BODHAN_API_KEY=sk-... python3 promo/reel/vo_sat.py speak [voice] [style]   voices the lines as they stand in vo_sat.json
#                                                               (Sibu male, Phulmani female) -> brag-output/reel/vo/<voice>/<id>.wav
#   BODHAN_API_KEY=sk-... python3 promo/reel/vo_sat.py check [voice]          Bodhan's Santali speech-to-text reads each line back
# Then: VOICE=sibu VO=promo/reel/vo_sat.json node promo/reel/compose.mjs  -> brag-output/reel/sohrai-reel-sat.mp4
import json, os, re, sys, subprocess, urllib.request

KEY, BASE = os.environ['BODHAN_API_KEY'], 'https://api.bodhan.ai/v1'
EN, SAT = 'promo/reel/vo_en.json', 'promo/reel/vo_sat.json'

def post(path, body, raw=False):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r: return r.read() if raw else json.load(r)

def plain(s): return re.sub(r'\[[^\]]*\]\s*', '', s).strip()  # the English script without its acting directions

def draft():
    en, hi = json.load(open(EN)), {l['id']: l for l in json.load(open('promo/reel/vo.json'))['lines']}
    out = {'_': 'Santali (Ol Chiki) script of the story reel. DRAFTED BY BODHAN indic-translate from the English: Dulor corrects every line before it is voiced. "sat" = what is said, "cap" = the caption (" | " = new line), "en"/"hi" = the meaning.',
           'name': 'sat', 'endLine': 'ᱱᱤᱛᱚᱜ Google Play ᱨᱮ', 'lines': []}
    md = ['# Santali reel: Bodhan draft, for Dulor to correct', '', 'Correct the Ol Chiki in `promo/reel/vo_sat.json` ("sat" is spoken, "cap" is on screen), or send the corrected lines in chat.', '',
          '| line | seconds | English | Hindi (Hinglish reel) | Bodhan draft (Ol Chiki) |', '|---|---|---|---|---|']
    secs = {'l1': 3.4, 'l2': 2.6, 'l3': 3.0, 'l4': 5.8, 'l5a': 1.4, 'l5b': 1.4, 'l5c': 1.4, 'l5d': 1.4, 'l6a': 1.4, 'l6b': 2.3, 'l6d': 1.5, 'l7': 2.8, 'l8': 2.6, 'l9': 2.5, 'l10': 1.6}
    for l in en['lines']:
        src = plain(l.get('el') or l['cap'].replace(' | ', ' '))
        r = post('/chat/completions', {'model': 'indic-translate', 'messages': [{'role': 'user', 'content': src}], 'source_language_code': 'en', 'target_language_code': 'sat', 'target_script': 'native'})
        t = r['choices'][0]['message']['content'].strip()
        ln = {'id': l['id'], 'at': l['at'], 'sat': t, 'cap': t, 'en': src, 'hi': hi.get(l['id'], {}).get('hi', '')}
        for k in ('capOnly', 'tempo'):
            if k in l: ln[k] = l[k]
        out['lines'].append(ln); md.append(f"| {l['id']} | {secs.get(l['id'], '')} | {src} | {ln['hi']} | {t} |"); print(l['id'], t)
    json.dump(out, open(SAT, 'w'), ensure_ascii=False, indent=1)
    os.makedirs('brag-output/reel/sat', exist_ok=True); open('brag-output/reel/sat/draft.md', 'w').write('\n'.join(md) + '\n')

def speak(voice='Sibu', style='advertisements'):
    out = f'brag-output/reel/vo/{voice.lower()}'; os.makedirs(out, exist_ok=True)
    for l in json.load(open(SAT))['lines']:
        if l.get('capOnly') or l.get('skip'): continue
        wav = post('/audio/speech', {'model': 'indic-speak', 'input': l['sat'], 'voice': voice, 'instructions': json.dumps({'lang': 'sat', 'style': style})}, raw=True)
        open(f"{out}/{l['id']}.raw.wav", 'wb').write(wav)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f"{out}/{l['id']}.raw.wav", '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', f"{out}/{l['id']}.wav"], check=True)
        d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"{out}/{l['id']}.wav"], capture_output=True, text=True).stdout.strip()
        print(l['id'], d)

def check(voice='Sibu'):  # Santali speech-to-text (OpenAI-style multipart upload)
    import uuid
    for l in json.load(open(SAT))['lines']:
        f = f"brag-output/reel/vo/{voice.lower()}/{l['id']}.wav"
        if not os.path.exists(f): continue
        b = uuid.uuid4().hex; body = (f'--{b}\r\nContent-Disposition: form-data; name="model"\r\n\r\nindic-transcribe\r\n--{b}\r\nContent-Disposition: form-data; name="language"\r\n\r\nsat\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n').encode() + open(f, 'rb').read() + f'\r\n--{b}--\r\n'.encode()
        req = urllib.request.Request(BASE + '/audio/transcriptions', data=body, headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'multipart/form-data; boundary=' + b})
        with urllib.request.urlopen(req, timeout=120) as r: print(l['id'], '\n  said:', l['sat'], '\n  heard:', json.load(r).get('text'))

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'draft'
    {'draft': draft, 'speak': lambda: speak(*sys.argv[2:4]), 'check': lambda: check(*sys.argv[2:3])}[cmd]()
