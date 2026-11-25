# Speaks promo/reel/vo.json's 'el' lines with ElevenLabs (eleven_v3, acting directions in [brackets]): one mp3 per line in
# brag-output/reel/vo/<name>/. The key comes from the environment only: ELEVENLABS_API_KEY=... python3 promo/reel/vo_el.py <voice_id> <name> [stability]
# A free account can use only ElevenLabs' stock voices (library voices like Raju or Viraj need a paid plan).
import json, os, sys, urllib.request, subprocess
key, vid, name = os.environ['ELEVENLABS_API_KEY'], sys.argv[1], sys.argv[2]; stab = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
out = f'brag-output/reel/vo/{name}'; os.makedirs(out, exist_ok=True)
for ln in json.load(open(os.environ.get('VO', 'promo/reel/vo.json')))['lines']:
    if ln.get('skip') or 'el' not in ln or (os.environ.get('ONLY') and ln['id'] not in os.environ['ONLY'].split(',')): continue
    body = {'text': ln['el'], 'model_id': 'eleven_v3', **({'language_code': os.environ.get('LANG_CODE', 'hi')}), 'voice_settings': {'stability': stab}}
    req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128', data=json.dumps(body).encode(), headers={'xi-api-key': key, 'content-type': 'application/json'})
    open(f"{out}/{ln['id']}.mp3", 'wb').write(urllib.request.urlopen(req, timeout=120).read())
    # trim the silence ElevenLabs leaves at both ends, so a line starts on its cue
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f"{out}/{ln['id']}.mp3", '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', f"{out}/{ln['id']}.wav"], check=True)
    print(ln['id'], float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f"{out}/{ln['id']}.wav"], capture_output=True, text=True).stdout))
