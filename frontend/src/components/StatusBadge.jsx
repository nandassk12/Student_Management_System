// ─── Variant definitions ──────────────────────────────────────────────────────
const VARIANTS = {
  // ── Boolean / generic ──
  active:     { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Active'     },
  inactive:   { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Inactive'   },
  pending:    { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'Pending'    },
  approved:   { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Approved'   },
  rejected:   { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Rejected'   },
  cancelled:  { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Cancelled'  },

  // ── Fees ──
  paid:       { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Paid'       },
  unpaid:     { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Unpaid'     },
  partial:    { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'Partial'    },
  overdue:    { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Overdue'    },
  waived:     { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed', label: 'Waived'     },

  // ── Attendance ──
  present:    { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Present'    },
  absent:     { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Absent'     },
  late:       { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'Late'       },
  excused:    { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed', label: 'Excused'    },

  // ── Leave ──
  'on leave': { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'On Leave'   },

  // ── Enrollment ──
  enrolled:   { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', label: 'Enrolled'   },
  completed:  { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Completed'  },
  dropped:    { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Dropped'    },
  withdrawn:  { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Withdrawn'  },

  // ── Roles ──
  admin:      { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', label: 'Admin'      },
  teacher:    { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Teacher'    },
  student:    { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'Student'    },

  // ── Generic colour aliases ──
  green:      { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Green'      },
  red:        { bg: '#fee2e2', color: '#b91c1c', dot: '#dc2626', label: 'Red'        },
  amber:      { bg: '#fef9c3', color: '#92400e', dot: '#d97706', label: 'Amber'      },
  blue:       { bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6', label: 'Blue'       },
  purple:     { bg: '#ede9fe', color: '#5b21b6', dot: '#7c3aed', label: 'Purple'     },
  grey:       { bg: '#f1f5f9', color: '#475569', dot: '#94a3b8', label: 'Grey'       },
}

// ─── Normalise incoming status string ─────────────────────────────────────────
function normalise(status) {
  return String(status ?? '').toLowerCase().trim()
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
/**
 * Props:
 *  - status    {string}   — key from VARIANTS or raw string to display
 *  - label     {string}   — override display text (defaults to variant label or status)
 *  - dot       {boolean}  — show coloured dot (default true)
 *  - size      {'sm'|'md'} — default 'md'
 *  - variant   {string}   — force a specific variant key regardless of status value
 */
export default function StatusBadge({
  status,
  label,
  dot    = true,
  size   = 'md',
  variant,
}) {
  const key     = normalise(variant ?? status)
  const config  = VARIANTS[key] ?? {
    bg:    '#f1f5f9',
    color: '#475569',
    dot:   '#94a3b8',
    label: status ?? '—',
  }

  const displayLabel = label ?? config.label

  const fontSize    = size === 'sm' ? '0.6875rem' : '0.75rem'
  const paddingV    = size === 'sm' ? '1px'        : '2px'
  const paddingH    = size === 'sm' ? '7px'        : '9px'
  const dotSize     = size === 'sm' ? '5px'        : '6px'

  return (
    <span
      role="status"
      aria-label={displayLabel}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            dot ? '5px' : 0,
        paddingBlock:   paddingV,
        paddingInline:  paddingH,
        borderRadius:   '999px',
        fontSize,
        fontWeight:     '600',
        letterSpacing:  '0.02em',
        background:     config.bg,
        color:          config.color,
        fontFamily:     "'Inter', system-ui, sans-serif",
        whiteSpace:     'nowrap',
        userSelect:     'none',
        lineHeight:     1.5,
      }}
    >
      {dot && (
        <span
          style={{
            width:        dotSize,
            height:       dotSize,
            borderRadius: '50%',
            background:   config.dot,
            flexShrink:   0,
          }}
        />
      )}
      {displayLabel}
    </span>
  )
}

// ─── Boolean helper ───────────────────────────────────────────────────────────
/**
 * Convenience wrapper for true/false → Active/Inactive
 *   <ActiveBadge active={user.is_active} />
 */
export function ActiveBadge({ active, activeLabel = 'Active', inactiveLabel = 'Inactive' }) {
  return (
    <StatusBadge
      status={active ? 'active' : 'inactive'}
      label={active ? activeLabel : inactiveLabel}
    />
  )
}

// ─── Fee status helper ────────────────────────────────────────────────────────
export function FeeBadge({ status }) {
  return <StatusBadge status={status} />
}

// ─── Attendance status helper ─────────────────────────────────────────────────
export function AttendanceBadge({ status }) {
  return <StatusBadge status={status} />
}

// ─── Role badge helper ────────────────────────────────────────────────────────
export function RoleBadge({ role }) {
  return <StatusBadge status={role} dot={false} />
}

// ─── Export variant map for external use ──────────────────────────────────────
export { VARIANTS }
