import { useQuery } from '@tanstack/react-query'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { apiJson } from '@/lib/api'
import type { StatusBucket } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui'

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'var(--color-brand-500)',
  pending: '#f59e0b',
  cancelled: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Подтверждено',
  pending: 'Ожидает',
  cancelled: 'Отменено',
}

export default function StatusFunnelWidget() {
  const q = useQuery({
    queryKey: ['analytics', 'appointments-status'],
    queryFn: () => apiJson<StatusBucket[]>('/admin/analytics/appointments-status'),
  })

  const data = (q.data ?? []).map((d) => ({
    name: STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    status: d.status,
  }))

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase text-zinc-400">Статусы записей (30 дней)</p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={75} paddingAngle={3}>
                {data.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#a1a1aa'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        {!q.isLoading && data.length === 0 ? (
          <p className="text-xs text-zinc-500">Нет данных</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
