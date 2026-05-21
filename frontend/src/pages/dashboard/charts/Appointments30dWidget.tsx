import { useQuery } from '@tanstack/react-query'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiJson } from '@/lib/api'
import type { AnalyticsPoint } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui'

export default function Appointments30dWidget() {
  const q = useQuery({
    queryKey: ['analytics', 'appointments-30d'],
    queryFn: () => apiJson<AnalyticsPoint[]>('/admin/analytics/appointments-30d'),
  })

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase text-zinc-400">Записи за 30 дней</p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {q.data ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={q.data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                tickFormatter={(v: string) => v.slice(5)}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                labelFormatter={(v) => String(v)}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-brand-600)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
      </CardContent>
    </Card>
  )
}
