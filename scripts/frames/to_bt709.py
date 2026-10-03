"""Corrige quadros do vídeo extraídos com a matriz errada.

O master não tem marcação de cor; o ffmpeg converte YUV -> RGB com a BT.601 por padrão, mas o
navegador mostra vídeo HD sem marcação com a BT.709. A diferença é pequena no cinza e chega a 14
níveis nas cores saturadas (pinças amarelas, brasão), e aparece no corte do vídeo para a foto.
Este passo leva um PNG decodificado em BT.601 para a decodificação BT.709 (a mesma matriz 3×3
que refaz o YUV com a 601 e decodifica com a 709; erro máximo de ~3 níveis por arredondamento).
O jeito certo para quadros novos é extrair já com: -vf "scale=in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24"

Uso: python3 to_bt709.py <entrada.png> <saida.png> [<entrada> <saida> ...]
"""
import sys
import numpy as np
from PIL import Image

T = np.array([[1.0864, -0.07235, -0.01405],
              [0.096546, 0.845052, 0.058402],
              [-0.014107, -0.027693, 1.0418]], np.float32)
args = sys.argv[1:]
for src, dst in zip(args[0::2], args[1::2]):
    x = np.asarray(Image.open(src).convert('RGB')).astype(np.float32) / 255.0
    y = np.clip(x @ T.T, 0, 1)
    Image.fromarray((y * 255 + 0.5).astype(np.uint8)).save(dst)
    print('ok', dst)
