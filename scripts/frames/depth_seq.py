# Profundidade por quadro (Depth Anything V2 Small, ONNX) para a sequência do filme.
# Saída: depth/dNNN.png (cinza 16 bits normalizado por quadro, mais perto = mais claro) em 480x270.
import os, sys, glob, time, subprocess, numpy as np, onnxruntime as ort
so = ort.SessionOptions(); so.intra_op_num_threads = 4
sess = ort.InferenceSession(os.path.join(os.path.dirname(__file__), '..', 'depth', 'model.onnx'), so, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name
mean = np.array([0.485,0.456,0.406],dtype=np.float32); std=np.array([0.229,0.224,0.225],dtype=np.float32)
H, W = 518, 924  # 16:9 múltiplo de 14
os.makedirs('depth_raw', exist_ok=True)
files = sorted(glob.glob('src/f*.png'))
t0 = time.time()
for i, src in enumerate(files):
    out_path = 'depth_raw/' + os.path.basename(src).replace('.png', '.npy')
    if os.path.exists(out_path): continue
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',src,'-vf',f'scale={W}:{H}:flags=bicubic','-f','rawvideo','-pix_fmt','rgb24','-'])
    img = np.frombuffer(raw,dtype=np.uint8).reshape(H,W,3).astype(np.float32)/255.0
    x = ((img-mean)/std).transpose(2,0,1)[None].astype(np.float32)
    d = sess.run(None, {inp: x})[0].reshape(H, W).astype(np.float32)
    np.save(out_path, d)
    if i % 20 == 0: print(i, round(time.time()-t0,1), 's', flush=True)
print('done', round(time.time()-t0,1))
