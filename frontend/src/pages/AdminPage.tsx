import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiJson } from '@/lib/api'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'

interface Settings {
  slug: string
  name: string
  cancellation_hours_before: number
}

export default function AdminPage() {
  const qc = useQueryClient()
  const [hours, setHours] = useState('24')
  const [clinicName, setClinicName] = useState('')

  const sQ = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiJson<Settings>('/admin/settings'),
  })

  const patch = useMutation({
    mutationFn: () =>
      apiJson<Settings>('/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          name: clinicName || undefined,
          cancellation_hours_before: Number(hours) || undefined,
        }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const demoReminders = useMutation({
    mutationFn: () => apiJson<{ notifications_sent: number }>('/reminders/dispatch-demo', { method: 'POST' }),
  })

  const testTg = useMutation({
    mutationFn: () => apiJson('/notifications/test-telegram', { method: 'POST' }),
  })

  const testSms = useMutation({
    mutationFn: () =>
      apiJson(`/notifications/test-sms?phone=${encodeURIComponent('+79990000000')}`, {
        method: 'POST',
      }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Администрирование</h1>
        <p className="text-sm text-zinc-500">Клиника и демо-уведомления</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium">Настройки клиники</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-zinc-500">Slug: {sQ.data?.slug}</p>
          <div className="space-y-2">
            <Label>Название</Label>
            <Input
              placeholder={sQ.data?.name ?? ''}
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Минимум часов до отмены / переноса</Label>
            <Input value={hours} onChange={(e) => setHours(e.target.value)} type="number" min={2} max={48} />
          </div>
          <Button onClick={() => patch.mutate()} disabled={patch.isPending}>
            Сохранить
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium">Уведомления (демо)</h2>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => testTg.mutate()} disabled={testTg.isPending}>
            Тест Telegram
          </Button>
          <Button variant="outline" onClick={() => testSms.mutate()} disabled={testSms.isPending}>
            Тест SMS (mock)
          </Button>
          <Button variant="outline" onClick={() => demoReminders.mutate()} disabled={demoReminders.isPending}>
            Запустить напоминания (48ч)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
