import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useState } from 'react'
import { apiJson } from '@/lib/api'
import type { Appointment, DoctorPublic, Procedure, Slot } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'

export default function BookingPage() {
  const qc = useQueryClient()
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [doctorId, setDoctorId] = useState<number | ''>('')
  const [procId, setProcId] = useState<number | ''>('')

  const clinicQ = useQuery({
    queryKey: ['clinic', 'demo'],
    queryFn: () => apiJson<{ slug: string; procedures: Procedure[]; doctors: DoctorPublic[] }>('/public/clinics/demo-clinic'),
  })

  const slotsQ = useQuery({
    queryKey: ['slots', doctorId, procId, day],
    queryFn: () =>
      apiJson<Slot[]>(
        `/public/clinics/demo-clinic/slots?doctor_user_id=${doctorId}&procedure_id=${procId}&day=${day}`,
      ),
    enabled: !!doctorId && !!procId && !!day,
  })

  const create = useMutation({
    mutationFn: (start_at: string) =>
      apiJson<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          doctor_user_id: doctorId,
          procedure_id: procId,
          start_at,
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['appointments'] }),
  })

  const listQ = useQuery({
    queryKey: ['appointments'],
    queryFn: () => apiJson<Appointment[]>('/appointments'),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Внутренняя запись</h1>
        <p className="text-sm text-zinc-500">Создание слота для врача (демо-клиника)</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium">Новая запись</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Врач</Label>
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={doctorId === '' ? '' : String(doctorId)}
                onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {clinicQ.data?.doctors.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Процедура</Label>
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
                value={procId === '' ? '' : String(procId)}
                onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">—</option>
                {clinicQ.data?.procedures.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Дата</Label>
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-100 p-2">
              {slotsQ.isFetching ? <p className="text-xs text-zinc-500">Слоты…</p> : null}
              {slotsQ.data?.map((s) => (
                <div key={s.start_at} className="flex items-center justify-between gap-2 text-sm">
                  <span>{format(new Date(s.start_at), 'HH:mm')}</span>
                  <Button size="sm" variant="outline" onClick={() => create.mutate(s.start_at)} disabled={create.isPending}>
                    Записать
                  </Button>
                </div>
              ))}
              {slotsQ.data?.length === 0 && !slotsQ.isFetching ? (
                <p className="text-xs text-zinc-500">Нет свободных слотов</p>
              ) : null}
            </div>
            {create.isError ? <p className="text-xs text-red-600">{(create.error as Error).message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium">Мои записи</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {listQ.data?.map((a) => (
              <div key={a.id} className="flex justify-between rounded-lg bg-zinc-50 px-3 py-2">
                <span>{a.procedure?.name ?? `#${a.procedure_id}`}</span>
                <span className="text-xs text-zinc-500">{format(new Date(a.start_at), 'dd.MM HH:mm')}</span>
              </div>
            ))}
            {listQ.data?.length === 0 ? <p className="text-xs text-zinc-500">Пусто</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
