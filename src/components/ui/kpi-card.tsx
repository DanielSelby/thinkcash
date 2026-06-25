'use client'

import { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

// ── KPI Card — flips to a detail panel on hover (desktop) / tap to expand
// (mobile). Detail is intentionally minimal: trend vs last period, the top
// contributing source, and a sparkline — not every field a caller could
// theoretically supply. Cards with no rich data fall back to a freeform
// `tooltip` string instead of an empty back panel. ──────────────────────
//
// `variant="solid"` gives the front face a bold filled background instead
// of the default white card — meant for ONE featured card per row (e.g.
// the primary-currency Total Income card), not every card, mirroring
// dashboard patterns where the first/headline metric is visually distinct
// from its siblings.
export function KPICard({ label, value, sub, colorClass, icon: Icon, tooltip, prevValue, prevLabel, txnCount, avgValue, topSource, sparkData, accentColor, variant = 'default' }: {
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
  const [isFlipped, setIsFlipped]   = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
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
  // Only the fields actually rendered below count toward "has real detail" —
  // txnCount/avgValue are still accepted (existing callers pass them) but no
  // longer shown, so they shouldn't make an otherwise-empty panel look full.
  const hasStructuredDetail = !!(prevValue || topSource || sparkData?.length)
  const sparkChartData = sparkData?.map((v, i) => ({ i, v })) ?? []

  const Sparkline = () => (
    sparkData && sparkData.length > 1 ? (
      <div className="mt-auto pt-1" style={{ height: 36 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkChartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Area type="monotone" dataKey="v" stroke={accent} strokeWidth={2}
              fill={accent + '22'} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    ) : null
  )

  // Shared change badge used on both the front face and the back/expanded panel.
  const ChangeBadge = ({ onSolidFront = false }: { onSolidFront?: boolean }) => pct === null ? null : (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
      onSolidFront ? 'bg-white/20 text-white' : isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {isUp ? '↑' : '↓'}{Math.abs(parseFloat(pct))}%
    </span>
  )

  const backContent = (
    <div className="flex flex-col gap-1.5 h-full">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label} — detail</p>
      {hasStructuredDetail ? (
        <>
          {(prevValue || pct !== null) && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">{prevLabel || 'Last period'}</span>
              <span className="flex items-center gap-1.5">
                {prevValue && <span className="font-medium">{prevValue}</span>}
                <ChangeBadge />
              </span>
            </div>
          )}
          {topSource && (
            <div className="flex justify-between items-start text-xs gap-2">
              <span className="text-muted-foreground flex-shrink-0">Top</span>
              <span className="font-medium text-right leading-tight" style={{ fontSize: 11 }}>{topSource}</span>
            </div>
          )}
          <Sparkline />
        </>
      ) : tooltip ? (
        <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{tooltip}</p>
      ) : (
        <p className="text-xs text-muted-foreground">No additional detail</p>
      )}
    </div>
  )

  return (
    <div className="group relative" style={{ perspective: 1000 }}>
      {/* Desktop flip card */}
      <div
        className="hidden sm:block relative"
        style={{ transformStyle: 'preserve-3d', transition: 'transform 0.55s cubic-bezier(.4,.2,.2,1)', transform: isFlipped ? 'rotateY(180deg)' : 'none', minHeight: 148 }}
        onMouseEnter={() => setIsFlipped(true)}
        onMouseLeave={() => setIsFlipped(false)}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-2xl overflow-hidden flex flex-col justify-between p-4 ${
            solid ? 'shadow-md' : 'border border-border bg-white shadow-sm'
          }`}
          style={{
            backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            ...(solid ? { background: accent } : {}),
          }}
        >
          {!solid && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />}
          <div className="flex justify-between items-start gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider leading-tight ${solid ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${solid ? 'bg-white/20' : ''}`}
              style={solid ? {} : { background: accent + '18' }}>
              <Icon className="w-4 h-4" style={{ color: solid ? '#fff' : accent }} />
            </div>
          </div>
          <div>
            <p className={`text-xl sm:text-2xl font-semibold tabular-nums leading-tight mt-2 ${solid ? 'text-white' : ''}`}>{value}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {sub && <span className={`text-xs ${solid ? 'text-white/70' : 'text-muted-foreground'}`}>{sub}</span>}
              <ChangeBadge onSolidFront={solid} />
            </div>
          </div>
          {(hasStructuredDetail || tooltip) && (
            <p className={`text-[10px] mt-1 ${solid ? 'text-white/50' : 'text-muted-foreground/50'}`}>Hover for details</p>
          )}
        </div>

        {/* Back — stays on a light surface regardless of front variant, for readability */}
        <div
          className="absolute inset-0 rounded-2xl border border-border bg-white shadow-md overflow-hidden p-4"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
          {backContent}
        </div>
      </div>

      {/* Mobile expandable card */}
      <div className={`sm:hidden relative rounded-2xl overflow-hidden ${solid ? 'shadow-md' : 'border border-border bg-white shadow-sm'}`}
        style={solid ? { background: accent } : {}}>
        {!solid && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />}
        <button
          className="w-full p-4 text-left"
          onClick={() => setIsExpanded(v => !v)}
          aria-expanded={isExpanded}
        >
          <div className="flex justify-between items-start gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${solid ? 'text-white/80' : 'text-muted-foreground'}`}>{label}</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${solid ? 'bg-white/20' : ''}`}
                style={solid ? {} : { background: accent + '18' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: solid ? '#fff' : accent }} />
              </div>
              <span className={solid ? 'text-white/70 text-sm' : 'text-muted-foreground text-sm'}
                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .3s' }}>⌄</span>
            </div>
          </div>
          <p className={`text-xl font-semibold tabular-nums mt-2 leading-tight ${solid ? 'text-white' : ''}`}>{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {sub && <span className={`text-xs ${solid ? 'text-white/70' : 'text-muted-foreground'}`}>{sub}</span>}
            <ChangeBadge onSolidFront={solid} />
          </div>
        </button>

        {/* Expandable detail — always a light surface, even on a solid-front card */}
        <div
          className={solid ? 'bg-white' : ''}
          style={{ maxHeight: isExpanded ? 200 : 0, overflow: 'hidden', transition: 'max-height .4s ease' }}
          aria-hidden={!isExpanded}
        >
          <div className="px-4 pb-4 border-t border-border pt-3">
            {hasStructuredDetail ? (
              <>
                {(prevValue || pct !== null) && (
                  <div className="flex justify-between items-center text-xs py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">{prevLabel || 'Last period'}</span>
                    <span className="flex items-center gap-1.5">
                      {prevValue && <span className="font-medium">{prevValue}</span>}
                      <ChangeBadge />
                    </span>
                  </div>
                )}
                {topSource && (
                  <div className="flex justify-between items-start text-xs py-1.5 gap-2">
                    <span className="text-muted-foreground flex-shrink-0">Top</span>
                    <span className="font-medium text-right" style={{ fontSize: 11 }}>{topSource}</span>
                  </div>
                )}
                <Sparkline />
              </>
            ) : tooltip ? (
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed py-1.5">{tooltip}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}