import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { absoluteFileUrl, apiJson } from '@/lib/api'
import { Card, CardContent, CardHeader } from '@/components/ui'
import type { RecentVisit } from '@/lib/types'

export default function RecentVisitsWidget() {
  const q = useQuery({
    queryKey: ['dashboard', 'recent-visits'],
    queryFn: () => apiJson<RecentVisit[]>('/admin/recent-visits?limit=5'),
  })

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium text-zinc-900">Последние визиты</h2>
      </CardHeader>
      <CardContent className="space-y-2">
        {q.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
        {!q.isLoading && (q.data?.length ?? 0) === 0 ? (
          <p className="text-xs text-zinc-500">Визитов пока нет</p>
        ) : null}
        <ul className="space-y-2">
          {q.data?.map((v) => (
            <li key={v.visit_id}>
              <Link
                to={`/app/clients/${v.client_id}`}
                className="flex items-center gap-3 rounded-lg border border-transparent px-1 py-1 transition hover:border-brand-100 hover:bg-brand-50/40"
              >
                {v.first_photo_url ? (
                  <img
                    src={absoluteFileUrl(v.first_photo_url)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-zinc-100"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[10px] text-zinc-400">
                    нет фото
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{v.client_full_name}</p>
                  <p className="text-xs text-zinc-500">
                    {format(parseISO(v.visit_date), 'd MMM yyyy', { locale: ru })}
                  </p>
                </div>
                <span className="text-xs text-brand-600">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
