import subprocess
R = '../real/'; A = '../../public/audio/'; M = './music/sohrai.mp3'
DUR = 36.0
# music pieces: (track_start, track_end, out_at, vol, fade_in, fade_out)
music = [(0.0, 2.3, 0.0, 0.9, 0.0, 0.08), (2.3, 16.1, 5.6, 0.42, 0.3, 0.3), (119.1, 126.5, 22.0, 1.0, 0.0, 0.25), (158.9, 165.5, 29.4, 0.95, 0.05, 1.0)]
sfx = [  # (file, at, vol)
  (R+'sfx/boom.mp3', 0.12, 0.9),
  (R+'sfx/scratch.mp3', 2.28, 1.0), (R+'sfx/slowmo.mp3', 2.35, 0.8), (A+'whoosh.mp3', 3.4, 0.7),
  (R+'sfx/stamp.mp3', 4.02, 1.0), (A+'punch.mp3', 4.0, 0.8), (R+'sfx/buzz.mp3', 4.25, 0.45),
  (R+'sfx/boing.mp3', 6.0, 0.9), (R+'sfx/rewind.mp3', 6.4, 0.9),
  (A+'clap.mp3', 7.6, 0.5), (A+'clap.mp3', 8.2, 0.5), (R+'sfx/laugh.mp3', 8.9, 0.75), (A+'bonk.mp3', 8.9, 0.8),
  (R+'sfx/glitch.mp3', 10.0, 0.6), (R+'sfx/buzz.mp3', 11.05, 0.8),
  (A+'whoosh.mp3', 11.4, 0.8), (A+'snort.mp3', 11.9, 0.8), (A+'bellow.mp3', 12.4, 0.75), (A+'gallop.mp3', 12.9, 0.6),
  (R+'sfx/slowmo.mp3', 13.4, 0.7), (A+'whoosh.mp3', 13.75, 0.9), (R+'sfx/ding.mp3', 13.9, 0.8), (A+'cheer1.mp3', 14.0, 0.6),
  (A+'whoosh.mp3', 15.6, 0.6), (A+'gallop.mp3', 16.6, 0.6), (A+'gallop.mp3', 18.0, 0.5), (R+'sfx/laugh.mp3', 17.4, 0.4),
  (R+'sfx/riser.mp3', 19.4, 0.9), (R+'sfx/stamp.mp3', 19.45, 0.6), (A+'hit.mp3', 20.7, 0.8), (A+'bells.mp3', 21.0, 0.6),
  (R+'sfx/glitch.mp3', 21.85, 0.7), (R+'sfx/boom.mp3', 22.0, 1.0),
  (R+'sfx/ding.mp3', 23.4, 0.7), (A+'highfive.mp3', 23.4, 0.6), (R+'sfx/ding.mp3', 25.9, 0.8), (A+'bells.mp3', 25.9, 0.6),
  (A+'bonk.mp3', 28.2, 1.0), (A+'cheer2.mp3', 28.3, 0.6), (R+'sfx/boom.mp3', 29.4, 0.9),
]
import os
vo = [('c1', 0.2), ('c2', 4.1), ('c3_1', 7.25), ('c4', 10.15), ('c5', 13.6), ('c6', 16.6), ('c7', 20.2), ('c8', 30.0)]

if os.environ.get('EN'):
    vo = [('c1f', 0.05), ('c2', 4.1), ('c3f', 7.25), ('c4', 10.55), ('c5', 13.6), ('c6', 16.6), ('c7a', 19.6), ('c7b', 22.2), ('c8', 30.0)]
VD = 'vo_en/' if os.environ.get('EN') else 'vo/'
OUT = 'mix_en.m4a' if os.environ.get('EN') else 'mix.m4a'
ins, f, mlabels, slabels, vlabels = [], [], [], [], []
def add(path): ins.extend(['-i', path]); return len(ins) // 2 - 1
for k, (a, b, at, v, fi, fo) in enumerate(music):
    i = add(M); d = b - a
    f.append(f'[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={v}'
             + (f',afade=t=in:d={fi}' if fi else '') + f',afade=t=out:st={d - fo:.3f}:d={fo},adelay={int(at * 1000)}:all=1[m{k}]'); mlabels.append(f'[m{k}]')
for k, (p, at, v) in enumerate(sfx):
    i = add(p); f.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={v},adelay={int(at * 1000)}:all=1[s{k}]'); slabels.append(f'[s{k}]')
for k, (c, at) in enumerate(vo):
    i = add(R + VD + f'{c}.wav'); f.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.6,adelay={int(at * 1000)}:all=1[v{k}]'); vlabels.append(f'[v{k}]')
f.append(''.join(vlabels) + f'amix=inputs={len(vlabels)}:normalize=0,apad=whole_dur={DUR},asplit=2[vo][key]')
f.append(''.join(mlabels) + ''.join(slabels) + f'amix=inputs={len(mlabels) + len(slabels)}:normalize=0,apad=whole_dur={DUR}[bed]')
f.append('[bed][key]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=300[duck]')
f.append(f'[duck][vo]amix=inputs=2:normalize=0,atrim=0:{DUR},loudnorm=I=-14:TP=-1.2:LRA=9,aresample=48000[out]')
subprocess.run(['ffmpeg', '-y', '-v', 'error', *ins, '-filter_complex', ';'.join(f), '-map', '[out]', '-c:a', 'aac', '-b:a', '256k', R + OUT], check=True)
print('mix ok')
