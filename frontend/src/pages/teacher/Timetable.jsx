import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'

import axiosInstance from '@api/axios.js'

export default function TeacherTimetable() {
  const [selectedClass, setSelectedClass] = useState('')
  const [viewMode, setViewMode] = useState('grid') // 'grid' | 'agenda'
  const [selectedAgendaDay, setSelectedAgendaDay] = useState('Monday')

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  // ── Query: Fetch Classes ──────────────────────────────────────────────────────
  const { data: classes = [], isLoading: isClassesLoading } = useQuery({
    queryKey: ['teacherClassesTimetable'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/classes', { params: { limit: 100 } })
      return data
    }
  })

  // ── Query: Fetch Timetable for Class ─────────────────────────────────────────
  const { data: slots = [], isLoading: isSlotsLoading, error } = useQuery({
    queryKey: ['classTimetable', selectedClass],
    queryFn: async () => {
      if (!selectedClass) return []
      const { data } = await axiosInstance.get(`/timetable/class/${selectedClass}`)
      return data
    },
    enabled: !!selectedClass
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
    hours = hours ? hours : 12 // hour '0' should be '12'
    return `${hours}:${minutes} ${ampm}`
  }

  // Group slots by Day of the Week
  const groupSlotsByDay = () => {
    const grouped = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    }
    slots.forEach((slot) => {
      if (grouped[slot.day]) {
        grouped[slot.day].push(slot)
      }
    })
    return grouped
  }

  const groupedSlots = groupSlotsByDay()

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">Class Timetables</h1>
          <p className="text-sm text-text-muted mt-1">View the weekly academic schedule, lectures, rooms, and allocations.</p>
        </div>

        {/* View mode toggle */}
        {selectedClass && (
          <div className="inline-flex bg-slate-100 p-1 rounded-lg border border-card-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 ${
                viewMode === 'grid'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Weekly Grid
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 ${
                viewMode === 'agenda'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Daily Agenda
            </button>
          </div>
        )}
      </div>

      {/* Class Selector Bar */}
      <div className="flex items-center gap-4 p-4 card bg-white">
        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Select Class Roster:</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="input bg-white max-w-xs text-xs font-semibold py-1.5"
          disabled={isClassesLoading}
        >
          <option value="">-- Choose Class --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} (Semester {cls.semester})
            </option>
          ))}
        </select>
      </div>

      {/* Display States */}
      {!selectedClass ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-2xl border border-card-border">
            📅
          </div>
          <h3 className="font-bold text-text-primary text-lg">Choose a Class</h3>
          <p className="text-sm max-w-md">
            Please choose a class from the drop-down menu above to see its scheduled weekly timetable lectures.
          </p>
        </div>
      ) : isSlotsLoading ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-xs font-semibold">Loading class timetable...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center card bg-white text-status-red font-semibold">
          Error loading schedule: {error.message}
        </div>
      ) : slots.length === 0 ? (
        <div className="card bg-white p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-2 border border-dashed border-card-border bg-slate-50/20">
          <span className="text-2xl">⏳</span>
          <h4 className="font-bold text-text-secondary text-sm">No slots configured</h4>
          <p className="text-xs max-w-xs mt-1">This class does not have any lectures scheduled in the timetable yet.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── WEEKLY GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {DAYS.map((day) => {
            const daySlots = groupedSlots[day] || []

            return (
              <div key={day} className="flex flex-col space-y-4">
                {/* Day Header */}
                <div className="p-3 bg-primary text-white text-center font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm">
                  {day}
                </div>

                {/* Day Slots List */}
                <div className="flex-1 space-y-3">
                  {daySlots.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-card-border text-center text-[11px] text-text-muted bg-slate-50/20 py-8">
                      No Lectures
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <div 
                        key={slot.id}
                        className="p-3.5 rounded-xl border border-card-border bg-white hover:border-primary/40 hover:shadow-card transition-all duration-200 flex flex-col justify-between space-y-3"
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
                            <span>🕒</span>
                            <span>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span>🚪</span>
                            <span>{slot.room}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate" title={slot.teacher?.full_name || slot.teacher?.username}>
                            <span>👤</span>
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
      ) : (
        /* ── DAILY AGENDA VIEW ── */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Day list selectors (Left) */}
          <div className="lg:col-span-3 card bg-white p-4 space-y-1">
            <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-3 mb-3">Agenda Days</h4>
            {DAYS.map((day) => {
              const count = groupedSlots[day]?.length ?? 0
              return (
                <button
                  key={day}
                  onClick={() => setSelectedAgendaDay(day)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-lg transition-all duration-150 ${
                    selectedAgendaDay === day
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-muted hover:bg-slate-50 hover:text-text-secondary'
                  }`}
                >
                  <span>{day}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                    selectedAgendaDay === day ? 'bg-navy-800 text-white' : 'bg-slate-100 text-text-muted'
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Agenda view (Right) */}
          <div className="lg:col-span-9 card bg-white p-6 space-y-6">
            <h3 className="text-base font-bold text-text-primary">
              Lectures Scheduled for {selectedAgendaDay}
            </h3>

            {(!groupedSlots[selectedAgendaDay] || groupedSlots[selectedAgendaDay].length === 0) ? (
              <div className="p-12 text-center text-text-muted border border-dashed border-card-border rounded-xl bg-slate-50/20 py-16">
                No lectures scheduled for {selectedAgendaDay}. Enjoy your day off!
              </div>
            ) : (
              <div className="space-y-4">
                {groupedSlots[selectedAgendaDay].map((slot, index) => (
                  <div 
                    key={slot.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-card-border hover:border-slate-300 transition-all duration-150 gap-4"
                  >
                    {/* Time & Period Info */}
                    <div className="flex items-center gap-4 min-w-0 sm:w-1/3">
                      {/* Period Badge Index */}
                      <div className="w-8 h-8 rounded-full bg-navy-50 border border-navy-100 flex items-center justify-center font-bold text-xs text-primary flex-shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-xs font-black text-text-primary">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </p>
                        <p className="text-[10px] text-text-muted font-bold mt-0.5 flex items-center gap-1">
                          <span>🚪</span> Location: {slot.room}
                        </p>
                      </div>
                    </div>

                    {/* Subject Course Details */}
                    <div className="min-w-0 sm:w-1/3">
                      <span className="inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-navy-50 text-primary border border-navy-100">
                        {slot.course?.code}
                      </span>
                      <h4 className="text-sm font-bold text-text-primary mt-1 truncate" title={slot.course?.name}>
                        {slot.course?.name}
                      </h4>
                    </div>

                    {/* Teacher Details */}
                    <div className="min-w-0 sm:w-1/3 sm:text-right flex items-center sm:justify-end gap-2 text-xs font-medium text-text-secondary">
                      <span>Lecturer:</span>
                      <span className="font-bold text-text-primary bg-slate-50 px-2 py-1 rounded-lg border border-card-border truncate max-w-[160px]">
                        {slot.teacher?.full_name || slot.teacher?.username}
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
