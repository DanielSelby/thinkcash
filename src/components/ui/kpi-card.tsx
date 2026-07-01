'use client'

import { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

export function KPICard({
  label, value, sub, colorClass, icon: Icon, tooltip,
  prevValue, prevLabel, txnCount, avgValue, topSource,
  sparkData, accentColor, variant = 'default',
}: {
  label: string
  value: string
  sub?: string
  colorClass: string
  icon: any
  tooltip?: string
  prevValue?: string
  prevLabel?: string
  txnCount?: string
  avgValue?: string
  topSource?: string
  sparkData?: number[]
  accentColor?: string
  variant?: 'default' | 'solid'
}) {
  const [flipped, setFlipped] = useState(false)
  const { activeTheme } = useAppStore()
  const theme  = THEMES[activeTheme] ?? THEMES['green']
  const accent = accentColor || theme.colors.primary
  const solid  = variant === 'solid'

  const pct = prevValue && value ? (() => {
    const curr = parseFloat(value.replace(/[^0-9.-]/g, ''))
    const prev = parseFloat(prevValue.replace(/[^0-9.-]/g, ''))
    if (!prev || isNaN(curr) || isNaN(prev)) return null
    return (((curr - prev) / Math.abs(prev)) * 100).toFixed(1)
  })() : null

  const isUp = pct !== null ? parseFloat(pct) >= 0 : null
  const hasDetail = !!(prevValue || topSource || sparkData?.length)
  const sparkChartData = sparkData?.map((v, i) => ({ i, v })) ?? []

  const Sparkline = () =>
    sparkData && sparkData.length > 1 ? (
      <div style={{ height: 32, marginTop: 'auto', paddingTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkChartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Area
              type="monotone" dataKey="v"
              stroke={accent} strokeWidth={1.5}
              fill={accent + '22'} dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ) : null

  const ChangeBadge = ({ onSolid = false }: { onSolid?: boolean }) =>
    pct === null ? null : (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 99,
        background: onSolid
          ? 'rgba(255,255,255,0.22)'
          : isUp ? '#dcfce7' : '#fee2e2',
        color: onSolid
          ? '#fff'
          : isUp ? '#166534' : '#991b1b',
      }}>
        {isUp ? '↑' : '↓'}{Math.abs(parseFloat(pct))}%
      </span>
    )

  const frontFace = (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: 12,
      border: solid ? 'none' : '0.5px solid var(--color-border-tertiary)',
      background: solid ? accent : 'var(--color-background-primary)',
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      padding: 16,
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden',
    }}>
      {/* Accent bar — only on white cards */}
      {!solid && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          borderRadius: '12px 12px 0 0', background: accent,
        }} />
      )}

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.06em', lineHeight: 1.3,
          color: solid ? 'rgba(255,255,255,0.8)' : 'var(--color-text-secondary)',
        }}>
          {label}
        </span>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: solid ? 'rgba(255,255,255,0.2)' : accent + '18',
        }}>
          <Icon style={{ width: 15, height: 15, color: solid ? '#fff' : accent }} />
        </div>
      </div>

      {/* Value */}
      <div>
        <p style={{
          fontSize: value.length > 13 ? 13 : value.length > 10 ? 16 : value.length > 8 ? 18 : 21,
          fontWeight: 600, lineHeight: 1.15,
          color: solid ? '#fff' : 'var(--color-text-primary)',
          marginTop: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
          {sub && (
            <span style={{ fontSize: 11, color: solid ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)' }}>
              {sub}
            </span>
          )}
          <ChangeBadge onSolid={solid} />
        </div>
      </div>

      {(hasDetail || tooltip) && (
        <span style={{ fontSize: 10, color: solid ? 'rgba(255,255,255,0.45)' : 'var(--color-text-secondary)', opacity: 0.6 }}>
          Hover to flip ↻
        </span>
      )}
    </div>
  )

  const backFace = (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: 12,
      border: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-background-primary)',
      WebkitBackfaceVisibility: 'hidden',
      backfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)',
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 6,
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '12px 12px 0 0', background: accent }} />

      <p style={{
        fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.06em', color: 'var(--color-text-secondary)',
        marginTop: 4,
      }}>
        {label} — detail
      </p>

      {hasDetail ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
          {prevValue && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, padding: '4px 0',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
            }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{prevLabel || 'Last period'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{prevValue}</span>
                <ChangeBadge />
              </span>
            </div>
          )}
          {topSource && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              fontSize: 11, padding: '4px 0', gap: 8,
            }}>
              <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>Top</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right', fontSize: 11, lineHeight: 1.3 }}>
                {topSource}
              </span>
            </div>
          )}
          <Sparkline />
        </div>
      ) : tooltip ? (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {tooltip}
        </p>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>No additional detail</p>
      )}
    </div>
  )

  const cardInner = (flippedState: boolean, onClick?: () => void) => (
    <div
      onClick={onClick}
      style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s cubic-bezier(.4,.2,.2,1)',
        transform: flippedState ? 'rotateY(180deg)' : 'none',
        cursor: (hasDetail || tooltip) ? 'pointer' : 'default',
      }}
    >
      {frontFace}
      {backFace}
    </div>
  )

  return (
    <>
      {/* Desktop — flip on hover */}
      <div
        className="hidden sm:block"
        style={{ perspective: 900, height: 148 }}
        onMouseEnter={() => setFlipped(true)}
        onMouseLeave={() => setFlipped(false)}
      >
        {cardInner(flipped)}
      </div>

      {/* Mobile — flip on tap */}
      <div
        className="sm:hidden"
        style={{ perspective: 900, height: 148 }}
        onClick={() => setFlipped(v => !v)}
      >
        {cardInner(flipped)}
      </div>
    </>
  )
}