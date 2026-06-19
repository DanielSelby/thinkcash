export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse p-4 sm:p-6 max-w-7xl">
      <div className="h-7 bg-muted rounded-lg w-40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <div className="h-20 sm:h-24 bg-muted rounded-xl" />
        <div className="h-20 sm:h-24 bg-muted rounded-xl" />
        <div className="h-20 sm:h-24 bg-muted rounded-xl" />
        <div className="h-20 sm:h-24 bg-muted rounded-xl" />
      </div>
      <div className="h-52 bg-muted rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="h-52 bg-muted rounded-xl" />
        <div className="h-52 bg-muted rounded-xl" />
      </div>
      <div className="h-48 bg-muted rounded-xl" />
    </div>
  )
}
