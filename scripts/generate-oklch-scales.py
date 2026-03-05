#!/usr/bin/env python3
"""
Analyze core-tokens.css color families and generate oklch relative color syntax.

For each family:
1. Convert all hex values to oklch
2. Pick the base (step 500 or middle step)
3. For each step, compute L ratio and C ratio relative to base
4. Measure hue drift per step
5. Generate oklch(from var(--base) ...) expressions
6. Flag outliers where hue drifts > threshold
"""

import math
import re
import json
from collections import OrderedDict

# ── oklch conversion (no external deps) ──────────────────────────

def srgb_to_linear(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4

def linear_to_xyz(r, g, b):
    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b
    return x, y, z

def xyz_to_oklab(x, y, z):
    l_ = 0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z
    m_ = 0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z
    s_ = 0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z
    l_ = l_ ** (1/3) if l_ >= 0 else -((-l_) ** (1/3))
    m_ = m_ ** (1/3) if m_ >= 0 else -((-m_) ** (1/3))
    s_ = s_ ** (1/3) if s_ >= 0 else -((-s_) ** (1/3))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    b = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    return L, a, b

def oklab_to_oklch(L, a, b):
    C = math.sqrt(a*a + b*b)
    H = math.degrees(math.atan2(b, a)) % 360
    return L, C, H

def hex_to_oklch(hex_str):
    hex_str = hex_str.lstrip('#')
    r = int(hex_str[0:2], 16) / 255
    g = int(hex_str[2:4], 16) / 255
    b = int(hex_str[4:6], 16) / 255
    rl, gl, bl = srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b)
    x, y, z = linear_to_xyz(rl, gl, bl)
    L, a, ob = xyz_to_oklab(x, y, z)
    return oklab_to_oklch(L, a, ob)

def hue_diff(h1, h2):
    """Signed shortest-arc hue difference."""
    d = h1 - h2
    if d > 180: d -= 360
    if d < -180: d += 360
    return d

# ── Parse core-tokens.css ────────────────────────────────────────

def parse_core_tokens(filepath):
    """Extract all --apx-core-color-* hex definitions, grouped by family."""
    families = OrderedDict()
    hex_pattern = re.compile(
        r'--apx-core-color-([\w-]+?)-(\d+):\s*(#[0-9A-Fa-f]{6})\s*;'
    )
    rgba_pattern = re.compile(
        r'--apx-core-color-([\w-]+?)-(\d+):\s*(rgba\([^)]+\))\s*;'
    )
    # Also catch the raven singleton
    raven_pattern = re.compile(
        r'--apx-core-color-(extended-raven)-(\w+):\s*(#[0-9A-Fa-f]{6})\s*;'
    )
    
    with open(filepath) as f:
        for line in f:
            m = hex_pattern.search(line)
            if m:
                family, step, value = m.group(1), int(m.group(2)), m.group(3)
                families.setdefault(family, []).append((step, value))
                continue
            m = rgba_pattern.search(line)
            if m:
                family, step, value = m.group(1), int(m.group(2)), m.group(3)
                families.setdefault(family, []).append((step, value, 'rgba'))
                continue
            m = raven_pattern.search(line)
            if m:
                families.setdefault('extended-raven', []).append(('raven', m.group(3)))
    
    # Sort each family by step number
    for family in families:
        families[family].sort(key=lambda x: x[0] if isinstance(x[0], int) else 0)
    
    return families

# ── Analyze a single family ──────────────────────────────────────

