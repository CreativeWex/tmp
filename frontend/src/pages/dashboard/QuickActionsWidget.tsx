import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import { Badge, Card, CardContent, CardHeader } from '@/components/ui'
import type { UpcomingBirthday } from '@/lib/types'

export default function QuickActionsWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'birthdays'],
    queryFn: () => apiJson<UpcomingBirthday[]>('/admin/upcoming-birthdays?days=7'),
  })

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-zinc-900">Быстрые действия</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Link
            to="/app/clients"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            Новый клиент
          </Link>
          <Link
            to="/app/booking"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50"
          >
            Новая запись
          </Link>
        </div>

        <div className="space-y-2 border-t border-zinc-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Дни рождения</p>
          {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
          {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
            <p className="text-xs text-zinc-500">Нет дней рождения на этой неделе</p>
          ) : null}
          <ul className="space-y-2">
            {q.data?.map((b) => (
              <li key={b.client_id} className="flex items-center justify-between gap-2 text-sm">
                <Link to={`/app/clients/${b.client_id}`} className="font-medium text-zinc-900 hover:underline">
                  {b.full_name}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {format(parseISO(b.birth_date), 'd MMM', { locale: ru })}
                  </span>
                  <Badge>{b.days_until === 0 ? 'сегодня' : `через ${b.days_until} дн.`}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
