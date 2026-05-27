import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-main-bg flex flex-col items-center justify-center text-center p-6 animate-fade-up">
      <p className="text-8xl font-extrabold text-[#e2e8f0]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-text-primary">Page not found</h1>
      <p className="mt-2 text-sm text-text-muted max-w-sm">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        id="not-found-home"
        onClick={() => navigate(-1)}
        className="btn-primary mt-8"
      >
        Go back
      </button>
    </div>
  )
}
