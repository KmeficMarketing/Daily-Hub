#!/usr/bin/env python3
"""Build a KMEFIC capital-increase (rights issue) client circular: A4 portrait PDF + PNG.

Usage:
  python3 tools/circular/build.py spec.json OUTDIR [--fonts DIR] [--hol hol.json]

spec.json (one rights issue):
{
  "id": "AQAR-2026-10",                 # stable id: <TICKER>-<YYYY>-<MM of record date>
  "status": "final",                    # kept for history; output is always a clean, sendable file
  "watermark": false,                   # optional: true adds a "مسودة / DRAFT" watermark
  "date": "2026-10-25",                 # circular date
  "co_ar_full": "شركة عقار للاستثمارات العقارية ش.م.ك.ع",
  "co_en_full": "AQAR REAL ESTATE INVESTMENTS CO. K.S.C.P",
  "co_en_title": "Aqar Real Estate Investments (K.S.C.P)",
  "name_ar": "عقار", "code": "421", "ticker": "AQAR",
  "pct": "10", "price": "100", "par": "100",
  "cum": "2026-10-20", "rt_from": "2026-10-27", "rt_to": "2026-11-03",
  "sub_end": "2026-11-10",
  "last": "2026-11-05"                  # optional; default = 3 Kuwait business days before sub_end
}
The legal suffix (ش.م.ك.ع / K.S.C.P for listed public companies) and the Boursa code must be
checked against an official source before "final".

Fonts: Eurostile, Eurostile Bold, GE SS Text Light/Medium, GE SS Two Medium, Calibri must be
installed (pass --fonts DIR to install a folder of TTF/OTF files into ~/.fonts first).
Exits with code 3 if a required font is missing, so no circular is published with substitutes.
"""
import argparse, copy, datetime as dt, json, os, re, shutil, subprocess, sys, tempfile, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, 'template_landscape_tokens.pptx')
PORTRAIT = os.path.join(HERE, 'portrait.py')
REQUIRED = ['Eurostile', 'GE SS Text Light', 'GE SS Text Medium', 'GE SS Two Medium']
MON_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MON_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']


def soffice():
    for c in ('soffice', 'libreoffice'):
        if shutil.which(c): return [c]
    # Anthropic sandbox wrapper (bare soffice can hang there)
    for root, _, files in os.walk('/root/.claude/skills'):
        if 'soffice.py' in files and root.endswith('office'):
            return [sys.executable, os.path.join(root, 'soffice.py')]
    sys.exit('LibreOffice not found')


def suf(d):
    return 'th' if 11 <= d % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(d % 10, 'th')


def dmy(s): return dt.date.fromisoformat(s).strftime('%d/%m/%Y')


def kw_business_days_before(end, n, hol):
    d = dt.date.fromisoformat(end)
    while n:
        d -= dt.timedelta(days=1)
        if d.weekday() in (4, 5) or d.isoformat() in hol:   # Fri, Sat, Kuwait holidays
            continue
        n -= 1
    return d.isoformat()


def install_fonts(src):
    dst = os.path.expanduser('~/.fonts/kmefic-hub')
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(src):
        if f.lower().endswith(('.ttf', '.otf')):
            shutil.copy(os.path.join(src, f), dst)
    subprocess.run(['fc-cache', '-f'], check=False, capture_output=True)


def check_fonts():
    out = subprocess.run(['fc-list', ':', 'family', 'fullname'], capture_output=True, text=True).stdout
    missing = [f for f in REQUIRED if f not in out]
    if missing:
        print('MISSING FONTS:', ', '.join(missing), file=sys.stderr); sys.exit(3)


def fill_tokens(spec, hol, src, dst):
    d = dt.date.fromisoformat(spec['date'])
    last = spec.get('last') or kw_business_days_before(spec['sub_end'], 3, hol)
    spec['last'] = last
    ld = dt.date.fromisoformat(last)
    tok = {
        'D_DAY': str(d.day), 'D_SUF': suf(d.day), 'D_MY_EN': f'{MON_EN[d.month-1]} {d.year}',
        'D_AR': f'{d.day} {MON_AR[d.month-1]} {d.year}',
        'SCRIPT': f"{spec['name_ar']} ({spec['code']}) {spec['ticker']}",
        'CO_AR_FULL': spec['co_ar_full'], 'CO_EN_FULL': spec['co_en_full'], 'CO_EN_TITLE': spec['co_en_title'],
        'PCT': spec['pct'], 'PRICE': spec['price'], 'PAR': spec['par'],
        'CUM': dmy(spec['cum']), 'RT_FROM': dmy(spec['rt_from']), 'RT_TO': dmy(spec['rt_to']),
        'LAST': dmy(last), 'LAST_AR': f'{ld.day} {MON_AR[ld.month-1]} {ld.year}',
        'LAST_DAY': str(ld.day), 'LAST_SUF': suf(ld.day), 'LAST_MY_EN': f'{MON_EN[ld.month-1]} {ld.year}',
    }
    esc = lambda v: v.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == 'ppt/slides/slide1.xml':
                x = data.decode('utf8')
                for k, v in tok.items(): x = x.replace('{{%s}}' % k, esc(str(v)))
                left = re.findall(r'\{\{\w+\}\}', x)
                if left: sys.exit('unfilled tokens: %s' % left)
                data = x.encode('utf8')
            zout.writestr(item, data)


