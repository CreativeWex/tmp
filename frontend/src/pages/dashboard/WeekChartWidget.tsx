import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Card, CardContent, CardHeader } from '@/components/ui'
import type { DashboardSeriesPoint } from '@/lib/types'

export default function WeekChartWidget({ series }: { series: DashboardSeriesPoint[] | undefined }) {
  const data = series ?? []
  const counts = data.map((p) => p.count)
  const max = Math.max(1, ...counts)
  const total = counts.reduce((s, n) => s + n, 0)
  const barW = 12
  const gap = 8
  const left = 4
  const chartH = 48
  const baseline = 52

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-zinc-900">Неделя</h2>
        <span className="text-xs text-zinc-500">Записей: {total}</span>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-xs text-zinc-500">Нет данных</p>
        ) : (
          <div className="space-y-2">
            <svg viewBox="0 0 140 60" className="block w-full" preserveAspectRatio="none">
              {data.map((p, i) => {
                const h = (p.count / max) * chartH
                const x = left + i * (barW + gap)
                const y = baseline - h
                return (
                  <g key={p.date}>
                    <rect x={x} y={y} width={barW} height={Math.max(h, 1)} rx={2} className="fill-brand-500" />
                    {p.count > 0 ? (
                      <text x={x + barW / 2} y={y - 2} textAnchor="middle" className="fill-zinc-500 text-[6px]">
                        {p.count}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>
            <div className="flex justify-between text-[10px] text-zinc-400">
              {data.map((p) => (
                <span key={p.date} className="w-5 text-center">
                  {format(parseISO(p.date), 'EEEEEE', { locale: ru })}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
