"""Generate the CoachLink PrimeReact themes from the stock Lara amber themes.

    python scripts/ui/build-coachlink-prime-themes.py

Writes public/themes/coachlink-light and public/themes/coachlink-dark (theme.css + fonts).
The Lara amber themes are left untouched. What changes:
- amber primary -> CoachLink clay (#B4553A fills / links in light, #E08A6C in dark);
- selection highlight -> warm neutral with ink text (v1: clay = action, ink = chosen);
- Tailwind blue-greys -> the warm greys used by the mini-program v1 tokens;
- page ground -> paper (#F5F2ED light, #161412 dark).
Status colours (green / red / blue / purple / orange) are kept.
Rerun after replacing the Lara themes; edit the maps below to retune.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'public' / 'themes'

LIGHT = {
    # primary (amber -> clay)
    '#f49227': '#B4553A', '#cc8925': '#9A4630', '#d97706': '#94432E', '#facf85': '#E3A88F',
    # focus ring and selection highlight
    '#fef08a': '#F2C9B9', '#fffbeb': '#EFEAE2', '#b45309': '#1D1A16',
    # cool greys -> warm greys
    '#111827': '#1D1A16', '#1f2937': '#1D1A16', '#374151': '#3D372F', '#4b5563': '#4A433B',
    '#6b7280': '#5F574D', '#9ca3af': '#8A8174', '#d1d5db': '#D9D0C4', '#e5e7eb': '#E6DFD5',
    '#f3f4f6': '#EFEAE2', '#f9fafb': '#F7F4EF', '#dfe7ef': '#E6DFD5', '#f6f9fc': '#F7F4EF',
    '#64748b': '#5F574D', '#475569': '#4A433B', '#334155': '#3D372F',
    '#f8f8fa': '#F7F4EF', '#f8f9fa': '#F7F4EF', '#f2f2f2': '#EFEAE2',
}
LIGHT_VARS = {
    '--primary-color': '#B4553A',
    '--surface-ground': '#F5F2ED',
    '--surface-section': '#FFFFFF',
    '--surface-card': '#FFFFFF',
    '--surface-overlay': '#FFFFFF',
    '--text-color': '#3D372F',
    '--text-color-secondary': '#5F574D',
    '--highlight-bg': '#EFEAE2',
    '--highlight-text-color': '#1D1A16',
    # 500 equals --primary-color, as in stock Lara: pages use bg-primary-500 as the button fill.
    '--primary-50': '#FBF1ED', '--primary-100': '#F7E6DE', '--primary-200': '#EECBBC',
    '--primary-300': '#E3A88F', '--primary-400': '#CF6D4E', '--primary-500': '#B4553A',
    '--primary-600': '#9A4630', '--primary-700': '#803A28', '--primary-800': '#632D1F',
    '--primary-900': '#452017',
}

DARK = {
    '#f49227': '#E08A6C', '#fde68a': '#F2C9B9', '#fcd34d': '#E8A189', '#fde047': '#E8A189',
    '#111827': '#161412', '#1f2937': '#211E1B', '#374151': '#2E2A26', '#424b57': '#3A342E',
    '#1c2127': '#1A1715', '#4b5563': '#4A433B', '#6b7280': '#8A8174', '#9ca3af': '#A39A8E',
    '#94a3b8': '#A39A8E',
}
DARK_VARS = {
    '--primary-color': '#E08A6C',
    '--surface-ground': '#161412',
    '--surface-section': '#161412',
    '--surface-card': '#211E1B',
    '--surface-overlay': '#211E1B',
    '--highlight-bg': 'rgba(224, 138, 108, 0.16)',
    '--focus-ring': '0 0 0 0.2rem rgba(224, 138, 108, 0.24)',
    '--primary-50': '#52251A', '--primary-100': '#733424', '--primary-200': '#94432E',
    '--primary-300': '#B4553A', '--primary-400': '#CF6D4E', '--primary-500': '#E08A6C',
    '--primary-600': '#E8A189', '--primary-700': '#EECBBC', '--primary-800': '#F7E6DE',
    '--primary-900': '#FBF1ED',
}


def build(src_name: str, dst_name: str, colours: dict, variables: dict) -> None:
    src = ROOT / src_name
    dst = ROOT / dst_name
    dst.mkdir(exist_ok=True)
    css = (src / 'theme.css').read_text(encoding='utf8')
    # Reuse the stock theme's font files instead of copying them.
    css = css.replace('url("./fonts/', f'url("../{src_name}/fonts/')
    for name, value in variables.items():
        css, n = re.subn(rf'({re.escape(name)}\s*:\s*)[^;]+;', rf'\g<1>{value};', css)
        if n == 0:
            raise SystemExit(f'{src_name}: variable {name} not found')
    for old, new in colours.items():
        css = re.sub(rf'{re.escape(old)}\b', new, css, flags=re.IGNORECASE)
    header = f'/* CoachLink theme generated from {src_name} by scripts/ui/build-coachlink-prime-themes.py. Do not edit by hand. */\n'
    (dst / 'theme.css').write_text(header + css, encoding='utf8')
    left = sorted(set(m.lower() for m in re.findall(r'#f49227|#fef08a|#fffbeb|#b45309', css, flags=re.I)))
    print(f'{dst_name}: written, amber left: {left or "none"}')


build('lara-light-amber', 'coachlink-light', LIGHT, LIGHT_VARS)
build('lara-dark-amber', 'coachlink-dark', DARK, DARK_VARS)
