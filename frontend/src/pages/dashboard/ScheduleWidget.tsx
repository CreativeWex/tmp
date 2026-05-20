import { useQuery } from '@tanstack/react-query'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { apiJson } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui'
import type { DashboardScheduleItem } from '@/lib/types'

export default function ScheduleWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'schedule'],
    queryFn: () => apiJson<DashboardScheduleItem[]>('/admin/dashboard/schedule?days=2'),
  })

  const today: DashboardScheduleItem[] = []
  const tomorrow: DashboardScheduleItem[] = []
  for (const item of q.data ?? []) {
    const d = parseISO(item.start_at)
    if (isToday(d)) today.push(item)
    else if (isTomorrow(d)) tomorrow.push(item)
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-zinc-900">Ближайшие записи</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {!q.isLoading ? (
          <>
            <ScheduleSection title="Сегодня" items={today} />
            <ScheduleSection title="Завтра" items={tomorrow} />
            {today.length === 0 && tomorrow.length === 0 ? (
              <p className="text-xs text-zinc-500">На ближайшие дни записей нет</p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ScheduleSection({ title, items }: { title: string; items: DashboardScheduleItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm"
          >
            <span className="font-medium text-zinc-900">
              {format(parseISO(it.start_at), 'HH:mm', { locale: ru })} · {it.procedure_name}
            </span>
            <span className="text-xs text-zinc-500">{it.client_full_name ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
