"""Membuat ilustrasi placeholder SVG (mudah diganti dengan foto asli lewat Admin)."""
import os, random

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "placeholders")
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 900

PALETTES = [
    dict(name="oak", wall="#EFE8DA", wall2="#E3D8C3", floor="#C9B79C", body="#B4875F", body2="#9A6B43", accent="#2A2A2A", top="#F3EFE8"),
    dict(name="white", wall="#E9E4DA", wall2="#DCD3C2", floor="#B9A58A", body="#F7F4EE", body2="#E7E1D6", accent="#B08D57", top="#3A3A3A"),
    dict(name="charcoal", wall="#EDE7DC", wall2="#D9CFBE", floor="#A88B6A", body="#3A3A3A", body2="#2A2A2A", accent="#C8A46A", top="#EFE8DA"),
    dict(name="sage", wall="#F1ECE2", wall2="#E1D8C6", floor="#BFA684", body="#8C9A84", body2="#77866F", accent="#C8A46A", top="#F8F4EC"),
    dict(name="walnut", wall="#ECE4D6", wall2="#DCCFB9", floor="#9F8466", body="#7C5433", body2="#5E3F27", accent="#D9BE8C", top="#E9E4DA"),
]

def frame(p, inner):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{p['wall']}"/><stop offset="1" stop-color="{p['wall2']}"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{p['floor']}"/><stop offset="1" stop-color="#8E7558"/></linearGradient>
<linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
</defs>
<rect width="{W}" height="{H}" fill="url(#wall)"/>
<rect y="700" width="{W}" height="200" fill="url(#floor)"/>
<rect y="696" width="{W}" height="6" fill="#000" opacity=".06"/>
{inner}
<polygon points="0,0 520,0 180,900 0,900" fill="url(#light)"/>
</svg>'''

def handle(x, y, w=40, color="#2A2A2A", vertical=False):
    if vertical:
        return f'<rect x="{x}" y="{y}" width="5" height="{w}" rx="2.5" fill="{color}"/>'
    return f'<rect x="{x}" y="{y}" width="{w}" height="5" rx="2.5" fill="{color}"/>'

def plant(x, y, s=1.0):
    return f'''<g transform="translate({x},{y}) scale({s})">
