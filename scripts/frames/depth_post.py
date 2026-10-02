import glob, numpy as np, subprocess, os
files = sorted(glob.glob('depth_raw/*.npy'))
D = np.stack([np.load(f) for f in files]).astype(np.float32)  # (N,H,W) disparidade relativa
N = len(files)
lo = np.percentile(D.reshape(N,-1), 1, axis=1); hi = np.percentile(D.reshape(N,-1), 99.5, axis=1)
def smooth(a, k=9):
    pad = np.pad(a, (k//2, k//2), mode='edge'); return np.convolve(pad, np.ones(k)/k, mode='valid')
lo_s, hi_s = smooth(lo), smooth(hi)
Dn = np.clip((D - lo_s[:,None,None]) / (hi_s - lo_s)[:,None,None], 0, 1)
# suavização temporal leve
Dt = Dn.copy()
Dt[1:-1] = 0.25*Dn[:-2] + 0.5*Dn[1:-1] + 0.25*Dn[2:]
np.save('depth_all.npy', Dt.astype(np.float16))
print(N, Dt.shape, float(Dt.min()), float(Dt.max()))
# folha de contato de alguns quadros
os.makedirs('dprev', exist_ok=True)
for i in [0, 30, 60, 75, 100, 130, 165, 200, 225]:
    g = (Dt[i]*255).astype(np.uint8)
    subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{g.shape[1]}x{g.shape[0]}','-i','-','-frames:v','1',f'dprev/d{i:03d}.png'], input=g.tobytes(), check=True)
