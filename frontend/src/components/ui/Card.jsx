export default function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-lg p-6 shadow-lg border border-gray-200 ${className}`}>
      {children}
    </div>
  );
}