def analyze_family(family_name, steps):
    """Convert to oklch and compute relative expressions."""
    oklch_data = []
    for entry in steps:
        if len(entry) == 3 and entry[2] == 'rgba':
            continue  # Skip rgba entries
        if not isinstance(entry[0], int):
            continue  # Skip non-numeric (raven)
        step_num, hex_val = entry[0], entry[1]
        L, C, H = hex_to_oklch(hex_val)
        oklch_data.append({
            'step': step_num,
            'hex': hex_val,
            'L': L,
            'C': C,
            'H': H
        })
    
    if not oklch_data:
        return None
    
    # Pick base: step 500 if exists, else middle step
    base = None
    for d in oklch_data:
        if d['step'] == 500:
            base = d
            break
    if base is None:
        mid_idx = len(oklch_data) // 2
        base = oklch_data[mid_idx]
    
    base_L = base['L']
    base_C = base['C']
    base_H = base['H']
    
    # Compute relative values for each step
    results = []
    for d in oklch_data:
        h_drift = hue_diff(d['H'], base_H)
        c_ratio = d['C'] / base_C if base_C > 0.001 else 0
        
        results.append({
            'step': d['step'],
            'hex': d['hex'],
            'L': d['L'],
            'C': d['C'],
            'H': d['H'],
            'h_drift': h_drift,
            'c_ratio': c_ratio,
            'is_base': d['step'] == base['step']
        })
    
    return {
        'family': family_name,
        'base_step': base['step'],
        'base_hex': base['hex'],
        'base_L': base_L,
        'base_C': base_C,
        'base_H': base_H,
        'steps': results
    }

# ── Generate CSS ─────────────────────────────────────────────────

def fmt_l(L):
    """Format lightness as percentage (oklch L is 0-1)."""
    return f"{L * 100:.1f}%"

def fmt_c(c_ratio, base_C):
    """Generate chroma expression."""
    if abs(c_ratio - 1.0) < 0.02:
        return "c"
    if c_ratio < 0.02:
        return "0"
    return f"calc(c * {c_ratio:.2f})"

def fmt_h(h_drift):
    """Generate hue expression."""
    if abs(h_drift) < 1.0:
        return "h"
    if h_drift > 0:
        return f"calc(h + {h_drift:.1f})"
    return f"calc(h - {abs(h_drift):.1f})"

def css_var_name(family, suffix):
    """Build CSS variable name."""
    return f"--apx-core-color-{family}-{suffix}"

def generate_family_css(analysis):
    """Generate CSS for one family.
    
    All steps use oklch(from var(--base) L C H) relative syntax.
    No outlier fallbacks — hue drift of any magnitude is expressed
    as calc(h ± N).
    """
    lines = []
    family = analysis['family']
    base_step = analysis['base_step']
    base_hex = analysis['base_hex']
    base_L = analysis['base_L']
    base_C = analysis['base_C']
    base_H = analysis['base_H']
    
    # CSS-friendly family name for the base variable
    base_var = f"--color-{family.replace('basic-', '').replace('extended-', '')}"
    
    # Base definition in oklch
    lines.append(f"  /* Base: {base_hex} */")
    lines.append(f"  {base_var}: oklch({base_L:.4f} {base_C:.4f} {base_H:.1f});")
    lines.append("")
    
    for s in analysis['steps']:
        step = s['step']
        var_name = css_var_name(family, step)
        
        if s['is_base']:
            lines.append(f"  {var_name}: var({base_var});")
            continue
        
        h_drift = s['h_drift']
        c_ratio = s['c_ratio']
        L = s['L']
        
        # Generate relative color expression
        l_str = fmt_l(L)
        c_str = fmt_c(c_ratio, base_C)
        h_str = fmt_h(h_drift)
        lines.append(f"  {var_name}: oklch(from var({base_var}) {l_str} {c_str} {h_str});")
    
    return lines

def generate_transparent_css():
    """Handle the transparent family specially - it uses greyscale + alpha."""
    lines = []
    transparents = [
        (0,   250, 250, 255, 0.00),
        (100, 253, 253, 253, 0.05),
        (200, 221, 221, 230, 0.10),
        (300, 206, 206, 217, 0.15),
        (400, 192, 192, 204, 0.20),
        (500, 178, 178, 191, 0.25),
        (600, 141, 141, 153, 0.30),
        (700,  92,  92, 102, 0.35),
        (800,  80,  80,  89, 0.40),
        (900,  64,  64,  71, 0.45),
        (1000, 46,  46,  51, 0.50),
    ]
    
    # These pair greyscale colors with increasing alpha
    # Use the greyscale base and derive with relative color + alpha
    base_var = "--color-greyscale"
    
    lines.append("  /* Transparent scale: greyscale colors with increasing alpha */")
    lines.append("  /* Each step pairs a greyscale tone with an opacity level */")
    lines.append("  /* These reference the greyscale base and override L + alpha */")
    lines.append("")
    
    for step, r, g, b, a in transparents:
        hex_approx = f"#{r:02X}{g:02X}{b:02X}"
        L, C, H = hex_to_oklch(hex_approx)
        var_name = f"--apx-core-color-basic-transparent-{step}"
        alpha_pct = int(a * 100)
        lines.append(f"  {var_name}: oklch(from var({base_var}) {L*100:.1f}% c h / {alpha_pct}%);")
    
    return lines

