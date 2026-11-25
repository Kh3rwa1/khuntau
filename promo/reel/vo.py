# Speaks promo/reel/vo.json with Kokoro (open source, runs here): one wav per line in brag-output/reel/vo/<voice>/.
#   python3 promo/reel/vo.py <voice> [speed]     voices with Hindi: hm_omega hm_psi hf_alpha hf_beta
# Needs: pip install kokoro-onnx soundfile; kokoro-v1.0.onnx + voices-v1.0.bin in $KOKORO (default /root/kokoro).
import json, os, sys, soundfile as sf
from kokoro_onnx import Kokoro
K = os.environ.get('KOKORO', '/root/kokoro')
voice, speed = sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 1.05
k = Kokoro(f'{K}/kokoro-v1.0.onnx', f'{K}/voices-v1.0.bin')
out = f'brag-output/reel/vo/{voice}'; os.makedirs(out, exist_ok=True)
for ln in json.load(open('promo/reel/vo.json'))['lines']:
    a, sr = k.create(ln['hi'], voice=voice, speed=speed, lang='hi')
    sf.write(f"{out}/{ln['id']}.wav", a, sr); print(ln['id'], round(len(a) / sr, 2))
