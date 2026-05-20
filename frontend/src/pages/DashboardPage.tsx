import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui'

interface Dashboard {
  appointments_week: number
  cancellations_week: number
  clients_total: number
  revenue_placeholder: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const q = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiJson<Dashboard>('/admin/dashboard'),
    enabled: user?.role === 'admin' || user?.role === 'doctor',
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Добро пожаловать</h1>
        <p className="mt-1 text-zinc-500">Краткая сводка по клинике и быстрые действия</p>
      </div>

      {user?.role === 'client' ? (
        <Card>
          <CardHeader>
            <h2 className="font-medium text-zinc-900">Личный кабинет</h2>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <p>Здесь отображаются ваши данные и записи. Откройте карточку клиента с вашим профилем.</p>
            <Link to="/app/clients" className="font-medium text-brand-600 hover:underline">
              Перейти к клиентам
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {user?.role === 'admin' || user?.role === 'doctor' ? (
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
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Card>
          <CardHeader>
            <h2 className="font-medium text-zinc-900">Документация API</h2>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            <a href="http://localhost:8000/docs" className="font-medium text-brand-600 hover:underline" target="_blank" rel="noreferrer">
              Swagger UI
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
