import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import type { Client } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'
import { useState } from 'react'

export default function ClientsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const q = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiJson<Client[]>('/clients'),
  })
  const m = useMutation({
    mutationFn: () =>
      apiJson<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify({ full_name: name }),
      }),
    onSuccess: () => {
      setName('')
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const canCreate = user?.role === 'admin' || user?.role === 'doctor'

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Клиенты</h1>
          <p className="text-sm text-zinc-500">Профили, визиты и фото «до / после»</p>
        </div>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-zinc-900">Новый клиент</h2>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                m.mutate()
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="fn">ФИО</Label>
                <Input id="fn" value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванова Мария" />
              </div>
              <Button type="submit" disabled={m.isPending || !name.trim()}>
                Добавить
              </Button>
            </form>
            {m.isError ? <p className="text-sm text-red-600">{(m.error as Error).message}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {q.isLoading ? <p className="text-sm text-zinc-500">Загрузка…</p> : null}
        {q.data?.map((c) => (
          <Link key={c.id} to={`/app/clients/${c.id}`}>
            <Card className="transition hover:border-brand-200 hover:shadow-md">
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-zinc-900">{c.full_name}</p>
                  <p className="text-xs text-zinc-500">
                    {c.phone ?? '—'} · {c.email ?? '—'}
                  </p>
                </div>
                <span className="text-xs text-brand-600">Открыть →</span>
              </CardContent>
            </Card>
          </Link>
        ))}
        {q.data?.length === 0 ? <p className="text-sm text-zinc-500">Клиентов пока нет</p> : null}
      </div>
    </div>
  )
}
