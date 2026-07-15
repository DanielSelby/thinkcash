'use client'

import { useEffect, useState } from 'react'

export default function Loading() {
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)

  const messages = [
    'Building your financial clarity...',
    'Loading your accounts...',
    'Crunching your numbers...',
    'Almost there!',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 95) { clearInterval(interval); return 95 }
        return p + Math.random() * 12
      })
    }, 180)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setMsgIndex(i => (i + 1) % messages.length)
    }, 1800)
    return () => clearTimeout(t)
  }, [msgIndex])

  const dots = Array.from({ length: 28 })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f8f6f0 0%, #eef0f5 40%, #e8edf5 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background wave decorations */}
      <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', opacity: 0.18, pointerEvents: 'none' }}
        viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path fill="#1e3a6e" d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,229.3C672,235,768,213,864,192C960,171,1056,149,1152,154.7C1248,160,1344,192,1392,208L1440,224L1440,320L0,320Z" />
      </svg>
      <svg style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', opacity: 0.08, pointerEvents: 'none' }}
        viewBox="0 0 1440 320" preserveAspectRatio="none">
        <path fill="#c9a84c" d="M0,288L60,272C120,256,240,224,360,213.3C480,203,600,213,720,229.3C840,245,960,267,1080,261.3C1200,256,1320,224,1380,208L1440,192L1440,320L0,320Z" />
      </svg>

      {/* Logo */}
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <img
          src="/icon.png"
          alt="Think-Shika PA"
          style={{
            width: 110, height: 110, objectFit: 'contain',
            filter: 'drop-shadow(0 8px 24px rgba(30,58,110,0.18))',
            marginBottom: '1rem',
          }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
          <span style={{ color: '#1e3a6e' }}>Think-</span>
          <span style={{ color: '#c9a84c' }}>Shika</span>
          <span style={{ color: '#1e3a6e' }}> PA</span>
        </h1>
        <p style={{ margin: '0.4rem 0 0', color: '#7a8299', fontSize: '0.85rem', letterSpacing: '0.04em' }}>
          <span style={{ color: '#c9a84c', marginRight: 6 }}>——</span>
          Think Wise. Plan Smart. Build Wealth.
          <span style={{ color: '#c9a84c', marginLeft: 6 }}>——</span>
        </p>
      </div>

      {/* Dot ring spinner */}
      <div style={{ position: 'relative', width: 180, height: 180, margin: '1.5rem 0' }}>
        <svg width="180" height="180" style={{ position: 'absolute', inset: 0 }}>
          {dots.map((_, i) => {
            const angle  = (i / dots.length) * 2 * Math.PI - Math.PI / 2
            const cx     = 90 + 78 * Math.cos(angle)
            const cy     = 90 + 78 * Math.sin(angle)
            const filled = i / dots.length <= progress / 100
            const size   = filled ? 5.5 : 3.5
            const color  = filled
              ? i / dots.length < 0.5 ? '#1e3a6e' : '#c9a84c'
              : '#d0d5e0'
            return (
              <circle key={i} cx={cx} cy={cy} r={size} fill={color}
                style={{
                  filter: filled ? `drop-shadow(0 0 4px ${color}88)` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            )
          })}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#3a4060', letterSpacing: '0.02em' }}>
            Loading...
          </span>
          <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#c9a84c', lineHeight: 1.2 }}>
            {Math.min(Math.round(progress), 99)}%
          </span>
          <div style={{
            width: 28, height: 2, borderRadius: 2,
            background: 'linear-gradient(to right, #1e3a6e, #c9a84c)',
            marginTop: 4,
          }} />
        </div>
      </div>

      {/* Sun icon + status message */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem', minHeight: 64 }}>
        {/* Sun SVG matching the design */}
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none"
          style={{ margin: '0 auto 0.5rem', display: 'block' }}>
          <circle cx="18" cy="18" r="7" fill="#c9a84c" opacity="0.9"/>
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const r = deg * Math.PI / 180
            const x1 = 18 + 10 * Math.cos(r), y1 = 18 + 10 * Math.sin(r)
            const x2 = 18 + 15 * Math.cos(r), y2 = 18 + 15 * Math.sin(r)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
          })}
        </svg>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#3a4060' }}>
          {messages[msgIndex]}
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: '#c9a84c', fontWeight: 600 }}>
          Almost there!
        </p>
      </div>

      {/* Feature icons — matching the original image exactly */}
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          {
            title: 'Track', sub: 'Every Expense',
            svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="#1e3a6e" strokeWidth="1.5"/>
                <path d="M12 6v6l4 2" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 12h2M12 8v2" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M6 16l2-2 2 2 3-3 3 3" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
          },
          {
            title: 'Plan', sub: 'Your Goals',
            svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#1e3a6e" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="6"  stroke="#c9a84c" strokeWidth="1.5"/>
                <circle cx="12" cy="12" r="2"  fill="#1e3a6e"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M15 9l1.5-1.5" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ),
          },
          {
            title: 'Grow', sub: 'Your Wealth',
            svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <rect x="3"  y="14" width="4" height="7" rx="1" fill="#c9a84c" opacity="0.7"/>
                <rect x="10" y="10" width="4" height="11" rx="1" fill="#1e3a6e" opacity="0.8"/>
                <rect x="17" y="5"  width="4" height="16" rx="1" fill="#c9a84c"/>
                <path d="M4 10l4-4 5 3 5-6" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 4h4v4" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
          },
          {
            title: 'Secure', sub: 'Your Future',
            svg: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
                  stroke="#1e3a6e" strokeWidth="1.5" fill="#c9a84c" fillOpacity="0.15"/>
                <path d="M9 12l2 2 4-4" stroke="#1e3a6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ),
          },
        ].map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && (
              <div style={{ width: 1, height: 44, background: '#d0d5e0', margin: '0 0.75rem' }} />
            )}
            <div style={{ textAlign: 'center', minWidth: 68 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.8)',
                border: '1.5px solid rgba(30,58,110,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.4rem',
                boxShadow: '0 2px 10px rgba(30,58,110,0.10)',
              }}>
                {f.svg}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#1e3a6e' }}>{f.title}</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#7a8299' }}>{f.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
