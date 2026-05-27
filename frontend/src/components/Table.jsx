import { useState, useMemo } from 'react'

// ─── Icons ────────────────────────────────────────────────────────────────────
const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

const SortIcon = ({ direction }) => (
  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '12px', height: '12px', marginLeft: '4px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    {direction === 'asc'
      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      : direction === 'desc'
        ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        : <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V8m0 0l-3 3m3-3l3 3M17 8v8m0 0l-3-3m3 3l3-3" />
    }
  </svg>
)

const EmptyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '40px', height: '40px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
)

// ─── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '0.875rem 1.25rem' }}>
          <div
            style={{
              height: '14px',
              borderRadius: '0.375rem',
              width: i === 0 ? '60%' : i % 3 === 0 ? '40%' : '75%',
              background: 'linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.6s linear infinite',
            }}
          />
        </td>
      ))}
    </tr>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - columns     {Array<{ key, label, sortable?, render?(value, row) }>}
 *  - data        {Array<object>}
 *  - loading     {boolean}
 *  - pageSize    {number}   default 10
 *  - searchable  {boolean}  default true
 *  - searchKeys  {string[]} keys to search within
 *  - emptyMessage {string}
 *  - actions     {ReactNode} — extra controls in the top-right toolbar
 *  - rowKey      {string}    unique key field, default 'id'
 */
export default function Table({
  columns      = [],
  data         = [],
  loading      = false,
  pageSize     = 10,
  searchable   = true,
  searchKeys   = [],
  emptyMessage = 'No records found.',
  actions      = null,
  rowKey       = 'id',
}) {
  const [query,     setQuery]     = useState('')
  const [page,      setPage]      = useState(1)
  const [sortKey,   setSortKey]   = useState(null)
  const [sortDir,   setSortDir]   = useState('asc')
  const [hoveredRow, setHoveredRow] = useState(null)

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query.trim()) return data
    const q = query.toLowerCase()
    const keys = searchKeys.length ? searchKeys : columns.map(c => c.key)
    return data.filter(row =>
      keys.some(k => String(row[k] ?? '').toLowerCase().includes(q))
    )
  }, [data, query, searchKeys, columns])

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = typeof av === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  // ── Paginate ────────────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageData    = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (key) => {
    if (!key) return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleSearch = (e) => {
    setQuery(e.target.value)
    setPage(1)
  }

  // ── Pagination range (max 5 pages shown) ────────────────────────────────────
  const pageRange = useMemo(() => {
    const delta = 2
    const range = []
    for (
      let i = Math.max(1, currentPage - delta);
      i <= Math.min(totalPages, currentPage + delta);
      i++
    ) range.push(i)
    return range
  }, [currentPage, totalPages])

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >

      {/* ── Toolbar ── */}
      {(searchable || actions) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid #e2e8f0',
            flexWrap: 'wrap',
          }}
        >
          {/* Search */}
          {searchable && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <span
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                  display: 'flex',
                }}
              >
                <SearchIcon />
              </span>
              <input
                id="table-search"
                type="search"
                placeholder="Search…"
                value={query}
                onChange={handleSearch}
                style={{
                  paddingLeft: '2.25rem',
                  paddingRight: '0.875rem',
                  paddingBlock: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.5rem',
                  outline: 'none',
                  color: '#0f172a',
                  background: '#f8fafc',
                  width: '220px',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#1e3a5f'
                  e.target.style.boxShadow   = '0 0 0 3px rgba(30,58,95,0.12)'
                  e.target.style.background  = '#ffffff'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.boxShadow   = 'none'
                  e.target.style.background  = '#f8fafc'
                }}
              />
            </div>
          )}

          {/* Result count + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            {!loading && (
              <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* ── Table wrapper (horizontal scroll) ── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.875rem',
          }}
        >
          {/* ── Head ── */}
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    textAlign: col.align ?? 'left',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    borderBottom: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    position: 'sticky',
                    top: 0,
                    background: '#f8fafc',
                    zIndex: 1,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {col.label}
                    {col.sortable && (
                      <SortIcon direction={sortKey === col.key ? sortDir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ── */}
          <tbody>
            {loading
              ? Array.from({ length: pageSize > 5 ? 5 : pageSize }).map((_, i) => (
                  <SkeletonRow key={i} cols={columns.length} />
                ))
              : pageData.length === 0
                ? (
                  <tr>
                    <td
                      colSpan={columns.length}
                      style={{
                        padding: '3.5rem 1.25rem',
                        textAlign: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ color: '#cbd5e1' }}><EmptyIcon /></span>
                        <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                          {emptyMessage}
                        </p>
                      </div>
                    </td>
                  </tr>
                )
                : pageData.map((row, idx) => (
                  <tr
                    key={row[rowKey] ?? idx}
                    onMouseEnter={() => setHoveredRow(idx)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: hoveredRow === idx
                        ? '#f1f5f9'
                        : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      transition: 'background 150ms',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={{
                          padding: '0.875rem 1.25rem',
                          color: col.muted ? '#64748b' : '#0f172a',
                          textAlign: col.align ?? 'left',
                          whiteSpace: col.wrap ? 'normal' : 'nowrap',
                          maxWidth: col.maxWidth ?? 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {col.render
                          ? col.render(row[col.key], row)
                          : row[col.key] ?? '—'
                        }
                      </td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.875rem 1.25rem',
            borderTop: '1px solid #e2e8f0',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Range label */}
          <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
            Showing{' '}
            <strong style={{ color: '#0f172a' }}>
              {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sorted.length)}
            </strong>
            {' '}of{' '}
            <strong style={{ color: '#0f172a' }}>{sorted.length}</strong>
          </span>

          {/* Page buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {/* Prev */}
            <PaginationBtn
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </PaginationBtn>

            {/* First page + ellipsis */}
            {pageRange[0] > 1 && (
              <>
                <PaginationBtn onClick={() => setPage(1)} active={currentPage === 1}>1</PaginationBtn>
                {pageRange[0] > 2 && <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.875rem' }}>…</span>}
              </>
            )}

            {/* Page range */}
            {pageRange.map(p => (
              <PaginationBtn key={p} onClick={() => setPage(p)} active={p === currentPage}>
                {p}
              </PaginationBtn>
            ))}

            {/* Last page + ellipsis */}
            {pageRange[pageRange.length - 1] < totalPages && (
              <>
                {pageRange[pageRange.length - 1] < totalPages - 1 && (
                  <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.875rem' }}>…</span>
                )}
                <PaginationBtn onClick={() => setPage(totalPages)} active={currentPage === totalPages}>
                  {totalPages}
                </PaginationBtn>
              </>
            )}

            {/* Next */}
            <PaginationBtn
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </PaginationBtn>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pagination button ────────────────────────────────────────────────────────
function PaginationBtn({ children, onClick, disabled, active, ...rest }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        minWidth: '32px',
        height: '32px',
        paddingInline: '0.375rem',
        borderRadius: '0.375rem',
        border: active ? '1px solid #1e3a5f' : '1px solid #e2e8f0',
        background: active
          ? '#1e3a5f'
          : hovered && !disabled ? '#f1f5f9' : '#ffffff',
        color: active ? '#ffffff' : disabled ? '#cbd5e1' : '#0f172a',
        fontSize: '0.8125rem',
        fontWeight: active ? '600' : '400',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 150ms, border-color 150ms',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  )
}