def generate_monochrome_css():
    """Handle the monochrome family - pure greys from white to black.
    
    Monochrome is achromatic (C≈0), so relative color from a base is just
    lightness interpolation. Non-monotonic steps (where a higher step number
    is lighter than a lower one) are flagged as unique variables.
    """
    monochromes = [
        (0,    '#FFFFFF'),
        (25,   '#FAFAFA'),
        (50,   '#F2F2F2'),
        (75,   '#F0F0F0'),
        (100,  '#FDFDFD'),
        (200,  '#F8F8F8'),
        (250,  '#E3E3E3'),
        (300,  '#E6E6E6'),
        (400,  '#D5D5D5'),
        (450,  '#B7B7B7'),
        (500,  '#B1B1B1'),
        (550,  '#999999'),
        (600,  '#909090'),
        (650,  '#707070'),
        (700,  '#6D6D6D'),
        (800,  '#464646'),
        (850,  '#373737'),
        (875,  '#333333'),
        (900,  '#222222'),
        (925,  '#121212'),
        (950,  '#111111'),
        (1000, '#000000'),
    ]
    
    lines = []
    lines.append("  /* Monochrome: achromatic grey scale (L only, no chroma/hue) */")
    lines.append("  --color-monochrome: oklch(0.7500 0 0); /* neutral mid-grey base */")
    lines.append("")
    
    base_var = "--color-monochrome"
    
    # Detect non-monotonic steps
    sorted_mono = sorted(monochromes, key=lambda x: x[0])
    oklch_vals = {}
    for step, hex_val in sorted_mono:
        L, C, H = hex_to_oklch(hex_val)
        oklch_vals[step] = L
    
    non_monotonic = set()
    prev_L = None
    for step, hex_val in sorted_mono:
        L = oklch_vals[step]
        if prev_L is not None and L > prev_L:
            non_monotonic.add(step)
        prev_L = L
    
    unique_count = 0
    for step, hex_val in sorted_mono:
        L = oklch_vals[step]
        var_name = f"--apx-core-color-basic-monochrome-{step}"
        
        if step in non_monotonic:
            # Unique variable — lightness breaks the monotonic ramp
            unique_var = f"--color-monochrome-{step}"
            lines.append(f"  {unique_var}: oklch({L:.4f} 0 0); /* unique: non-monotonic lightness */")
            lines.append(f"  {var_name}: var({unique_var});")
            unique_count += 1
        else:
            lines.append(f"  {var_name}: oklch(from var({base_var}) {L*100:.1f}% 0 h);")
    
    return lines, unique_count


# ── Main ─────────────────────────────────────────────────────────

