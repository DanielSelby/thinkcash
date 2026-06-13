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
}

export type ThemeKey = keyof typeof THEMES

export const APP_CONFIG = {
  // ── App Identity ──────────────────────────────────────────
  name: 'Think-Shika PA',
  shortName: 'TS',
  tagline: 'Think Wise. Plan Smart. Build Wealth.',
  description: 'Track income, expenses, budgets, and savings goals — built for Ghana and beyond.',
  supportEmail: 'thinkdataprojects@gmail.com',

  // ── Currency ──────────────────────────────────────────────
  currency: 'GHS',
  currencySymbol: 'GH₵',
  currencyLocale: 'en-GH',

  // ── Default theme ─────────────────────────────────────────
  defaultTheme: 'navy' as ThemeKey,
}