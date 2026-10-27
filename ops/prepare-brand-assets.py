"""Prepara a marca sem alterar Logo/. Uso: python ops/prepare-brand-assets.py (Pillow)."""

import io
from base64 import b64encode
from pathlib import Path
from shutil import copyfile

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Logo"
PUBLIC = ROOT / "apps/web/public/brand"
APP = ROOT / "apps/web/app"
NAVY = "#0b1f3b"
PUBLIC.mkdir(parents=True, exist_ok=True)


def artwork(name: str) -> Image.Image:
    image = Image.open(SOURCE / name).convert("RGBA")
    # Desconsidera pixels quase invisíveis ao medir as margens, preservando a arte.
    bounds = image.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
    if bounds is None:
        raise ValueError(f"Arquivo sem arte visível: {name}")
    return ImageOps.expand(image.crop(bounds), border=4)


def canvas(image: Image.Image, size: tuple[int, int], fill=None, scale=1.0) -> Image.Image:
    result = Image.new("RGBA", size, fill)
    fitted = ImageOps.contain(image, tuple(round(side * scale) for side in size), Image.Resampling.LANCZOS)
    result.alpha_composite(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
    return result


mark = artwork("Imagem do ChatGPT 26 de out. de 2026, 23_08_55-1.png")
logo = artwork("Imagem do ChatGPT 26 de out. de 2026, 23_08_55-2.png")
light_logo = artwork("Imagem do ChatGPT 26 de out. de 2026, 23_15_50-2.png")
app_icon = artwork("Imagem do ChatGPT 26 de out. de 2026, 23_08_57-4.png")

canvas(mark, (256, 256)).save(PUBLIC / "openfix-mark.webp", quality=95)
canvas(logo, (1080, 270)).save(PUBLIC / "openfix-logo.webp", quality=95)
canvas(light_logo, (1080, 270)).save(PUBLIC / "openfix-logo-white.webp", quality=95)
canvas(mark, (512, 512)).save(APP / "icon.png", optimize=True)
canvas(app_icon, (180, 180), NAVY, 0.8).convert("RGB").save(APP / "apple-icon.png", optimize=True)
copyfile(SOURCE / "favicon.ico", APP / "favicon.ico")

for size in (192, 512):
    # Arte dentro da zona segura circular dos ícones maskable.
    canvas(app_icon, (size, size), NAVY, 0.7).convert("RGB").save(PUBLIC / f"app-icon-{size}.png", optimize=True)

social = Image.new("RGBA", (1200, 630), NAVY)
social.alpha_composite(canvas(logo, (960, 240)), (120, 195))
social.convert("RGB").save(PUBLIC / "openfix-social.jpg", quality=92, optimize=True)

# E-mails e PDF usam o mesmo símbolo embutido para dispensar URL pública.
buffer = io.BytesIO()
canvas(mark, (144, 144)).save(buffer, format="PNG", optimize=True)
encoded = b64encode(buffer.getvalue()).decode("ascii")
(ROOT / "packages/domain/src/brand/logo.ts").write_text(
    '/** Símbolo oficial Openfix em PNG 144×144 para e-mails e PDFs. Gerado por ops/prepare-brand-assets.py. */\n'
    f'export const BRAND_LOGO_PNG_BASE64 =\n  "{encoded}";\n\n'
    'export function brandLogoPng(): Buffer {\n  return Buffer.from(BRAND_LOGO_PNG_BASE64, "base64");\n}\n',
    encoding="utf-8",
)
