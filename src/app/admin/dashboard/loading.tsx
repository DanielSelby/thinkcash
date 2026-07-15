'use client'

import { useEffect, useState } from 'react'

export default function Loading() {
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)

  const messages = [
    'Initialising...',
    'Loading accounts...',
    'Crunching numbers...',
    'Almost ready...',
    'Finalising...',
  ]

  useEffect(() => {
    const iv = setInterval(() => {
      setProgress(p => {
        const next = Math.min(p + Math.random() * 14, 99)
        setMsgIndex(Math.min(Math.floor((next / 100) * messages.length), messages.length - 1))
        return next
      })
    }, 220)
    return () => clearInterval(iv)
  }, [])

  const features = [
    {
      title: 'Track', sub: 'Expenses',
      svg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3"  y="14" width="3.5" height="7"  rx="1" fill="#c9a84c" opacity=".8"/>
          <rect x="10" y="10" width="3.5" height="11" rx="1" fill="#1e3a6e" opacity=".85"/>
          <rect x="17" y="5"  width="3.5" height="16" rx="1" fill="#c9a84c"/>
          <path d="M4 9l3.5-3.5 4 3 4.5-5.5" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M15 3h4v4"                 stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      title: 'Plan', sub: 'Your Goals',
      svg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.5" stroke="#1e3a6e" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="5.5" stroke="#c9a84c" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="2"   fill="#1e3a6e"/>
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      title: 'Grow', sub: 'Wealth',
      svg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M3 17l4-4 4 4 5-6 4 3" stroke="#1e3a6e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M3 21h18"              stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="19" cy="6" r="3" fill="#c9a84c" fillOpacity=".2" stroke="#c9a84c" strokeWidth="1.5"/>
          <path d="M19 4.5v3M17.5 6h3"  stroke="#c9a84c" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      title: 'Secure', sub: 'Future',
      svg: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 5.5v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11v-5L12 2z"
            fill="#1e3a6e" fillOpacity=".1" stroke="#1e3a6e" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M9 12l2.5 2.5L15 9" stroke="#c9a84c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#f8f6f0',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* Background blobs */}
      <div style={{ position: 'absolute', top: -40, right: -60, width: 220, height: 220, borderRadius: '50%', background: '#eef0f5', opacity: .5 }} />
      <div style={{ position: 'absolute', bottom: -60, left: -40, width: 280, height: 280, borderRadius: '50%', background: '#eef0f5', opacity: .4 }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>

        {/* Spinner ring with logo inside */}
        <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 1.5rem' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2.5px solid #e0e4ed' }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2.5px solid transparent',
            borderTopColor: '#1e3a6e',
            borderRightColor: '#c9a84c',
            animation: 'spin 1.2s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            border: '1.5px solid #e0e4ed',
            borderTopColor: '#c9a84c',
            animation: 'spin 1.8s linear infinite reverse',
          }} />
          <div style={{
            position: 'absolute', inset: 14,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(30,58,110,0.12)',
          }}>
            <img
              src="/icon.png"
              alt="Think-Shika PA"
              style={{ width: '85%', height: '85%', objectFit: 'contain' }}
            />
          </div>
        </div>

        {/* Name */}
        <h1 style={{ margin: '0 0 .2rem', fontSize: '1.8rem', fontWeight: 800 }}>
          <span style={{ color: '#1e3a6e' }}>Think-</span>
          <span style={{ color: '#c9a84c' }}>Shika</span>
          <span style={{ color: '#1e3a6e' }}> PA</span>
        </h1>
        <p style={{ margin: '0 0 1.75rem', fontSize: '0.78rem', color: '#7a8299', letterSpacing: '0.06em' }}>
          Your Personal Finance Manager
        </p>

        {/* Progress bar */}
        <div style={{ width: 260, margin: '0 auto 0.5rem' }}>
          <div style={{ height: 4, background: '#e0e4ed', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(to right, #1e3a6e, #c9a84c)',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 12, color: '#7a8299' }}>{messages[msgIndex]}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#c9a84c' }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '1.5rem 0 2rem' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i === 1 ? '#c9a84c' : '#1e3a6e',
              animation: 'pulse 1.2s ease infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>

        {/* Feature row — SVG icons */}
        <div style={{
          display: 'flex',
          border: '1px solid #e0e4ed',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#fff',
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              flex: 1, padding: '12px 6px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid #e0e4ed' : 'none',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(30,58,110,0.06)',
                border: '1px solid rgba(30,58,110,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px',
              }}>
                {f.svg}
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e3a6e' }}>{f.title}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#7a8299' }}>{f.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  )
}
