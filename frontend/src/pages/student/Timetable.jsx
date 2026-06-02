import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import axiosInstance from '@api/axios.js'

export default function StudentTimetable() {
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // Get current weekday name
  const todayName = format(new Date(), 'EEEE') // e.g. "Wednesday"

  // ── Query: Fetch Student Timetable ──────────────────────────────────────────
  const { data: slots = [], isLoading, error } = useQuery({
    queryKey: ['studentTimetableFeed'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/timetable/me', { params: { limit: 100 } })
      return data
    }
  })

  // Helper: Format Time string (HH:MM:SS) to AM/PM (h:mm AM/PM)
  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let hours = parseInt(parts[0], 10)
    const minutes = parts[1]
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${hours}:${minutes} ${ampm}`
  }

  // Group slots by Day
  const groupedSlots = (() => {
    const grouped = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: []
    }
    slots.forEach((slot) => {
      if (grouped[slot.day]) {
        grouped[slot.day].push(slot)
      }
    })
    return grouped
  })()

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Class Schedule</h1>
        <p className="text-sm text-text-muted mt-1">Review your weekly timetable schedule, rooms, and lecture timings.</p>
      </div>

      {isLoading ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Loading class schedule...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading schedule: {error.message}
        </div>
      ) : slots.length === 0 ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border bg-slate-50/20">
          <span className="text-2xl">⏳</span>
          <h4 className="font-bold text-text-secondary text-sm">No schedule configured</h4>
          <p className="text-xs max-w-xs mt-1">No timetable entries have been set up for your class yet.</p>
        </div>
      ) : (
        /* ── WEEKLY GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {DAYS.map((day) => {
            const daySlots = groupedSlots[day] || []
            const isToday = day === todayName

            return (
              <div
                key={day}
                className={`flex flex-col space-y-4 rounded-xl transition-all duration-200 ${isToday
                  ? 'p-2 bg-navy-50/20 border border-primary/20 shadow-[0_4px_16px_rgba(30,58,95,0.06)]'
                  : ''
                  }`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 text-center font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm flex items-center justify-center gap-1.5 ${isToday
                    ? 'bg-primary text-white scale-[1.02]'
                    : 'bg-white text-text-secondary border border-card-border'
                    }`}
                >
                  {isToday && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />}
                  <span>{day}</span>
                  {isToday && <span className="text-[9px] font-black tracking-normal ml-0.5">(Today)</span>}
                </div>

                {/* Day Slots List */}
                <div className="flex-1 space-y-3">
                  {daySlots.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-card-border text-center text-[10px] text-text-muted bg-slate-50/10 py-8">
                      No Lectures
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`p-3.5 rounded-xl border bg-white hover:shadow-card transition-all duration-200 flex flex-col justify-between space-y-3 ${isToday ? 'border-primary/30 hover:border-primary/50' : 'border-card-border hover:border-slate-300'
                          }`}
                      >
                        <div>
                          {/* Course Code & Name */}
                          <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-navy-50 text-primary border border-navy-100">
                            {slot.course?.code ?? 'N/A'}
                          </span>
                          <h4 className="text-xs font-extrabold text-text-primary mt-1.5 truncate" title={slot.course?.name}>
                            {slot.course?.name}
                          </h4>
                        </div>

                        {/* Room & Time info */}
                        <div className="space-y-1 text-[10px] text-text-secondary font-medium">
                          <div className="flex items-center gap-1.5 text-text-primary font-bold">

                            <span>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">

                            <span>{slot.room}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate" title={slot.teacher?.full_name || slot.teacher?.username}>

                            <span>{slot.teacher?.full_name || slot.teacher?.username}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
