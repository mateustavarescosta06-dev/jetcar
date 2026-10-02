"""Ferramenta de desenvolvimento: converte palavras em contornos vetoriais (Geist variável).

Gera dist/js/type-data.js com um path por letra, já com o espaçamento real da fonte
(kerning via HarfBuzz), para recortar o filme dentro das letras no canvas.

Requisitos (apenas para regenerar): pip install fonttools brotli uharfbuzz
Uso: python3 scripts/trace-type.py
"""
import io
import json
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "dist/assets/fonts/geist-latin-var.woff2")
WORDS = {
    "BOA VIAGEM": {"wght": 900},
}


def static_instance(axes):
    font = TTFont(FONT)
    static = instancer.instantiateVariableFont(font, axes)
    buf = io.BytesIO()
    static.flavor = None
    static.save(buf)
    return TTFont(io.BytesIO(buf.getvalue())), buf.getvalue()


def shape(data, text):
    face = hb.Face(data)
    font = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    return buf.glyph_infos, buf.glyph_positions


out = {}
for word, axes in WORDS.items():
    font, data = static_instance(axes)
    upem = font["head"].unitsPerEm
    glyph_set = font.getGlyphSet()
    order = font.getGlyphOrder()
    cap = font["OS/2"].sCapHeight or 700
    infos, positions = shape(data, word)
    x = 0
    glyphs = []
    for info, pos, ch in zip(infos, positions, word):
        name = order[info.codepoint]
        pen = SVGPathPen(glyph_set, ntos=lambda v: ("%.1f" % v).rstrip("0").rstrip("."))
        # Unidades em "milésimos de em", eixo y para baixo e linha de base em y=0.
        k = 1000 / upem
        glyph_set[name].draw(TransformPen(pen, (k, 0, 0, -k, (x + pos.x_offset) * k, -pos.y_offset * k)))
        if ch != " ":
            glyphs.append({"ch": ch, "x": round(x * k, 1), "adv": round(pos.x_advance * k, 1), "d": pen.getCommands()})
        x += pos.x_advance
    out[word] = {"width": round(x * 1000 / upem, 1), "cap": round(cap * 1000 / upem, 1), "glyphs": glyphs}
    print(word, out[word]["width"], out[word]["cap"], len(glyphs))

with open(os.path.join(ROOT, "dist/js/type-data.js"), "w", encoding="utf-8") as f:
    f.write("// Gerado por scripts/trace-type.py (Geist, OFL). Não editar à mão.\n")
    f.write("export const TYPE = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