<path d="M0 0 C-30 -60 -10 -110 0 -140 C10 -110 30 -60 0 0Z" fill="#6E7F5E"/>
<path d="M0 0 C-60 -40 -70 -90 -55 -110 C-35 -80 -15 -50 0 0Z" fill="#82946F"/>
<path d="M0 0 C60 -40 70 -90 55 -110 C35 -80 15 -50 0 0Z" fill="#5D6E4F"/>
<rect x="-28" y="0" width="56" height="60" rx="8" fill="#E7DCCB"/></g>'''

def pendant(x):
    return f'<line x1="{x}" y1="0" x2="{x}" y2="150" stroke="#2A2A2A" stroke-width="2"/><path d="M{x-35} 185 Q{x} 140 {x+35} 185Z" fill="#2A2A2A"/><ellipse cx="{x}" cy="187" rx="14" ry="4" fill="#F8E7B9"/>'

def kitchen(p):
    s = []
    s.append(f'<rect x="120" y="150" width="960" height="210" fill="{p["body"]}"/>')
    for i in range(6):
        x = 120 + i * 160
        s.append(f'<rect x="{x+4}" y="154" width="152" height="202" fill="{p["body2"]}" opacity=".25"/>')
        s.append(handle(x + 60, 335, 40, p["accent"]))
    s.append(f'<rect x="120" y="360" width="960" height="12" fill="#000" opacity=".08"/>')
    s.append(f'<rect x="120" y="372" width="960" height="118" fill="#F2EDE4"/>')
    for i in range(16):
        s.append(f'<line x1="{120+i*60}" y1="372" x2="{120+i*60}" y2="490" stroke="#E2DACB"/>')
    s.append(f'<rect x="100" y="490" width="1000" height="22" fill="{p["top"]}"/>')
    s.append(f'<rect x="120" y="512" width="960" height="188" fill="{p["body"]}"/>')
    for i in range(6):
        x = 120 + i * 160
        s.append(f'<rect x="{x+4}" y="516" width="152" height="180" fill="{p["body2"]}" opacity=".25"/>')
        s.append(handle(x + 60, 530, 40, p["accent"]))
    s.append('<rect x="610" y="470" width="120" height="20" rx="3" fill="#B9B9B9"/><path d="M670 470 V430 Q670 410 690 410" stroke="#8A8A8A" stroke-width="6" fill="none"/>')
    s.append('<rect x="300" y="478" width="160" height="12" rx="3" fill="#2A2A2A"/>')
    s.append(plant(1010, 430, .55))
    return "".join(s)

def island(p):
    s = [kitchen(dict(p, body=p["body2"]))]
    s.append(f'<rect x="300" y="560" width="600" height="24" fill="{p["top"]}"/>')
    s.append(f'<rect x="320" y="584" width="560" height="200" fill="{p["body"]}"/>')
    for i in range(4):
        s.append(handle(370 + i * 140, 600, 40, p["accent"]))
    s.append(pendant(450) + pendant(750))
    return "".join(s)

def wardrobe(p):
    s = [f'<rect x="220" y="110" width="760" height="590" fill="{p["body"]}"/>']
    for i in range(4):
        x = 220 + i * 190
        s.append(f'<rect x="{x+5}" y="115" width="180" height="580" fill="{p["body2"]}" opacity=".22"/>')
        s.append(handle(x + (170 if i % 2 == 0 else 15), 360, 120, p["accent"], True))
    s.append(f'<rect x="220" y="100" width="760" height="10" fill="{p["body2"]}"/>')
    s.append(plant(1070, 640, .9))
    return "".join(s)

def tv(p):
    s = [f'<rect x="200" y="140" width="800" height="380" fill="{p["body2"]}" opacity=".35"/>']
    for i in range(12):
        s.append(f'<rect x="{200+i*66}" y="140" width="4" height="380" fill="{p["body2"]}" opacity=".4"/>')
    s.append('<rect x="390" y="230" width="420" height="240" rx="6" fill="#1C1C1C"/><rect x="398" y="238" width="404" height="224" rx="3" fill="#2E3440"/>')
    s.append(f'<rect x="160" y="560" width="880" height="140" fill="{p["body"]}"/>')
    for i in range(4):
        s.append(handle(250 + i * 220, 620, 50, p["accent"]))
    s.append(plant(1090, 640, .8))
    return "".join(s)

def table(p):
    s = [pendant(600)]
    s.append(f'<rect x="300" y="500" width="600" height="26" rx="4" fill="{p["body"]}"/>')
    s.append(f'<rect x="340" y="526" width="22" height="174" fill="{p["body2"]}"/><rect x="838" y="526" width="22" height="174" fill="{p["body2"]}"/>')
    for x in (230, 900):
        s.append(f'<rect x="{x}" y="440" width="70" height="110" rx="10" fill="#E7DCCB"/><rect x="{x}" y="550" width="70" height="14" fill="#D3C3A9"/><rect x="{x+8}" y="564" width="8" height="136" fill="#2A2A2A"/><rect x="{x+54}" y="564" width="8" height="136" fill="#2A2A2A"/>')
    s.append('<circle cx="600" cy="480" r="18" fill="#C8A46A"/>')
    return "".join(s)

def shelf(p):
    s = [f'<rect x="300" y="120" width="600" height="580" fill="none" stroke="{p["body"]}" stroke-width="18"/>']
    for i in range(1, 5):
        y = 120 + i * 116
        s.append(f'<rect x="300" y="{y}" width="600" height="14" fill="{p["body"]}"/>')
    cols = ["#C8A46A", "#8C9A84", "#3A3A3A", "#E7DCCB", "#9A6B43"]
    for r in range(5):
        y = 120 + r * 116
        x = 330
        random.seed(r)
        for b in range(random.randint(4, 7)):
            h = random.randint(50, 90)
            w = random.randint(14, 26)
            s.append(f'<rect x="{x}" y="{y+110-h}" width="{w}" height="{h}" fill="{cols[(b+r)%5]}"/>')
            x += w + 4
        s.append(f'<circle cx="{760}" cy="{y+80}" r="26" fill="#E7DCCB"/>')
    return "".join(s)

def bathroom(p):
    s = ['<rect x="380" y="130" width="440" height="300" rx="150" fill="#DCE3E3" stroke="#B08D57" stroke-width="6"/>']
    s.append(f'<rect x="300" y="480" width="600" height="20" fill="{p["top"]}"/><ellipse cx="600" cy="490" rx="110" ry="14" fill="#fff"/>')
    s.append(f'<rect x="320" y="500" width="560" height="170" fill="{p["body"]}"/>')
    s.append(handle(440, 520, 60, p["accent"]) + handle(700, 520, 60, p["accent"]))
    s.append(plant(990, 640, .7))
    return "".join(s)

def office(p):
    s = [f'<rect x="150" y="150" width="380" height="380" fill="#E9E4DA" stroke="{p["body"]}" stroke-width="10"/>']
    for i in range(1, 4):
        s.append(f'<rect x="150" y="{150+i*95}" width="380" height="8" fill="{p["body"]}"/>')
    s.append(f'<rect x="560" y="500" width="520" height="24" fill="{p["body"]}"/><rect x="580" y="524" width="160" height="176" fill="{p["body2"]}"/><rect x="1040" y="524" width="18" height="176" fill="{p["body2"]}"/>')
    s.append('<rect x="760" y="380" width="200" height="120" rx="6" fill="#1C1C1C"/><rect x="845" y="500" width="30" height="6" fill="#1C1C1C"/>')
    s.append('<rect x="780" y="560" width="120" height="70" rx="12" fill="#3A3A3A"/><rect x="835" y="630" width="10" height="70" fill="#2A2A2A"/>')
    return "".join(s)

def living(p):
    s = ['<rect x="420" y="160" width="360" height="240" fill="#F8F4EC" stroke="#B08D57" stroke-width="8"/><path d="M440 380 L540 260 L620 340 L680 290 L760 380Z" fill="#C9A27E"/>']
    s.append(f'<rect x="230" y="520" width="740" height="120" rx="30" fill="{p["body"]}"/><rect x="200" y="470" width="90" height="190" rx="30" fill="{p["body2"]}"/><rect x="910" y="470" width="90" height="190" rx="30" fill="{p["body2"]}"/>')
    s.append('<rect x="300" y="480" width="180" height="70" rx="20" fill="#E7DCCB"/><rect x="720" y="480" width="180" height="70" rx="20" fill="#E7DCCB"/>')
    s.append(plant(1100, 640, .9))
    return "".join(s)

SCENES = dict(kitchen=kitchen, island=island, wardrobe=wardrobe, tv=tv, table=table, shelf=shelf,
              bathroom=bathroom, office=office, living=living)

count = 0
for name, fn in SCENES.items():
    for i, p in enumerate(PALETTES[:3] if name not in ("kitchen",) else PALETTES):
        with open(os.path.join(OUT, f"{name}-{i+1}.svg"), "w") as f:
            f.write(frame(p, fn(p)))
        count += 1

# Tekstur sampel material
def swatch(name, base, kind):
    inner = f'<rect width="400" height="400" fill="{base}"/>'
    if kind == "wood":
        random.seed(name)
        for i in range(40):
            y = i * 10 + random.randint(-3, 3)
            inner += f'<path d="M0 {y} C100 {y+random.randint(-8,8)} 300 {y+random.randint(-8,8)} 400 {y}" stroke="#000" stroke-opacity=".07" fill="none" stroke-width="{random.choice([1,2,3])}"/>'
    elif kind == "marble":
        inner += '<path d="M0 120 C120 160 180 60 400 140" stroke="#9A9A9A" stroke-opacity=".35" fill="none" stroke-width="3"/><path d="M0 300 C140 240 260 360 400 280" stroke="#9A9A9A" stroke-opacity=".25" fill="none" stroke-width="2"/>'
    with open(os.path.join(OUT, f"swatch-{name}.svg"), "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">{inner}</svg>')

swatch("wood", "#B4875F", "wood"); swatch("marble", "#EEECE8", "marble"); swatch("solid", "#E9E4DA", "solid")
print("generated", count, "scenes")