def add_watermark(pptx):
    from pptx import Presentation
    from pptx.util import Emu, Pt
    from lxml import etree
    A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    p = Presentation(pptx); s = p.slides[0]; W, H = p.slide_width, p.slide_height
    w, h = int(W * 0.9), 900000
    tb = s.shapes.add_textbox(Emu((W - w) // 2), Emu((H - h) // 2), Emu(w), Emu(h))
    tb.name = 'DRAFT watermark'; tb.rotation = -35
    tf = tb.text_frame; tf.word_wrap = False
    para = tf.paragraphs[0]; para.alignment = 2
    # Arabic words in GE SS Two Medium; dash and Latin in Eurostile (GE SS has no Latin/dash glyphs)
    for text, cs_face, bold in (('مسودة للمراجعة', 'GE SS Two Medium', False), ('  –  DRAFT', 'Eurostile', True)):
        r = para.add_run(); r.text = text
        r.font.size = Pt(40); r.font.bold = bold
        rpr = r._r.get_or_add_rPr()
        fill = etree.SubElement(rpr, '{%s}solidFill' % A)
        c = etree.SubElement(fill, '{%s}srgbClr' % A); c.set('val', 'C0392B')
        etree.SubElement(c, '{%s}alpha' % A).set('val', '22000')
        for tag, face in (('latin', 'Eurostile'), ('cs', cs_face)):
            e = etree.SubElement(rpr, '{%s}%s' % (A, tag)); e.set('typeface', face)
    p.save(pptx)


def render(pptx, outdir):
    subprocess.run(soffice() + ['--headless', '--convert-to', 'pdf', '--outdir', outdir, pptx],
                   check=True, capture_output=True, timeout=240)
    return os.path.join(outdir, os.path.splitext(os.path.basename(pptx))[0] + '.pdf')


def last_text_bottom_emu(pdf):
    import pdfplumber
    pg = pdfplumber.open(pdf).pages[0]
    ys = [w['bottom'] for w in pg.extract_words() if w['text'] in ('KMEFIC', 'كميفك') and w['top'] < pg.height * 0.95 - 60]
    return int(max(ys) * 12700) if ys else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('spec'); ap.add_argument('outdir')
    ap.add_argument('--fonts'); ap.add_argument('--hol', help='JSON list of Kuwait holiday dates (YYYY-MM-DD)')
    a = ap.parse_args()
    if a.fonts: install_fonts(a.fonts)
    check_fonts()
    spec = json.load(open(a.spec, encoding='utf8'))
    hol = set(json.load(open(a.hol))) if a.hol else set()
    os.makedirs(a.outdir, exist_ok=True)
    wm = bool(spec.get('watermark'))
    base = f"KMEFIC_Circular_{spec['ticker']}_Rights_{spec['date']}" + ('_DRAFT' if wm else '')
    with tempfile.TemporaryDirectory() as td:
        filled = os.path.join(td, 'filled.pptx'); fill_tokens(spec, hol, TEMPLATE, filled)
        out = os.path.join(td, base + '.pptx')
        env = dict(os.environ, BODYPT='10.5')
        subprocess.run([sys.executable, PORTRAIT, filled, out], check=True, env=env, capture_output=True)
        pdf = render(out, td)
        bottom = last_text_bottom_emu(pdf)
        if bottom:   # place the gold bracket line just under the signature
            env['FB'] = str(bottom + 125000)
            subprocess.run([sys.executable, PORTRAIT, filled, out], check=True, env=env, capture_output=True)
        if wm: add_watermark(out)
        pdf = render(out, td)
        fonts = subprocess.run(['pdffonts', pdf], capture_output=True, text=True).stdout
        bad = [l.split()[0] for l in fonts.splitlines()[2:] if l and not re.search(r'Eurostile|GESS|Calibri', l)]
        if bad: print('substitute fonts in PDF:', bad, file=sys.stderr); sys.exit(3)
        subprocess.run(['pdftoppm', '-png', '-r', '300', '-singlefile', pdf, os.path.join(td, 'page')], check=True)
        from PIL import Image
        Image.open(os.path.join(td, 'page.png')).convert('RGB').save(os.path.join(a.outdir, base + '.png'), optimize=True)
        shutil.copy(pdf, os.path.join(a.outdir, base + '.pdf'))
        shutil.copy(out, os.path.join(a.outdir, base + '.pptx'))
    json.dump(spec, open(os.path.join(a.outdir, base + '.spec.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(json.dumps({'base': base, 'last': spec['last'], 'status': 'draft' if wm else 'final'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
