from pathlib import Path
from PIL import Image

SOURCE = Path('/home/ubuntu/ABUAD-Fashion-Hub/public/branding/mastercart-source.png')
ROOT = Path('/home/ubuntu/ABUAD-Fashion-Hub/public')
BRANDING = ROOT / 'branding'
ICONS = ROOT / 'icons'
BRANDING.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

source = Image.open(SOURCE).convert('RGBA')

# Keep the supplied artwork unchanged for the full-logo and lockup assets.
full = source.resize((1024, 1024), Image.Resampling.LANCZOS)
full.save(BRANDING / 'mastercart-logo.png', optimize=True)
full.save(BRANDING / 'mastercart-lockup.png', optimize=True)

# Derive the icon-safe crown/cart mark from the supplied artwork. This is a crop
# of the approved artwork, not a recreated or modified logo symbol.
mark_crop = source.crop((230, 250, 900, 850))
mark_square = Image.new('RGBA', (1024, 1024), (0, 0, 0, 255))
mark_size = 820
mark = mark_crop.resize((mark_size, mark_size), Image.Resampling.LANCZOS)
mark_square.alpha_composite(mark, ((1024 - mark_size) // 2, (1024 - mark_size) // 2))
mark_square.save(BRANDING / 'mastercart-mark.png', optimize=True)

# Preserve the legacy public path as an official MasterCart mark so any remaining
# runtime reference cannot display the former brand asset.
mark_square.save(ROOT / 'logo.png', optimize=True)

sizes = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512]
for size in sizes:
    icon = mark_square.resize((size, size), Image.Resampling.LANCZOS)
    icon.save(ICONS / f'icon-{size}.png', optimize=True)

mark_square.resize((512, 512), Image.Resampling.LANCZOS).save(BRANDING / 'mastercart-icon-512.png', optimize=True)
mark_square.resize((192, 192), Image.Resampling.LANCZOS).save(BRANDING / 'mastercart-icon-192.png', optimize=True)
mark_square.resize((180, 180), Image.Resampling.LANCZOS).save(BRANDING / 'apple-touch-icon.png', optimize=True)

favicon = mark_square.resize((48, 48), Image.Resampling.LANCZOS)
favicon.save(ROOT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
