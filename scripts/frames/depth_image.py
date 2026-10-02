import sys, subprocess, numpy as np, onnxruntime as ort
sess = ort.InferenceSession('model.onnx', providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0]; print('input', inp.name, inp.shape)
mean = np.array([0.485,0.456,0.406],dtype=np.float32); std=np.array([0.229,0.224,0.225],dtype=np.float32)
for src in sys.argv[1:]:
    name = src.split('/')[-1].split('.')[0]
    # dimensões originais
    w0,h0 = map(int, subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height','-of','csv=p=0',src]).decode().strip().split(','))
    H = 518; W = int(round(w0*H/h0/14))*14
    raw = subprocess.check_output(['ffmpeg','-v','error','-i',src,'-vf',f'scale={W}:{H}:flags=bicubic','-f','rawvideo','-pix_fmt','rgb24','-'])
    img = np.frombuffer(raw,dtype=np.uint8).reshape(H,W,3).astype(np.float32)/255.0
    x = ((img-mean)/std).transpose(2,0,1)[None].astype(np.float32)
    out = sess.run(None, {inp.name: x})[0]
    d = out.reshape(out.shape[-2], out.shape[-1])
    d = (d - d.min())/(d.max()-d.min()+1e-6)
    g = (d*255).clip(0,255).astype(np.uint8)
    # salva no tamanho do modelo e reescala para metade da original (suficiente para deslocamento)
    subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','gray','-s',f'{g.shape[1]}x{g.shape[0]}','-i','-','-vf',f'scale={w0//2}:{h0//2}:flags=bicubic,gblur=sigma=1.2','-frames:v','1',f'{name}-depth.png'], input=g.tobytes(), check=True)
    print(name, W, H, '->', f'{name}-depth.png')