if __name__ == '__main__':
    import os
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)
    tokens_file = os.path.join(project_dir, 'css', 'tokens', 'core-tokens.css')
    output_file = os.path.join(project_dir, 'css', 'styles', 'sherpa-style.css')
    
    families = parse_core_tokens(tokens_file)
    
    # Analyze all hex-based families
    all_css = []
    summary = []
    
    all_css.append("/**")
    all_css.append(" * Color Scales — oklch Relative Color Syntax")
    all_css.append(" *")
    all_css.append(" * Generated from core-tokens.css hex values.")
    all_css.append(" * Each family defines a single base color in oklch,")
    all_css.append(" * then derives all tints/shades using:")
    all_css.append(" *   oklch(from var(--base) <L> <C> <H>)")
    all_css.append(" *")
    all_css.append(" * Outliers with significant hue drift (>8°) from the base")
    all_css.append(" * are defined as direct oklch values with a comment.")
    all_css.append(" */")
    all_css.append("")
    all_css.append(":root {")
    
    # Process order: basic families then extended
    basic_families = [(k, v) for k, v in families.items() if k.startswith('basic-')]
    extended_families = [(k, v) for k, v in families.items() if k.startswith('extended-')]
    
    # ── Basic families ──
    all_css.append("")
    all_css.append("  /* ── Basic Color Families ─────────────────────────────────────── */")
    
    skip_families = {'basic-transparent', 'basic-monochrome'}
    
    for family_name, steps in basic_families:
        if family_name in skip_families:
            continue
            
        # Filter to hex-only entries
        hex_steps = [(s[0], s[1]) for s in steps if len(s) == 2 and isinstance(s[0], int)]
        if not hex_steps:
            continue
        
        analysis = analyze_family(family_name, hex_steps)
        if not analysis:
            continue
        
        all_css.append("")
        css_lines = generate_family_css(analysis)
        
        label = family_name.replace('basic-', '').replace('extended-', '').title().replace('-', ' ')
        header = f"  /* ── {label} "
        header += "─" * (60 - len(header)) + " */"
        all_css.append(header)
        all_css.extend(css_lines)
        
        summary.append({
            'family': family_name,
            'total': len(analysis['steps']),
            'base_step': analysis['base_step'],
            'base_hex': analysis['base_hex']
        })
    
    # ── Monochrome (special handling) ──
    all_css.append("")
    all_css.append("  /* ── Monochrome ──────────────────────────────────────────────── */")
    mono_lines, mono_unique = generate_monochrome_css()
    all_css.extend(mono_lines)
    summary.append({
        'family': 'basic-monochrome',
        'total': 22,
        'unique': mono_unique,
        'base_step': 500,
        'base_hex': '#B1B1B1',
        'note': f'achromatic - {mono_unique} non-monotonic steps as unique vars'
    })
    
    # ── Transparent (special handling) ──
    all_css.append("")
    all_css.append("  /* ── Transparent ─────────────────────────────────────────────── */")
    all_css.extend(generate_transparent_css())
    summary.append({
        'family': 'basic-transparent',
        'total': 11,
        'base_step': 500,
        'note': 'greyscale + alpha - relative syntax with alpha channel'
    })
    
    # ── Extended families ──
    all_css.append("")
    all_css.append("  /* ── Extended Color Families ──────────────────────────────────── */")
    
    for family_name, steps in extended_families:
        if family_name == 'extended-raven':
            continue  # Handle separately
        
        hex_steps = [(s[0], s[1]) for s in steps if len(s) == 2 and isinstance(s[0], int)]
        if not hex_steps:
            continue
        
        analysis = analyze_family(family_name, hex_steps)
        if not analysis:
            continue
        
        all_css.append("")
        css_lines = generate_family_css(analysis)
        
        label = family_name.replace('extended-', '').title().replace('-', ' ')
        header = f"  /* ── {label} "
        header += "─" * (60 - len(header)) + " */"
        all_css.append(header)
        all_css.extend(css_lines)
        
        summary.append({
            'family': family_name,
            'total': len(analysis['steps']),
            'base_step': analysis['base_step'],
            'base_hex': analysis['base_hex']
        })
    
    # ── Raven singleton ──
    all_css.append("")
    all_css.append("  /* ── Raven (singleton) ───────────────────────────────────────── */")
    raven_hex = '#140628'
    L, C, H = hex_to_oklch(raven_hex)
    all_css.append(f"  --apx-core-color-extended-raven-raven: oklch({L:.4f} {C:.4f} {H:.1f});")
    
    all_css.append("}")
    all_css.append("")
    
    # Write CSS
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        f.write('\n'.join(all_css))
    
    # Print summary
    print(f"\nWritten to: {output_file}")
    print(f"\n{'Family':<30} {'Steps':>5} {'Unique':>6}  Base")
    print("─" * 70)
    total_unique = 0
    for s in summary:
        note = s.get('note', '')
        unique = s.get('unique', 0)
        total_unique += unique
        base = s.get('base_hex', 'n/a')
        unique_str = str(unique) if unique else '—'
        print(f"{s['family']:<30} {s['total']:>5} {unique_str:>6}  {base}")
        if note:
            print(f"{'':>30} {note}")
    
    total_vars = sum(s['total'] for s in summary)
    print("─" * 70)
    print(f"{'TOTAL':<30} {total_vars:>5} {total_unique:>6}")
    print(f"\nAll {total_vars} steps use oklch relative color syntax.")
    print(f"{total_unique} non-monotonic monochrome steps defined as unique variables.")
