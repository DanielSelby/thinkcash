// ============================================================
// THINK-SHIKA PA — Central Config File
// ✅ Change ONLY this file to update branding, colors, settings
// ============================================================

export const THEMES = {
  // Theme 1 — Dark Green (UCT Style)
  green: {
    name: 'Forest Green',
    colors: {
      primary:        '#004b23',
      primaryMid:     '#005c2b',
      primaryLight:   '#006e34',
      primaryPale:    '#e8f5ee',
      accent:         '#ff6700',
      accentLight:    'rgba(255,102,0,0.15)',
      background:     '#F2F7F4',
      surface:        '#FFFFFF',
      text:           '#002A14',
      textMuted:      '#3A6B4E',
      success:        '#0A7A45',
      danger:         '#C0392B',
      warning:        '#C87A0A',
      info:           '#1565C0',
    },
    sidebar: {
      background:       '#004b23',
      text:             '#FFFFFF',
      textMuted:        'rgba(255,255,255,0.6)',
      activeBackground: 'rgba(255,102,0,0.18)',
      activeText:       '#ff6700',
      borderColor:      'rgba(255,255,255,0.12)',
      hoverBackground:  'rgba(255,255,255,0.08)',
    },
    topbar: { background: '#004b23', text: '#FFFFFF' },
  },

  // Theme 2 — Navy & Gold (Think-Shika PA Brand)
  navy: {
    name: 'Navy & Gold',
    colors: {
      primary:        '#1B2A6B',
      primaryMid:     '#223380',
      primaryLight:   '#2A3D99',
      primaryPale:    '#EEF0FA',
      accent:         '#C9A84C',
      accentLight:    'rgba(201,168,76,0.15)',
      background:     '#F4F5FB',
      surface:        '#FFFFFF',
      text:           '#0D1540',
      textMuted:      '#4A5490',
      success:        '#0A7A45',
      danger:         '#C0392B',
      warning:        '#C87A0A',
      info:           '#1565C0',
    },
    sidebar: {
      background:       '#1B2A6B',
      text:             '#FFFFFF',
      textMuted:        'rgba(255,255,255,0.6)',
      activeBackground: 'rgba(201,168,76,0.20)',
      activeText:       '#C9A84C',
      borderColor:      'rgba(255,255,255,0.10)',
      hoverBackground:  'rgba(255,255,255,0.08)',
    },
    topbar: { background: '#1B2A6B', text: '#FFFFFF' },
  },

  // Theme 3 — Teal & Sand
  teal: {
    name: 'Teal & Sand',
    colors: {
      primary:        '#006d77',
      primaryMid:     '#00838f',
      primaryLight:   '#0a9396',
      primaryPale:    '#e6f5f5',
      accent:         '#dccca3',
      accentLight:    'rgba(220,204,163,0.20)',
      background:     '#F4F8F8',
      surface:        '#FFFFFF',
      text:           '#013237',
      textMuted:      '#3D6B6F',
      success:        '#0A7A45',
      danger:         '#C0392B',
      warning:        '#C87A0A',
      info:           '#1565C0',
    },
    sidebar: {
      background:       '#006d77',
      text:             '#FFFFFF',
      textMuted:        'rgba(255,255,255,0.6)',
      activeBackground: 'rgba(220,204,163,0.22)',
      activeText:       '#dccca3',
      borderColor:      'rgba(255,255,255,0.12)',
      hoverBackground:  'rgba(255,255,255,0.08)',
    },
    topbar: { background: '#006d77', text: '#FFFFFF' },
  },

  // Theme 4 — Plum & Blush
  plum: {
    name: 'Plum & Blush',
    colors: {
      primary:        '#412234',
      primaryMid:     '#522a41',
      primaryLight:   '#65334f',
      primaryPale:    '#fbf3f3',
      accent:         '#ead7d7',
      accentLight:    'rgba(234,215,215,0.25)',
      background:     '#F8F4F5',
      surface:        '#FFFFFF',
      text:           '#28141F',
      textMuted:      '#6B4A5A',
      success:        '#0A7A45',
      danger:         '#C0392B',
      warning:        '#C87A0A',
      info:           '#1565C0',
    },
    sidebar: {
      background:       '#412234',
      text:             '#FFFFFF',
      textMuted:        'rgba(255,255,255,0.6)',
      activeBackground: 'rgba(234,215,215,0.22)',
      activeText:       '#ead7d7',
      borderColor:      'rgba(255,255,255,0.12)',
      hoverBackground:  'rgba(255,255,255,0.08)',
    },
    topbar: { background: '#412234', text: '#FFFFFF' },
  },

  // Theme 5 — Eclipse (Sage & Forest Green)
  eclipse: {
    name: 'Eclipse',
    colors: {
      primary:        '#1b4332',
      primaryMid:     '#2d6a4f',
      primaryLight:   '#40916c',
      primaryPale:    '#eef5f0',
      accent:         '#95b8a0',
      accentLight:    'rgba(149,184,160,0.20)',
      background:     '#F3F6F4',
      surface:        '#FFFFFF',
      text:           '#0E2A1F',
      textMuted:      '#4A6B57',
      success:        '#0A7A45',
      danger:         '#C0392B',
      warning:        '#C87A0A',
      info:           '#1565C0',
    },
    sidebar: {
      background:       '#95b8a0',
      text:             '#0E2A1F',
      textMuted:        'rgba(14,42,31,0.6)',
      activeBackground: 'rgba(27,67,50,0.18)',
      activeText:       '#1b4332',
      borderColor:      'rgba(14,42,31,0.12)',
      hoverBackground:  'rgba(14,42,31,0.08)',
    },
    topbar: { background: '#1b4332', text: '#FFFFFF' },
  },
}

export type ThemeKey = keyof typeof THEMES

export const APP_CONFIG = {
  // ── App Identity ──────────────────────────────────────────
  name: 'Think-Shika P.A',
  shortName: 'TS',
  tagline: 'Think Wise. Plan Smart. Build Wealth.',
  description: 'Track income, expenses, budgets, and savings goals — built for Ghana and beyond.',
  supportEmail: 'thinkdataprojects@gmail.com',

  // ── Currency ──────────────────────────────────────────────
  currency: 'GHS',
  currencySymbol: 'GH₵',
  currencyLocale: 'en-GH',

  // ── Default theme ─────────────────────────────────────────
  defaultTheme: 'eclipse' as ThemeKey,
}