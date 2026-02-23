from __future__ import annotations

import math
import textwrap
from dataclasses import dataclass
from pathlib import Path
import zipfile

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / 'assets'
OUT_DIR = ROOT / 'store-assets' / 'play'

ICON_SOURCE = ASSETS_DIR / 'icon.png'
PLAY_ICON_SIZE = (512, 512)
FEATURE_SIZE = (1024, 500)

PHONE_SIZE = (1080, 1920)
TABLET_7_SIZE = (1200, 1920)
TABLET_10_SIZE = (1920, 1200)

BACKGROUND_TOP = (4, 25, 46)
BACKGROUND_MID = (10, 51, 84)
BACKGROUND_BOTTOM = (17, 109, 119)
ACCENT_GOLD = (241, 198, 92)
ACCENT_GREEN = (45, 188, 164)
TEXT_LIGHT = (246, 251, 255)
TEXT_MUTED = (195, 218, 234)
CARD_BORDER = (123, 176, 203)


@dataclass(frozen=True)
class ScreenSpec:
    slug: str
    title: str
    subtitle: str
    bullets: list[str]
    cta: str


SCREENS: list[ScreenSpec] = [
    ScreenSpec(
        slug='home-role-selection',
        title='Choose user type',
        subtitle='Organizer or participant at app startup.',
        bullets=[
            'Bilingual interface (IT / EN)',
            'Legal disclaimer and privacy module',
            'Search-ready event catalog',
        ],
        cta='Start with Events',
    ),
    ScreenSpec(
        slug='organizer-onboarding',
        title='Organizer onboarding',
        subtitle='Email, tax details, and payout profile.',
        bullets=[
            'Anti-fraud risk scoring',
            'Verification status and payout control',
            'Secure profile sync with Supabase',
        ],
        cta='Create organizer account',
    ),
    ScreenSpec(
        slug='event-creation',
        title='Create free or paid events',
        subtitle='Name, location, date, privacy and sponsor options.',
        bullets=[
            'Entry fee support with 3% app commission',
            'Participant number assignment',
            'Event activation for public search',
        ],
        cta='Publish event',
    ),
    ScreenSpec(
        slug='organizer-dashboard',
        title='Organizer dashboard',
        subtitle='Real-time registrations and payment states.',
        bullets=[
            'Live list of participants',
            'Gross revenue and commission metrics',
            'CSV export for operations',
        ],
        cta='Monitor registrations in real time',
    ),
    ScreenSpec(
        slug='participant-search',
        title='Participant event search',
        subtitle='Filter by name, location, and active status.',
        bullets=[
            'Fast event discovery',
            'Free and paid event visibility',
            'Sponsor/ad placement support',
        ],
        cta='Find the right event',
    ),
    ScreenSpec(
        slug='participant-registration',
        title='Registration with privacy consent',
        subtitle='Collect participant data with explicit consent flags.',
        bullets=[
            'Privacy and retention consent fields',
            'Automatic registration code generation',
            'Confirmation flow with email webhook',
        ],
        cta='Complete registration',
    ),
    ScreenSpec(
        slug='payment-flow',
        title='Paid registration flow',
        subtitle='Pending session, payment confirmation, webhook sync.',
        bullets=[
            'Stripe-ready webhook architecture',
            'Payment status lifecycle management',
            'Organizer list updated after payment',
        ],
        cta='Confirm payment securely',
    ),
    ScreenSpec(
        slug='sponsor-module',
        title='Paid sponsor slots',
        subtitle='Create sponsor packages and generate Stripe links.',
        bullets=[
            'Daily or multi-day sponsor packages',
            'Contracts stored in Supabase (IT/EN)',
            'Banner shown only when active and not expired',
        ],
        cta='Generate sponsor checkout link',
    ),
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        ('C:/Windows/Fonts/segoeuib.ttf', bold),
        ('C:/Windows/Fonts/segoeui.ttf', not bold),
        ('C:/Windows/Fonts/arialbd.ttf', bold),
        ('C:/Windows/Fonts/arial.ttf', not bold),
    ]

    for font_path, condition in candidates:
        if not condition:
            continue
        path = Path(font_path)
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size=size)
            except OSError:
                pass

    return ImageFont.load_default()


def blend(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def gradient_background(width: int, height: int) -> Image.Image:
    image = Image.new('RGB', (width, height), BACKGROUND_TOP)
    draw = ImageDraw.Draw(image)

    split = 0.58
    for y in range(height):
        p = y / max(1, height - 1)
        if p < split:
            local = p / split
            color = blend(BACKGROUND_TOP, BACKGROUND_MID, local)
        else:
            local = (p - split) / (1 - split)
            color = blend(BACKGROUND_MID, BACKGROUND_BOTTOM, local)
        draw.line([(0, y), (width, y)], fill=color)

    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i, radius in enumerate((240, 360, 500, 700)):
        alpha = 28 - i * 5
        cx = int(width * (0.2 + 0.2 * i))
        cy = int(height * (0.18 + 0.14 * i))
        od.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(255, 255, 255, max(alpha, 8)))
    image = Image.alpha_composite(image.convert('RGBA'), overlay).convert('RGB')

    return image


