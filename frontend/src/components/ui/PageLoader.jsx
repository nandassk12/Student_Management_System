/**
 * PageLoader — full-screen spinner shown during Suspense lazy-load
 * and any explicit loading states across the app.
 */
export default function PageLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-main-bg z-40">
      {/* Spinner */}
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-card-border" />
        <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
      </div>
      {/* Label */}
      <p className="mt-4 text-sm font-medium text-text-muted tracking-wide">
        Loading…
      </p>
    </div>
  )
}
