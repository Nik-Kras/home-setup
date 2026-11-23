import subprocess, os
from PIL import Image
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MINT, LILAC, BG1, BG2 = "#5EE0B8", "#B9A4FF", "#16231E", "#0E1110"
def glyph(c1, c2, scale):
    return f'''<g transform="translate(54 54) scale({scale}) translate(-54 -54)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">
<g stroke="{c2}"><circle cx="66" cy="42" r="11"/><path d="M58 50 L30 78"/><path d="M42 66 L37 61"/><path d="M36 72 L31 67"/></g>
<g stroke="{c1}"><circle cx="42" cy="42" r="11"/><path d="M50 50 L78 78"/><path d="M66 66 L71 61"/><path d="M72 72 L77 67"/></g></g>'''
def page(inner, size, bg):
    css = "html,body{margin:0;background:%s}" % bg
    return f'<!doctype html><meta charset="utf-8"><style>{css}</style><svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 108 108">{inner}</svg>'
BGDEF = f'<defs><linearGradient id="g" x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="{BG1}"/><stop offset="1" stop-color="{BG2}"/></linearGradient></defs><rect width="108" height="108" fill="url(#g)"/>'
jobs = {
 "icon": (BGDEF + glyph(MINT, LILAC, 1.35), 1024, BG2, False, "ios"),
 "android-icon-foreground": (glyph(MINT, LILAC, 0.85), 1024, "transparent", True, "tr"),
 "android-icon-background": (BGDEF, 1024, BG2, False, "bg"),
 "android-icon-monochrome": (glyph("#FFFFFF", "#FFFFFF", 0.85), 432, "transparent", True, "tr"),
 "splash-icon": (glyph(MINT, LILAC, 0.8), 1024, "transparent", True, "tr"),
 "favicon": (BGDEF + glyph(MINT, LILAC, 1.5), 48, BG2, False, "ios"),
}
os.makedirs("out", exist_ok=True)
for name,(inner,size,bg,tr,kind) in jobs.items():
    html=f"/tmp/icons/{name}.html"; open(html,"w").write(page(inner,size,bg))
    png=f"/tmp/icons/out/{name}.png"
    cmd=[CH,"--headless=new","--disable-gpu","--hide-scrollbars",f"--window-size={size},{size}",f"--screenshot={png}","--force-device-scale-factor=1"]
    if tr: cmd.append("--default-background-color=00000000")
    subprocess.run(cmd+[f"file://{html}"],capture_output=True,timeout=60)
    im=Image.open(png)
    if kind in ("ios","bg"): im=im.convert("RGB")
    if im.size!=(size,size): im=im.crop((0,0,size,size))
    im.save(png)
    print(name, im.size, im.mode)