def draw_wrapped_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    x: int,
    y: int,
    max_width: int,
    line_spacing: int = 6,
    max_lines: int | None = None,
) -> int:
    words = text.split()
    lines: list[str] = []
    current = ''

    for word in words:
        test = (current + ' ' + word).strip()
        w = draw.textbbox((0, 0), test, font=font)[2]
        if w <= max_width or not current:
            current = test
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)

    if max_lines is not None and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1].rstrip('.') + '...'

    cursor = y
    for line in lines:
        draw.text((x, cursor), line, font=font, fill=fill)
        h = draw.textbbox((0, 0), line, font=font)[3]
        cursor += h + line_spacing

    return cursor


def safe_mkdir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def create_play_icon() -> Path:
    if not ICON_SOURCE.exists():
        raise FileNotFoundError(f'Icon source missing: {ICON_SOURCE}')

    safe_mkdir(OUT_DIR / 'icon')

    base = Image.open(ICON_SOURCE).convert('RGBA')
    canvas = Image.new('RGBA', PLAY_ICON_SIZE, BACKGROUND_TOP + (255,))

    icon_size = int(PLAY_ICON_SIZE[0] * 0.82)
    resized = base.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    offset = ((PLAY_ICON_SIZE[0] - icon_size) // 2, (PLAY_ICON_SIZE[1] - icon_size) // 2)
    canvas.alpha_composite(resized, offset)

    rgb = Image.new('RGB', PLAY_ICON_SIZE, BACKGROUND_TOP)
    rgb.paste(canvas, mask=canvas.split()[-1])

    out = OUT_DIR / 'icon' / 'play-icon-512.png'
    rgb.save(out, format='PNG', optimize=True)
    return out


def create_feature_graphic() -> Path:
    safe_mkdir(OUT_DIR / 'feature-graphic')
    w, h = FEATURE_SIZE
    img = gradient_background(w, h)
    draw = ImageDraw.Draw(img)

    icon = Image.open(ICON_SOURCE).convert('RGBA')
    icon_size = 210
    icon = icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    icon_x = 72
    icon_y = (h - icon_size) // 2

    chip_bg = Image.new('RGBA', (icon_size + 34, icon_size + 34), (5, 31, 50, 210))
    chip_draw = ImageDraw.Draw(chip_bg)
    chip_draw.rounded_rectangle((0, 0, icon_size + 33, icon_size + 33), radius=42, outline=(150, 198, 222, 180), width=2, fill=(5, 31, 50, 210))
    img.paste(chip_bg, (icon_x - 17, icon_y - 17), chip_bg)
    img.paste(icon, (icon_x, icon_y), icon)

    title_font = load_font(64, bold=True)
    sub_font = load_font(29)
    chip_font = load_font(22, bold=True)

    tx = 340
    draw.text((tx, 130), 'Events', font=title_font, fill=TEXT_LIGHT)
    draw.text((tx, 220), 'Organize events. Register participants. Manage sponsors.', font=sub_font, fill=TEXT_MUTED)

    chips = ['Organizer + Participant', 'Supabase + Stripe', 'Closed Testing Build']
    cx = tx
    cy = 290
    for chip in chips:
        tw = draw.textbbox((0, 0), chip, font=chip_font)[2]
        chip_w = tw + 34
        draw.rounded_rectangle((cx, cy, cx + chip_w, cy + 44), radius=18, fill=(7, 44, 72), outline=(120, 174, 201), width=2)
        draw.text((cx + 17, cy + 10), chip, font=chip_font, fill=(222, 238, 249))
        cx += chip_w + 14

    out = OUT_DIR / 'feature-graphic' / 'feature-graphic-1024x500.png'
    img.save(out, format='PNG', optimize=True)
    return out


def render_screenshot(size: tuple[int, int], spec: ScreenSpec, screen_index: int) -> Image.Image:
    w, h = size
    image = gradient_background(w, h)
    draw = ImageDraw.Draw(image)

    is_landscape = w > h

    title_font = load_font(int(min(w, h) * 0.053), bold=True)
    subtitle_font = load_font(int(min(w, h) * 0.027))
    section_font = load_font(int(min(w, h) * 0.032), bold=True)
    body_font = load_font(int(min(w, h) * 0.024))
    cta_font = load_font(int(min(w, h) * 0.029), bold=True)
    small_font = load_font(int(min(w, h) * 0.021), bold=False)

    margin = int(min(w, h) * 0.055)
    header_h = int(h * (0.19 if not is_landscape else 0.24))

    draw.rounded_rectangle(
        (margin, margin, w - margin, margin + header_h),
        radius=32,
        fill=(7, 38, 61),
        outline=CARD_BORDER,
        width=3,
    )

    draw.text((margin + 30, margin + 20), 'Events', font=section_font, fill=TEXT_LIGHT)
    draw.text((w - margin - 210, margin + 24), f'Screen {screen_index + 1:02d}', font=small_font, fill=ACCENT_GOLD)

    draw_wrapped_text(
        draw,
        spec.title,
        title_font,
        TEXT_LIGHT,
        margin + 30,
        margin + 65,
        max_width=w - (margin * 2) - 60,
        line_spacing=4,
        max_lines=2,
    )

    draw_wrapped_text(
        draw,
        spec.subtitle,
        subtitle_font,
        TEXT_MUTED,
        margin + 30,
        margin + header_h - 58,
        max_width=w - (margin * 2) - 60,
        line_spacing=4,
        max_lines=2,
    )

    body_top = margin + header_h + int(min(w, h) * 0.035)
    card_h = int(h * (0.14 if not is_landscape else 0.18))
    gap = int(min(w, h) * 0.024)

    for i, bullet in enumerate(spec.bullets):
        y0 = body_top + i * (card_h + gap)
        y1 = y0 + card_h
        if y1 > h - margin - 170:
            break

        fill = (8, 34, 55) if i % 2 == 0 else (10, 42, 67)
        draw.rounded_rectangle((margin, y0, w - margin, y1), radius=28, fill=fill, outline=(111, 165, 194), width=2)
        draw.ellipse((margin + 22, y0 + 26, margin + 56, y0 + 60), fill=ACCENT_GREEN)
        draw.text((margin + 34, y0 + 32), str(i + 1), font=small_font, fill=(1, 27, 42), anchor='mm')

        draw_wrapped_text(
            draw,
            bullet,
            body_font,
            TEXT_LIGHT,
            margin + 72,
            y0 + 26,
            max_width=w - (margin * 2) - 90,
            line_spacing=4,
            max_lines=3,
        )

    cta_h = int(min(w, h) * 0.12)
    cta_y0 = h - margin - cta_h
    draw.rounded_rectangle(
        (margin, cta_y0, w - margin, cta_y0 + cta_h),
        radius=30,
        fill=(45, 188, 164),
        outline=(220, 250, 241),
        width=2,
    )

    draw_wrapped_text(
        draw,
        spec.cta,
        cta_font,
        (8, 34, 52),
        margin + 26,
        cta_y0 + int(cta_h * 0.3),
        max_width=w - (margin * 2) - 52,
        line_spacing=3,
        max_lines=2,
    )

    return image


def export_screenshot_set(folder: Path, size: tuple[int, int], count: int) -> list[Path]:
    safe_mkdir(folder)
    files: list[Path] = []
    for idx, spec in enumerate(SCREENS[:count]):
        image = render_screenshot(size=size, spec=spec, screen_index=idx)
        path = folder / f'{idx + 1:02d}-{spec.slug}.png'
        image.save(path, format='PNG', optimize=True)
        files.append(path)
    return files


def write_manifest(paths: list[Path]) -> None:
    lines = ['# Generated Play Store Assets', '']
    for p in sorted(paths):
        rel = p.relative_to(ROOT).as_posix()
        lines.append(f'- `{rel}`')

    manifest = OUT_DIR / 'manifest.md'
    manifest.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def create_zip(paths: list[Path]) -> Path:
    zip_path = OUT_DIR / 'events-play-assets.zip'
    with zipfile.ZipFile(zip_path, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        for p in paths:
            arc = p.relative_to(OUT_DIR).as_posix()
            zf.write(p, arcname=arc)
    return zip_path


def main() -> None:
    safe_mkdir(OUT_DIR)

    generated: list[Path] = []
    generated.append(create_play_icon())
    generated.append(create_feature_graphic())

    generated.extend(export_screenshot_set(OUT_DIR / 'screenshots-phone', PHONE_SIZE, count=8))
    generated.extend(export_screenshot_set(OUT_DIR / 'screenshots-tablet-7', TABLET_7_SIZE, count=6))
    generated.extend(export_screenshot_set(OUT_DIR / 'screenshots-tablet-10', TABLET_10_SIZE, count=6))

    write_manifest(generated)
    zip_path = create_zip(generated)

    print('Generated assets:')
    for path in generated:
        print(f' - {path.relative_to(ROOT)}')
    print(f'Zip package: {zip_path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
