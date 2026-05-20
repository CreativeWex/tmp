import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import { Button, Card, CardContent, CardHeader } from '@/components/ui'
import type { Appointment, Client, Visit } from '@/lib/types'

export default function ClientHomeWidget() {
  const qc = useQueryClient()

  const apQ = useQuery({
    queryKey: ['client-home', 'appointments'],
    queryFn: () => apiJson<Appointment[]>('/appointments'),
  })

  const meQ = useQuery({
    queryKey: ['client-home', 'me'],
    queryFn: () => apiJson<Client[]>('/clients'),
  })

  const myClient = meQ.data?.[0]
  const visitsQ = useQuery({
    queryKey: ['client-home', 'visits', myClient?.id],
    queryFn: () => apiJson<Visit[]>(`/clients/${myClient!.id}/visits`),
    enabled: !!myClient,
  })

  const cancel = useMutation({
    mutationFn: (id: number) => apiJson<Appointment>(`/appointments/${id}/cancel`, { method: 'PATCH' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client-home'] })
      void qc.invalidateQueries({ queryKey: ['appointments'] })
    },
  })

  const nowMs = Date.now()
  const next = (apQ.data ?? [])
    .filter((a) => parseISO(a.start_at).getTime() >= nowMs)
    .sort((a, b) => parseISO(a.start_at).getTime() - parseISO(b.start_at).getTime())[0]

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-zinc-900">Моя ближайшая запись</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {apQ.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
          {next ? (
            <>
              <div>
                <p className="text-base font-medium text-zinc-900">
                  {next.procedure?.name ?? `Процедура #${next.procedure_id}`}
                </p>
                <p className="text-zinc-600">
                  {format(parseISO(next.start_at), "EEEE, d MMMM 'в' HH:mm", { locale: ru })}
                </p>
                <p className="text-xs text-zinc-500">
                  Длительность: {Math.round((parseISO(next.end_at).getTime() - parseISO(next.start_at).getTime()) / 60000)} мин
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (window.confirm('Отменить запись?')) cancel.mutate(next.id)
                  }}
                  disabled={cancel.isPending}
                  className="text-red-600 hover:bg-red-50"
                >
                  Отменить
                </Button>
                <Link to="/app/booking" className="text-xs font-medium text-brand-600 hover:underline">
                  Записаться ещё →
                </Link>
              </div>
              {cancel.isError ? (
                <p className="text-xs text-red-600">{(cancel.error as Error).message}</p>
              ) : null}
            </>
          ) : !apQ.isLoading ? (
            <p className="text-zinc-500">
              Предстоящих записей нет.{' '}
              <Link to="/app/booking" className="font-medium text-brand-600 hover:underline">
                Записаться
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium text-zinc-900">История визитов</h2>
        </CardHeader>
        <CardContent>
          {!myClient && !meQ.isLoading ? (
            <p className="text-xs text-zinc-500">Профиль клиента не привязан</p>
          ) : null}
          {visitsQ.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
          {visitsQ.data?.length === 0 ? (
            <p className="text-xs text-zinc-500">Визитов пока нет</p>
          ) : null}
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {visitsQ.data?.map((v) => (
              <li key={v.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-900">
                  {format(parseISO(v.visit_date), 'd MMMM yyyy', { locale: ru })}
                </p>
                {v.notes ? (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600">{v.notes}</p>
                ) : (
                  <p className="mt-1 text-xs text-zinc-400">Без заметок</p>
                )}
              </li>
            ))}
          </ul>
          {myClient ? (
            <Link
              to={`/app/clients/${myClient.id}`}
              className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline"
            >
              Открыть карточку →
            </Link>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
