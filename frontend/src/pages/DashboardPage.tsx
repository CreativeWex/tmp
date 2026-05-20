import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui'
import type { Dashboard } from '@/lib/types'
import ScheduleWidget from '@/pages/dashboard/ScheduleWidget'
import WeekChartWidget from '@/pages/dashboard/WeekChartWidget'
import RecentVisitsWidget from '@/pages/dashboard/RecentVisitsWidget'
import QuickActionsWidget from '@/pages/dashboard/QuickActionsWidget'
import ClientHomeWidget from '@/pages/dashboard/ClientHomeWidget'

export default function DashboardPage() {
  const { user } = useAuth()
  const isStaff = user?.role === 'admin' || user?.role === 'doctor'
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiJson<Dashboard>('/admin/dashboard'),
    enabled: isStaff,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Добро пожаловать</h1>
        <p className="mt-1 text-zinc-500">Краткая сводка по клинике и быстрые действия</p>
      </div>

      {user?.role === 'client' ? <ClientHomeWidget /> : null}

      {isStaff ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <p className="text-xs font-medium uppercase text-zinc-400">Записи (7 дней)</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900">{q.data?.appointments_week ?? '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="text-xs font-medium uppercase text-zinc-400">Отмены (7 дней)</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900">{q.data?.cancellations_week ?? '—'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <p className="text-xs font-medium uppercase text-zinc-400">Клиенты</p>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-zinc-900">{q.data?.clients_total ?? '—'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ScheduleWidget />
            </div>
            <div>
              <QuickActionsWidget />
            </div>
            <div className="lg:col-span-2">
              <RecentVisitsWidget />
            </div>
            <div>
              <WeekChartWidget series={q.data?.series_7d} />
            </div>
          </div>

          <Card className="border-brand-100 bg-gradient-to-br from-white to-brand-50/40">
            <CardHeader>
              <h2 className="font-medium text-zinc-900">Онлайн-запись для пациентов</h2>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-zinc-600">
              <p>Публичная страница с выбором процедуры, врача и слота.</p>
              <Link to="/book/demo-clinic" className="font-medium text-brand-600 hover:underline" target="_blank">
                Открыть /book/demo-clinic
              </Link>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
