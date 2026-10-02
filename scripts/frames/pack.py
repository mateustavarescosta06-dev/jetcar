# Empacota cada quadro do filme com o mapa de profundidade logo abaixo (mesma imagem WebP):
#   desktop: cor 1280x720 + profundidade 640x360 no canto inferior esquerdo -> 1280x1080
#   celular: cor  960x540 + profundidade 480x270 no canto inferior esquerdo ->  960x810
import os, sys, subprocess, numpy as np
D = np.load('depth_all.npy').astype(np.float32)
N = D.shape[0]
out_root = sys.argv[1]
profiles = {'d': (1280, 720, 72), 'm': (960, 540, 70)}
for key, (W, H, q) in profiles.items():
    os.makedirs(f'{out_root}/{key}', exist_ok=True)
    dw, dh = W // 2, H // 2
    for i in range(N):
        g = (D[i] * 255).clip(0, 255).astype(np.uint8)
        src = f'src/f{i+1:03d}.png'
        out = f'{out_root}/{key}/{i:03d}.webp'
        cmd = ['ffmpeg', '-v', 'error', '-y', '-i', src,
               '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', f'{g.shape[1]}x{g.shape[0]}', '-i', '-',
               '-filter_complex', f'[0]scale={W}:{H}:flags=lanczos,format=rgb24[c];[1]scale={dw}:{dh}:flags=bicubic,format=rgb24,pad={W}:{dh}:0:0:black[d];[c][d]vstack',
               '-frames:v', '1', '-c:v', 'libwebp', '-quality', str(q), '-compression_level', '6', out]
        subprocess.run(cmd, input=g.tobytes(), check=True)
    tot = sum(os.path.getsize(f'{out_root}/{key}/{f}') for f in os.listdir(f'{out_root}/{key}'))
    print(key, N, 'frames', round(tot / 1e6, 2), 'MB')
