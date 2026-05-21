import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { apiJson } from '@/lib/api'
import type { AgeBucket } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui'

const BUCKET_ORDER = ['18-24', '25-34', '35-44', '45-54', '55+', 'unknown']

export default function AgeGroupsWidget() {
  const q = useQuery({
    queryKey: ['analytics', 'age-groups'],
    queryFn: () => apiJson<AgeBucket[]>('/admin/analytics/age-groups'),
  })

  const data = BUCKET_ORDER
    .map((bucket) => {
      const found = q.data?.find((d) => d.bucket === bucket)
      return found ? { bucket: bucket === 'unknown' ? 'Неизв.' : bucket, count: found.count } : null
    })
    .filter(Boolean) as { bucket: string; count: number }[]

  return (
    <Card>
      <CardHeader>
        <p className="text-xs font-medium uppercase text-zinc-400">Возрастные группы клиентов</p>
      </CardHeader>
      <CardContent>
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-brand-600)" radius={[4, 4, 0, 0]} />
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
