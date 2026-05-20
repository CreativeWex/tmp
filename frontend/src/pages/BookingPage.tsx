import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, addMinutes, differenceInMinutes, format, isSameDay, parseISO, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import type { Appointment, DoctorPublic, Procedure, Slot } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'
import { cn } from '@/lib/utils'

type ViewMode = 'list' | 'week'

const DAY_START_HOUR = 8
const DAY_END_HOUR = 20
const HOUR_PX = 56
const TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60

export default function BookingPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isClient = user?.role === 'client'
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [doctorId, setDoctorId] = useState<number | ''>('')
  const [procId, setProcId] = useState<number | ''>('')
  const [view, setView] = useState<ViewMode>('list')
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))

  const clinicQ = useQuery({
    queryKey: ['clinic', 'demo'],
    queryFn: () => apiJson<{ slug: string; procedures: Procedure[]; doctors: DoctorPublic[] }>('/public/clinics/demo-clinic'),
  })

  const slotsQ = useQuery({
    queryKey: ['slots', doctorId, procId, day],
    queryFn: () =>
      apiJson<Slot[]>(
        `/public/clinics/demo-clinic/slots?doctor_user_id=${doctorId}&procedure_id=${procId}&day=${day}`,
      ),
    enabled: !!doctorId && !!procId && !!day,
  })

  const create = useMutation({
    mutationFn: (start_at: string) =>
      apiJson<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctor_user_id: doctorId,
          procedure_id: procId,
          start_at,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] })
      void qc.invalidateQueries({ queryKey: ['slots', doctorId, procId, day] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['client-home'] })
    },
  })

  const listQ = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiJson<Appointment[]>('/appointments'),
  })

  const cancel = useMutation({
    mutationFn: (id: number) =>
      apiJson<Appointment>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] })
      void qc.invalidateQueries({ queryKey: ['slots', doctorId, procId, day] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['client-home'] })
    },
  })

  const procedureName = (pid: number) =>
    clinicQ.data?.procedures.find((p) => p.id === pid)?.name ?? `#${pid}`

  const doctorName = (uid: number) =>
    clinicQ.data?.doctors.find((d) => d.user_id === uid)?.full_name ?? `Врач #${uid}`

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  )

  const appointmentsForWeek = useMemo(() => {
    const map = new Map<string, Appointment[]>()
    for (const d of weekDays) map.set(format(d, 'yyyy-MM-dd'), [])
    for (const a of listQ.data ?? []) {
      const startDate = parseISO(a.start_at)
      const key = format(startDate, 'yyyy-MM-dd')
      const arr = map.get(key)
      if (arr) arr.push(a)
    }
    return map
  }, [listQ.data, weekDays])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{isClient ? 'Моя запись' : 'Внутренняя запись'}</h1>
        <p className="text-sm text-zinc-500">
          {isClient
            ? 'Выберите процедуру, врача и удобное время — без подтверждения по СМС, вы уже авторизованы.'
            : 'Создание слота, список и календарь записей'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium">Новая запись</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Врач</Label>
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={doctorId === '' ? '' : String(doctorId)}
                onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {clinicQ.data?.doctors.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Процедура</Label>
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={procId === '' ? '' : String(procId)}
                onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {clinicQ.data?.procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.duration_minutes}+{p.buffer_after_minutes} мин
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-100 p-2">
              {slotsQ.isFetching ? <p className="text-xs text-zinc-500">Слоты…</p> : null}
              {slotsQ.data?.map((s) => (
                <div key={s.start_at} className="flex items-center justify-between gap-2 text-sm">
                  <span>{format(new Date(s.start_at), 'HH:mm')}</span>
                  <Button size="sm" variant="outline" onClick={() => create.mutate(s.start_at)} disabled={create.isPending}>
                    Записать
                  </Button>
                </div>
              ))}
              {slotsQ.data?.length === 0 && !slotsQ.isFetching ? (
                <p className="text-xs text-zinc-500">Нет свободных слотов</p>
              ) : null}
              {!doctorId || !procId ? (
                <p className="text-xs text-zinc-400">Выберите врача и процедуру</p>
              ) : null}
            </div>
            {create.isError ? <p className="text-xs text-red-600">{(create.error as Error).message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <h2 className="text-sm font-medium">
              {view === 'week' ? 'Расписание недели' : 'Мои записи'}
            </h2>
            <div className="flex gap-1 rounded-lg bg-zinc-100/80 p-1">
              <button
                type="button"
                onClick={() => setView('list')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition',
                  view === 'list' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                Список
              </button>
              <button
                type="button"
                onClick={() => setView('week')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition',
                  view === 'week' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                Неделя
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {view === 'list' ? (
              <div className="space-y-2 text-sm">
                {listQ.data?.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-900">
                        {a.procedure?.name ?? procedureName(a.procedure_id)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {format(new Date(a.start_at), 'dd.MM HH:mm')} · {doctorName(a.doctor_user_id)}
                        {a.guest_name ? ` · ${a.guest_name}` : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm('Отменить запись?')) cancel.mutate(a.id)
                      }}
                      disabled={cancel.isPending}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Отменить
                    </Button>
                  </div>
                ))}
                {listQ.data?.length === 0 ? <p className="text-xs text-zinc-500">Пусто</p> : null}
                {cancel.isError ? (
                  <p className="text-xs text-red-600">{(cancel.error as Error).message}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekAnchor((d) => addDays(d, -7))}
                  >
                    ← Неделя назад
                  </Button>
                  <p className="text-xs font-medium text-zinc-600">
                    {format(weekAnchor, 'd MMM', { locale: ru })} —{' '}
                    {format(addDays(weekAnchor, 6), 'd MMM yyyy', { locale: ru })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeekAnchor((d) => addDays(d, 7))}
                  >
                    Вперёд →
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                >
                  Текущая неделя
                </Button>
                <WeekGrid
                  days={weekDays}
                  byDay={appointmentsForWeek}
                  procedureName={procedureName}
                  onCancel={(id) => {
                    if (window.confirm('Отменить запись?')) cancel.mutate(id)
                  }}
                />
                {cancel.isError ? (
                  <p className="text-xs text-red-600">{(cancel.error as Error).message}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function WeekGrid({
  days,
  byDay,
  procedureName,
  onCancel,
}: {
  days: Date[]
  byDay: Map<string, Appointment[]>
  procedureName: (pid: number) => string
  onCancel: (id: number) => void
}) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i)
  const today = new Date()
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-[48px_repeat(7,minmax(0,1fr))] border-b border-zinc-100 pb-1">
          <div />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className={cn(
                'px-1 text-center text-xs font-medium',
                isSameDay(d, today) ? 'text-brand-600' : 'text-zinc-500',
              )}
            >
              <div>{format(d, 'EEEEEE', { locale: ru })}</div>
              <div className="text-[11px] text-zinc-400">{format(d, 'd MMM', { locale: ru })}</div>
            </div>
          ))}
        </div>
        <div className="relative grid grid-cols-[48px_repeat(7,minmax(0,1fr))]">
          <div>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="border-t border-zinc-100 text-[10px] text-zinc-400"
              >
                <div className="-mt-1.5 pr-1 text-right">{`${String(h).padStart(2, '0')}:00`}</div>
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              day={d}
              items={byDay.get(format(d, 'yyyy-MM-dd')) ?? []}
              hours={hours}
              procedureName={procedureName}
              onCancel={onCancel}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayColumn({
  day,
  items,
  hours,
  procedureName,
  onCancel,
}: {
  day: Date
  items: Appointment[]
  hours: number[]
  procedureName: (pid: number) => string
  onCancel: (id: number) => void
}) {
  return (
    <div className="relative border-l border-zinc-100">
      {hours.map((h) => (
        <div key={h} style={{ height: HOUR_PX }} className="border-t border-zinc-100" />
      ))}
      {items.map((a) => {
        const start = parseISO(a.start_at)
        const end = parseISO(a.end_at)
        const dayStart = addMinutes(new Date(day.getFullYear(), day.getMonth(), day.getDate()), DAY_START_HOUR * 60)
        const offsetMin = Math.max(differenceInMinutes(start, dayStart), 0)
        const totalMin = Math.max(differenceInMinutes(end, start), 15)
        const top = Math.min((offsetMin / 60) * HOUR_PX, TOTAL_MIN / 60 * HOUR_PX - HOUR_PX / 4)
        const height = Math.max((totalMin / 60) * HOUR_PX - 2, 18)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onCancel(a.id)}
            title="Нажмите, чтобы отменить"
            style={{ top, height }}
            className="absolute left-0.5 right-0.5 overflow-hidden rounded-md border border-brand-200 bg-brand-50 px-1.5 py-1 text-left text-[11px] leading-tight text-brand-900 shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-900"
          >
            <div className="font-semibold">
              {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
            </div>
            <div className="truncate">
              {a.procedure?.name ?? procedureName(a.procedure_id)}
            </div>
            {a.guest_name ? <div className="truncate text-[10px] opacity-70">{a.guest_name}</div> : null}
          </button>
        )
      })}
    </div>
  )
}
