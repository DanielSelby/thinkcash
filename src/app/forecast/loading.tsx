export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Spinning ring */}
      <div className="relative w-16 h-16">
        <div
          className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
          style={{
            borderTopColor: '#004d2e',
            borderRightColor: '#004d2e33',
            animationDuration: '0.8s',
          }}
        />
        <div
          className="absolute inset-2 rounded-full border-4 border-transparent animate-spin"
          style={{
            borderTopColor: '#16a34a',
            borderRightColor: '#16a34a33',
            animationDuration: '1.2s',
            animationDirection: 'reverse',
          }}
        />
      </div>

      {/* Pulsing logo text */}
      <div className="flex flex-col items-center gap-1 animate-pulse">
        <p className="font-bold text-base tracking-wide" style={{ color: '#004d2e' }}>
          Think-Shika PA
        </p>
        <p className="text-xs text-muted-foreground">Loading your finances…</p>
      </div>

      {/* Animated dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: '#16a34a',
              animation: 'bounce 1.2s infinite',
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>
    </div>
  )
}
