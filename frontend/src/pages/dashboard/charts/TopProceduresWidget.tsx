import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiJson } from '@/lib/api'
import type { ProcedureCount } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui'

export default function TopProceduresWidget() {
  const q = useQuery({
    queryKey: ['analytics', 'procedures-top'],
    queryFn: () => apiJson<ProcedureCount[]>('/admin/analytics/procedures-top'),
  })

  const data = (q.data ?? []).map((d) => ({ name: d.name, count: d.count }))

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase text-zinc-400">Топ процедур (30 дней)</p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} width={100} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-brand-500)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : null}
        {!q.isLoading && data.length === 0 ? (
          <p className="text-xs text-zinc-500">Нет данных</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
