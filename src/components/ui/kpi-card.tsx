'use client'

import { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/card'
import { useAppStore } from '@/store'
import { THEMES } from '@/lib/config'

// ── KPI Card — flips to a detail panel on hover (desktop) / tap to expand
// (mobile). Detail can be either the rich structured fields below (real
// previous-period comparison, transaction volume, average, top source,
// sparkline) or — for callers that don't have that data wired up — it
// falls back to rendering a freeform `tooltip` string instead, so a
// simple usage doesn't regress to an empty back panel. ─────────────────
export function KPICard({ label, value, sub, colorClass, icon: Icon, tooltip, prevValue, prevLabel, txnCount, avgValue, topSource, sparkData, accentColor }: {
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
}) {
  const [isFlipped, setIsFlipped]   = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const { activeTheme } = useAppStore()
  const theme  = THEMES[activeTheme] ?? THEMES['green']
  const accent = accentColor || theme.colors.primary

  const pct = prevValue && value ? (() => {
    const curr = parseFloat(value.replace(/[^0-9.-]/g, ''))
    const prev = parseFloat(prevValue.replace(/[^0-9.-]/g, ''))
    if (!prev || isNaN(curr) || isNaN(prev)) return null
    return (((curr - prev) / Math.abs(prev)) * 100).toFixed(1)
  })() : null

  const isUp = pct !== null ? parseFloat(pct) >= 0 : null
  const hasStructuredDetail = !!(prevValue || txnCount || avgValue || topSource || sparkData?.length)
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

  const backContent = (
    <div className="flex flex-col gap-1.5 h-full">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label} — detail</p>
      {hasStructuredDetail ? (
        <>
          {prevValue && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">{prevLabel || 'Last period'}</span>
              <span className="font-medium">{prevValue}</span>
            </div>
          )}
          {pct !== null && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Change</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isUp ? '↑' : '↓'} {Math.abs(parseFloat(pct))}%
              </span>
            </div>
          )}
          <div className="h-px bg-border my-0.5" />
          {txnCount && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium">{txnCount}</span>
            </div>
          )}
          {avgValue && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Average</span>
              <span className="font-medium">{avgValue}</span>
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
          className="absolute inset-0 rounded-2xl border border-border bg-white shadow-sm overflow-hidden flex flex-col justify-between p-4"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
          <div className="flex justify-between items-start gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent + '18' }}>
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
          </div>
          <div>
            <p className="text-xl sm:text-2xl font-semibold tabular-nums leading-tight mt-2">{value}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
              {pct !== null && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {isUp ? '↑' : '↓'}{Math.abs(parseFloat(pct))}%
                </span>
              )}
            </div>
          </div>
          {(hasStructuredDetail || tooltip) && (
            <p className="text-[10px] text-muted-foreground/50 mt-1">Hover for details</p>
          )}
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl border border-border bg-white shadow-md overflow-hidden p-4"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
          {backContent}
        </div>
      </div>

      {/* Mobile expandable card */}
      <div className="sm:hidden relative rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl" style={{ background: accent }} />
        <button
          className="w-full p-4 text-left"
          onClick={() => setIsExpanded(v => !v)}
          aria-expanded={isExpanded}
        >
          <div className="flex justify-between items-start gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + '18' }}>
                <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
              </div>
              <span className="text-muted-foreground text-sm" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform .3s' }}>⌄</span>
            </div>
          </div>
          <p className="text-xl font-semibold tabular-nums mt-2 leading-tight">{value}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
            {pct !== null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${isUp ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isUp ? '↑' : '↓'}{Math.abs(parseFloat(pct))}%
              </span>
            )}
          </div>
        </button>

        {/* Expandable detail */}
        <div
          style={{ maxHeight: isExpanded ? 280 : 0, overflow: 'hidden', transition: 'max-height .4s ease' }}
          aria-hidden={!isExpanded}
        >
          <div className="px-4 pb-4 border-t border-border pt-3">
            {hasStructuredDetail ? (
              <>
                {prevValue && (
                  <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">{prevLabel || 'Last period'}</span>
                    <span className="font-medium">{prevValue}</span>
                  </div>
                )}
                {txnCount && (
                  <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Volume</span>
                    <span className="font-medium">{txnCount}</span>
                  </div>
                )}
                {avgValue && (
                  <div className="flex justify-between text-xs py-1.5 border-b border-border/50">
                    <span className="text-muted-foreground">Average</span>
                    <span className="font-medium">{avgValue}</span>
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