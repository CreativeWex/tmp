import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import type { Client } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'

type SortKey = 'recent' | 'name'

function normalizePhone(s: string): string {
  return s.trim().replace(/[\s\-\(\)]/g, '')
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('recent')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const isClient = user?.role === 'client'
  const canCreate = user?.role === 'admin' || user?.role === 'doctor'

  const meQ = useQuery({
    queryKey: ['client-me'],
    queryFn: () => apiJson<Client>('/clients/me'),
    enabled: isClient,
  })

  const q = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiJson<Client[]>('/clients'),
    enabled: !isClient,
  })

  const m = useMutation({
    mutationFn: () =>
      apiJson<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify({
          full_name: name,
          phone: normalizePhone(phone) || null,
        }),
      }),
    onSuccess: () => {
      setName('')
      setPhone('')
      void qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiJson<void>(`/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setDeleteConfirm(null)
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const filtered = useMemo(() => {
    if (isClient) return []
    const list = q.data ?? []
    const s = search.trim().toLowerCase()
    const matched = s
      ? list.filter((c) => {
          const hay = [c.full_name, c.phone ?? '', c.email ?? ''].join(' ').toLowerCase()
          return hay.includes(s)
        })
      : list
    const sorted = [...matched]
    if (sort === 'name') {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'))
    } else {
      sorted.sort((a, b) => b.id - a.id)
    }
    return sorted
  }, [q.data, search, sort, isClient])

  useEffect(() => {
    if (isClient && meQ.data) {
      navigate(`/app/clients/${meQ.data.id}`, { replace: true })
    }
  }, [isClient, meQ.data, navigate])

  if (isClient) {
    if (meQ.isLoading) return <p className="text-sm text-zinc-500">Загрузка…</p>
    if (meQ.isError || (!meQ.isLoading && !meQ.data)) {
      return (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">
            Профиль клиента ещё не привязан к учётной записи. Обратитесь к администратору.
          </CardContent>
        </Card>
      )
    }
    return <p className="text-sm text-zinc-500">Загрузка…</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Клиенты</h1>
          <p className="text-sm text-zinc-500">Профили, визиты и фото «до / после»</p>
        </div>
        <div className="text-xs text-zinc-500">
          Всего: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{q.data?.length ?? 0}</span>
          {search ? (
            <>
              {' '}· Найдено: <span className="font-semibold text-zinc-700 dark:text-zinc-300">{filtered.length}</span>
            </>
          ) : null}
        </div>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Новый клиент</h2>
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
              <div className="flex-1 space-y-2">
                <Label htmlFor="ph">Телефон</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" />
              </div>
              <Button type="submit" disabled={m.isPending || !name.trim()}>
                Добавить
              </Button>
            </form>
            {m.isError ? <p className="mt-2 text-sm text-red-600">{(m.error as Error).message}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="search">Поиск</Label>
            <Input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ФИО, телефон или email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort">Сортировка</Label>
            <select
              id="sort"
              className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 text-sm sm:w-52"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
              <option value="recent">Сначала новые</option>
              <option value="name">По алфавиту</option>
            </select>
          </div>
          {search ? (
            <Button variant="ghost" onClick={() => setSearch('')}>
              Сбросить
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {q.isLoading ? <p className="text-sm text-zinc-500">Загрузка…</p> : null}
        {filtered.map((c) => (
          <div key={c.id} className="relative">
            {deleteConfirm === c.id ? (
              <Card className="border-red-200">
                <CardContent className="flex items-center justify-between py-4">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    Удалить <span className="font-medium">{c.full_name}</span> и всю историю? Действие необратимо.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteMut.mutate(c.id)}
                      disabled={deleteMut.isPending}
                    >
                      Удалить
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(null)}>
                      Отмена
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Link to={`/app/clients/${c.id}`}>
                <Card className="transition hover:border-brand-200 hover:shadow-md">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.full_name}</p>
                      <p className="text-xs text-zinc-500">
                        {c.phone ?? '—'} · {c.email ?? '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {canCreate ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setDeleteConfirm(c.id)
                          }}
                          className="text-xs text-red-500 hover:text-red-700"
                          title="Удалить клиента"
                        >
                          🗑
                        </button>
                      ) : null}
                      <span className="text-xs text-brand-600">Открыть →</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        ))}
        {!q.isLoading && filtered.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {search ? 'Ничего не найдено по вашему запросу' : 'Клиентов пока нет'}
          </p>
        ) : null}
        {deleteMut.isError ? (
          <p className="text-sm text-red-600">{(deleteMut.error as Error).message}</p>
        ) : null}
      </div>
    </div>
  )
}
