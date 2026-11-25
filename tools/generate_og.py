"""Generate the 1200x630 OpenGraph image for the site."""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = (247, 246, 242)
INK = (17, 24, 39)
INK2 = (75, 85, 99)
INK3 = (107, 114, 128)
LINE = (228, 224, 214)
EMERALD = (5, 150, 105)
CARD = (255, 255, 255)

BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

# soft emerald glow bottom-right
glow = Image.new("RGB", (W, H), PAPER)
gd = ImageDraw.Draw(glow)
gd.ellipse((760, 300, 1300, 780), fill=(226, 244, 236))
img = Image.blend(img, glow, 0.55)
d = ImageDraw.Draw(img)

# left text
x = 78
d.text((x, 116), "FREE TOOL  ·  NO SIGN-UP  ·  NO WATERMARK", font=font(BOLD, 22), fill=EMERALD)
d.text((x, 168), "Free invoice", font=font(BOLD, 86), fill=INK)
d.text((x, 262), "generator", font=font(BOLD, 86), fill=INK)
d.text((x, 380), "Tax, discount, deposit and balance.", font=font(REG, 30), fill=INK2)
d.text((x, 422), "Live A4 / Letter preview · 10 currencies", font=font(REG, 30), fill=INK2)
d.text((x, 464), "Print or save as PDF in one click.", font=font(REG, 30), fill=INK2)

# brand mark
d.rounded_rectangle((x, 520, x + 40, 560), radius=10, fill=INK)
d.text((x + 12, 527), "IK", font=font(BOLD, 17), fill=CARD)
d.text((x + 54, 528), "Invoice & Rate Kit", font=font(BOLD, 24), fill=INK)

# invoice card mock, right side
cx, cy, cw, ch = 730, 90, 400, 500
d.rounded_rectangle((cx + 10, cy + 12, cx + cw + 10, cy + ch + 12), radius=22, fill=(232, 229, 221))
d.rounded_rectangle((cx, cy, cx + cw, cy + ch), radius=22, fill=CARD, outline=LINE, width=2)

px = cx + 34
d.rounded_rectangle((px, cy + 34, px + 46, cy + 80), radius=11, fill=INK)
d.text((px + 13, cy + 45), "SN", font=font(BOLD, 19), fill=CARD)
d.text((px + 60, cy + 38), "Studio Nova", font=font(BOLD, 22), fill=INK)
d.text((px + 60, cy + 64), "Lisbon, Portugal", font=font(REG, 16), fill=INK3)

d.text((cx + cw - 34 - d.textlength("INVOICE", font=font(BOLD, 30)), cy + 34), "INVOICE", font=font(BOLD, 30), fill=INK)
d.text((cx + cw - 34 - d.textlength("INV-2026-014", font=font(REG, 15)), cy + 74), "INV-2026-014", font=font(REG, 15), fill=INK3)
d.text((cx + cw - 34 - d.textlength("Due 10 Dec 2026", font=font(REG, 15)), cy + 96), "Due 10 Dec 2026", font=font(REG, 15), fill=INK3)

d.line((px, cy + 138, cx + cw - 34, cy + 138), fill=LINE, width=2)
d.text((px, cy + 152), "DESCRIPTION", font=font(BOLD, 12), fill=INK3)
d.text((cx + cw - 34 - d.textlength("AMOUNT", font=font(BOLD, 12)), cy + 152), "AMOUNT", font=font(BOLD, 12), fill=INK3)

rows = [("Homepage redesign", "$2,400.00"), ("Design system · 12 h", "$1,140.00"), ("Landing page copy", "$680.00")]
y = cy + 184
for label, amt in rows:
    d.text((px, y), label, font=font(REG, 18), fill=INK)
    d.text((cx + cw - 34 - d.textlength(amt, font=font(BOLD, 18)), y), amt, font=font(BOLD, 18), fill=INK)
    d.line((px, y + 30, cx + cw - 34, y + 30), fill=(238, 240, 243), width=1)
    y += 50

d.text((px, y + 6), "Subtotal", font=font(REG, 18), fill=INK3)
d.text((cx + cw - 34 - d.textlength("$4,220.00", font=font(REG, 18)), y + 6), "$4,220.00", font=font(REG, 18), fill=INK2)
d.text((px, y + 38), "VAT 23%", font=font(REG, 18), fill=INK3)
d.text((cx + cw - 34 - d.textlength("$970.60", font=font(REG, 18)), y + 38), "$970.60", font=font(REG, 18), fill=INK2)

d.line((px, y + 74, cx + cw - 34, y + 74), fill=INK, width=3)
d.text((px, y + 86), "Total due", font=font(BOLD, 22), fill=INK)
d.text((cx + cw - 34 - d.textlength("$5,190.60", font=font(BOLD, 30)), y + 80), "$5,190.60", font=font(BOLD, 30), fill=EMERALD)

# card is slightly taller so the total block breathes
d.text((px, y + 6), "Subtotal", font=font(REG, 18), fill=INK3)

img.save("assets/img/og-image.png", optimize=True)
print("wrote assets/img/og-image.png", img.size)
