import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { absoluteFileUrl, apiJson } from '@/lib/api'
import type { CarePlan, Client, Product, Visit, VisitPhoto } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label, Tabs } from '@/components/ui'

const SKIN = ['dry', 'oily', 'combination', 'normal'] as const
const CONCERNS_OPTS = ['acne', 'pigmentation', 'rosacea', 'wrinkles', 'dryness']

type CompareSlot = { visitId: number; photoId: number }

function normalizePhone(s: string): string {
  return s.trim().replace(/[\s\-\(\)]/g, '')
}

export default function ClientDetailPage() {
  const { id } = useParams()
  const clientId = Number(id)
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')
  const [visitDate, setVisitDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [visitNotes, setVisitNotes] = useState('')
  const [compare, setCompare] = useState<CompareSlot[]>([])
  const [skin, setSkin] = useState<(typeof SKIN)[number]>('combination')
  const [concerns, setConcerns] = useState<string[]>(['dryness'])
  const [reco, setReco] = useState<Product[]>([])
  const [planId, setPlanId] = useState<number | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const clientQ = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => apiJson<Client>(`/clients/${clientId}`),
    enabled: Number.isFinite(clientId),
  })

  const visitsQ = useQuery({
    queryKey: ['visits', clientId],
    queryFn: () => apiJson<Visit[]>(`/clients/${clientId}/visits`),
    enabled: Number.isFinite(clientId),
  })

  const canEdit = user?.role === 'admin' || user?.role === 'doctor'
  const isClient = user?.role === 'client'
  const isOwnProfile = isClient && clientQ.data?.user_id === user?.id
  const canEditProfile = canEdit || isOwnProfile
  const canSeeCare = canEdit || isClient

  useEffect(() => {
    if (!canSeeCare && tab === 'care') setTab('profile')
  }, [canSeeCare, tab])

  const addVisit = useMutation({
    mutationFn: () =>
      apiJson<Visit>(`/clients/${clientId}/visits`, {
        method: 'POST',
        body: JSON.stringify({ visit_date: visitDate, notes: visitNotes.trim() || null }),
      }),
    onSuccess: () => {
      setVisitNotes('')
      void qc.invalidateQueries({ queryKey: ['visits', clientId] })
    },
  })

  const recommend = useMutation({
    mutationFn: () =>
      apiJson<{ products: Product[] }>('/recommendations', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, skin_type: skin, concerns }),
      }),
    onSuccess: (d) => setReco(d.products),
  })

  const createPlan = useMutation({
    mutationFn: () => {
      const items = reco.map((p, i) => ({
        product_id: p.id,
        period: i % 2 === 0 ? ('morning' as const) : ('evening' as const),
        step_order: Math.floor(i / 2),
        frequency: 'ежедневно',
      }))
      return apiJson<CarePlan>('/care-plans', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          skin_type: skin,
          concerns,
          notes: 'Схема на основе подбора BeautyTrack',
          items,
        }),
      })
    },
    onSuccess: (p) => {
      setPlanId(p.id)
      void qc.invalidateQueries({ queryKey: ['care-plans', clientId] })
    },
  })

  const deleteClient = useMutation({
    mutationFn: () => apiJson<void>(`/clients/${clientId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/app/clients', { replace: true })
    },
  })

  const c = clientQ.data

  const toggleConcern = (x: string) => {
    setConcerns((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]))
  }

  const toggleCompare = (visitId: number, photoId: number) => {
    setCompare((prev) => {
      const exists = prev.some((s) => s.visitId === visitId && s.photoId === photoId)
      if (exists) return prev.filter((s) => !(s.visitId === visitId && s.photoId === photoId))
      const next = [...prev, { visitId, photoId }]
      if (next.length > 2) return next.slice(-2)
      return next
    })
  }

  async function downloadPdf() {
    if (!planId) return
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
    const res = await fetch(`${base}/care-plans/${planId}/pdf`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('bt_token')}` },
    })
    if (!res.ok) throw new Error('PDF error')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `care-plan-${planId}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (!Number.isFinite(clientId)) return <p className="text-sm text-red-600">Некорректный id</p>

  if (clientQ.isError) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-zinc-500">
          Нет доступа к этой карточке.{' '}
          <Link to="/app" className="font-medium text-brand-600 hover:underline">
            На главную
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{c?.full_name ?? '…'}</h1>
          <p className="text-sm text-zinc-500">Карточка клиента #{clientId}</p>
        </div>
        {canEdit ? (
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Удалить клиента и всю историю?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteClient.mutate()}
                  disabled={deleteClient.isPending}
                >
                  Удалить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="text-red-500 hover:text-red-700">
                Удалить клиента
              </Button>
            )}
            {deleteClient.isError ? (
              <p className="mt-1 text-xs text-red-600">{(deleteClient.error as Error).message}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Профиль' },
          { id: 'visits', label: 'Визиты и фото' },
          ...(canSeeCare ? [{ id: 'care', label: 'Уход' }] : []),
        ]}
      />

      {tab === 'profile' && c ? (
        <ProfileCard client={c} canEdit={canEditProfile} canEditFullName={canEdit} clientId={clientId} />
      ) : null}

      {tab === 'visits' ? (
        <div className="space-y-6">
          {canEdit ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-medium">Новый визит</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-2">
                    <Label>Дата</Label>
                    <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                  </div>
                  <Button onClick={() => addVisit.mutate()} disabled={addVisit.isPending}>
                    Создать визит
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visit-notes">Заметки (необязательно)</Label>
                  <textarea
                    id="visit-notes"
                    rows={2}
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    placeholder="Жалобы клиента, что делали на приёме, рекомендации…"
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm outline-none ring-brand-500/30 placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2"
                  />
                </div>
                {addVisit.isError ? (
                  <p className="text-xs text-red-600">{(addVisit.error as Error).message}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-4">
            {visitsQ.data?.map((v) => (
              <VisitCard
                key={v.id}
                clientId={clientId}
                visit={v}
                canEdit={!!canEdit}
                compare={compare}
                toggleCompare={toggleCompare}
                onRefresh={() => void qc.invalidateQueries({ queryKey: ['visits', clientId] })}
              />
            ))}
            {visitsQ.data?.length === 0 ? <p className="text-sm text-zinc-500">Визитов пока нет</p> : null}
          </div>

          {compare.length === 2 ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-medium">Сравнение (вручную)</h2>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <CompareSlotView clientId={clientId} slot={compare[0]} />
                <CompareSlotView clientId={clientId} slot={compare[1]} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === 'care' && isClient && !canEdit ? (
        <ClientCareView clientId={clientId} />
      ) : null}

      {tab === 'care' && canEdit ? (
        <div className="space-y-6">
          <CareHistoryView clientId={clientId} visits={visitsQ.data ?? []} />
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium">Подбор и PDF-схема</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Тип кожи</Label>
                  <select
                    className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 text-sm"
                    value={skin}
                    onChange={(e) => setSkin(e.target.value as (typeof SKIN)[number])}
                  >
                    {SKIN.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Задачи</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONCERNS_OPTS.map((x) => (
                      <button
                        key={x}
                        type="button"
                        onClick={() => toggleConcern(x)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                          concerns.includes(x)
                            ? 'bg-brand-600 text-white ring-brand-600'
                            : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-700'
                        }`}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => recommend.mutate()} disabled={recommend.isPending}>
                  Подобрать топ-3
                </Button>
                <Button variant="outline" onClick={() => createPlan.mutate()} disabled={!reco.length || createPlan.isPending}>
                  Создать план ухода
                </Button>
                {planId ? (
                  <Button variant="outline" onClick={() => void downloadPdf()}>
                    Скачать PDF
                  </Button>
                ) : null}
              </div>
              {reco.length ? (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  {reco.map((p) => (
                    <li key={p.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                      <span className="text-xs text-zinc-500">{p.skin_types.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {recommend.isError ? <p className="text-sm text-red-600">{(recommend.error as Error).message}</p> : null}
              {createPlan.isError ? <p className="text-sm text-red-600">{(createPlan.error as Error).message}</p> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

function CompareSlotView({ clientId, slot }: { clientId: number; slot: CompareSlot }) {
  const q = useQuery({
    queryKey: ['photos', clientId, slot.visitId],
    queryFn: () => apiJson<VisitPhoto[]>(`/clients/${clientId}/visits/${slot.visitId}/photos`),
  })
  const ph = q.data?.find((p) => p.id === slot.photoId)
  const url = ph ? absoluteFileUrl(ph.url) : ''
  return <img src={url} alt="" className="max-h-80 w-full rounded-lg object-contain ring-1 ring-zinc-100" />
}

function CareHistoryView({ clientId, visits }: { clientId: number; visits: Visit[] }) {
  const plansQ = useQuery({
    queryKey: ['care-plans', clientId],
    queryFn: () => apiJson<CarePlan[]>(`/clients/${clientId}/care-plans`),
  })

  const plansWithVisit = (plansQ.data ?? []).filter((p) => p.visit_id !== null)

  if (plansWithVisit.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-medium">История планов ухода по визитам</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {plansWithVisit.map((plan) => {
          const visit = visits.find((v) => v.id === plan.visit_id)
          const dateStr = plan.visit_date ?? visit?.visit_date ?? `#${plan.visit_id}`
          return (
            <div key={plan.id} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 text-sm">
              <p className="font-medium text-zinc-700 dark:text-zinc-300">
                Визит {dateStr} → план #{plan.id}
              </p>
              <p className="text-xs text-zinc-500">Тип кожи: {plan.skin_type} · {plan.concerns.join(', ')}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ProfileCard({
  client,
  canEdit,
  canEditFullName,
  clientId,
}: {
  client: Client
  canEdit: boolean
  canEditFullName: boolean
  clientId: number
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(client.full_name)
  const [phone, setPhone] = useState(client.phone ?? '')
  const [email, setEmail] = useState(client.email ?? '')
  const [birthDate, setBirthDate] = useState(client.birth_date ?? '')
  const [allergies, setAllergies] = useState(client.allergies ?? '')
  const [contra, setContra] = useState(client.contraindications ?? '')

  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {
        phone: normalizePhone(phone) || null,
        email: email.trim() || null,
        birth_date: birthDate || null,
        allergies: allergies.trim() || null,
        contraindications: contra.trim() || null,
      }
      if (canEditFullName) payload.full_name = fullName.trim()
      return apiJson<Client>(`/clients/${clientId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
    },
    onSuccess: () => {
      setEditing(false)
      void qc.invalidateQueries({ queryKey: ['client', clientId] })
      void qc.invalidateQueries({ queryKey: ['clients'] })
      void qc.invalidateQueries({ queryKey: ['client-home'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (!editing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Контакты и анамнез</h2>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              Редактировать
            </button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-zinc-400">Телефон</p>
            <p className="font-medium">{client.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-400">Email</p>
            <p className="font-medium">{client.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-zinc-400">Дата рождения</p>
            <p className="font-medium">{client.birth_date ?? '—'}</p>
          </div>
          <div />
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-zinc-400">Аллергии</p>
            <p className="whitespace-pre-wrap font-medium">{client.allergies ?? '—'}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs uppercase text-zinc-400">Противопоказания</p>
            <p className="whitespace-pre-wrap font-medium">{client.contraindications ?? '—'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Редактирование профиля</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            Сохранить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setFullName(client.full_name)
              setPhone(client.phone ?? '')
              setEmail(client.email ?? '')
              setBirthDate(client.birth_date ?? '')
              setAllergies(client.allergies ?? '')
              setContra(client.contraindications ?? '')
            }}
          >
            Отмена
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
        {canEditFullName ? (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName">ФИО</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bd">Дата рождения</Label>
          <Input id="bd" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="alg">Аллергии</Label>
          <textarea
            id="alg"
            rows={2}
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-2"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="contra">Противопоказания</Label>
          <textarea
            id="contra"
            rows={2}
            value={contra}
            onChange={(e) => setContra(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm outline-none ring-brand-500/30 focus:border-brand-500 focus:ring-2"
          />
        </div>
        {save.isError ? (
          <p className="text-xs text-red-600 sm:col-span-2">{(save.error as Error).message}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ClientCareView({ clientId }: { clientId: number }) {
  const [skin, setSkin] = useState<(typeof SKIN)[number]>('combination')
  const [concerns, setConcerns] = useState<string[]>(['dryness'])
  const [reco, setReco] = useState<Product[]>([])

  const plansQ = useQuery({
    queryKey: ['care-plans', clientId],
    queryFn: () => apiJson<CarePlan[]>(`/clients/${clientId}/care-plans`),
  })

  const recommend = useMutation({
    mutationFn: () =>
      apiJson<{ products: Product[] }>('/recommendations', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, skin_type: skin, concerns }),
      }),
    onSuccess: (d) => setReco(d.products),
  })

  const toggleConcern = (x: string) => {
    setConcerns((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]))
  }

  async function downloadPdf(planId: number) {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
    const res = await fetch(`${base}/care-plans/${planId}/pdf`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('bt_token')}` },
    })
    if (!res.ok) throw new Error('PDF error')
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `care-plan-${planId}.pdf`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium">Мой план ухода</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {plansQ.isLoading ? <p className="text-xs text-zinc-500">Загрузка…</p> : null}
          {!plansQ.isLoading && (plansQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">Врач пока не назначил план ухода.</p>
          ) : null}
          {plansQ.data?.map((plan) => {
            const morning = plan.items.filter((i) => i.period === 'morning')
            const evening = plan.items.filter((i) => i.period === 'evening')
            return (
              <div key={plan.id} className="space-y-3 rounded-xl border border-zinc-100 dark:border-zinc-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">Тип кожи: {plan.skin_type}</p>
                    {plan.concerns.length ? (
                      <p className="text-xs text-zinc-500">Задачи: {plan.concerns.join(', ')}</p>
                    ) : null}
                    {plan.visit_date ? (
                      <p className="text-xs text-brand-600">Назначен в визите {plan.visit_date}</p>
                    ) : null}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void downloadPdf(plan.id)}>
                    Скачать PDF
                  </Button>
                </div>
                {plan.notes ? <p className="text-xs text-zinc-500">{plan.notes}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <RoutineList title="Утро" items={morning} />
                  <RoutineList title="Вечер" items={evening} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-medium">Подобрать средства</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Тип кожи</Label>
              <select
                className="h-10 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 text-sm"
                value={skin}
                onChange={(e) => setSkin(e.target.value as (typeof SKIN)[number])}
              >
                {SKIN.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Задачи</Label>
              <div className="flex flex-wrap gap-2">
                {CONCERNS_OPTS.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => toggleConcern(x)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                      concerns.includes(x)
                        ? 'bg-brand-600 text-white ring-brand-600'
                        : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-700'
                    }`}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={() => recommend.mutate()} disabled={recommend.isPending}>
            Подобрать топ-3
          </Button>
          {reco.length ? (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl border border-zinc-100 dark:border-zinc-800">
              {reco.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</span>
                  <span className="text-xs text-zinc-500">{p.skin_types.join(', ')}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-zinc-400">
            Подбор информационный. План ухода назначает врач — обратитесь к нему, чтобы зафиксировать схему.
          </p>
          {recommend.isError ? (
            <p className="text-xs text-red-600">{(recommend.error as Error).message}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function RoutineList({ title, items }: { title: string; items: CarePlan['items'] }) {
  return (
    <div className="space-y-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">—</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-zinc-900 dark:text-zinc-100">
                {it.step_order + 1}. {it.product?.name ?? `#${it.product_id}`}
              </span>
              {it.frequency ? <span className="text-xs text-zinc-500">{it.frequency}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function VisitCard({
  clientId,
  visit,
  canEdit,
  compare,
  toggleCompare,
  onRefresh,
}: {
  clientId: number
  visit: Visit
  canEdit: boolean
  compare: CompareSlot[]
  toggleCompare: (visitId: number, photoId: number) => void
  onRefresh: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editDate, setEditDate] = useState(visit.visit_date)
  const [editNotes, setEditNotes] = useState(visit.notes ?? '')
  const [showCareForm, setShowCareForm] = useState(false)
  const [careSkin, setCareSkin] = useState<(typeof SKIN)[number]>('combination')
  const [careConcerns, setCareConcerns] = useState<string[]>(['dryness'])
  const [careReco, setCareReco] = useState<Product[]>([])

  const photosQ = useQuery({
    queryKey: ['photos', clientId, visit.id],
    queryFn: () => apiJson<VisitPhoto[]>(`/clients/${clientId}/visits/${visit.id}/photos`),
  })

  const visitPlansQ = useQuery({
    queryKey: ['care-plans', clientId, 'visit', visit.id],
    queryFn: () => apiJson<CarePlan[]>(`/clients/${clientId}/care-plans?visit_id=${visit.id}`),
  })

  const upload = useMutation({
    mutationFn: async (files: FileList | null) => {
      if (!files?.length) return
      const fd = new FormData()
      for (const f of Array.from(files)) fd.append('files', f)
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/clients/${clientId}/visits/${visit.id}/photos`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('bt_token')}` },
          body: fd,
        },
      )
      if (!res.ok) throw new Error(await res.text())
    },
    onSuccess: onRefresh,
  })

  const save = useMutation({
    mutationFn: () =>
      apiJson<Visit>(`/clients/${clientId}/visits/${visit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visit_date: editDate, notes: editNotes || null }),
      }),
    onSuccess: () => {
      setEditing(false)
      onRefresh()
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      apiJson<void>(`/clients/${clientId}/visits/${visit.id}`, {
        method: 'DELETE',
      }),
    onSuccess: onRefresh,
  })

  const careRecommend = useMutation({
    mutationFn: () =>
      apiJson<{ products: Product[] }>('/recommendations', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId, skin_type: careSkin, concerns: careConcerns }),
      }),
    onSuccess: (d) => setCareReco(d.products),
  })

  const createVisitPlan = useMutation({
    mutationFn: () => {
      const items = careReco.map((p, i) => ({
        product_id: p.id,
        period: i % 2 === 0 ? ('morning' as const) : ('evening' as const),
        step_order: Math.floor(i / 2),
        frequency: 'ежедневно',
      }))
      return apiJson<CarePlan>('/care-plans', {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          visit_id: visit.id,
          skin_type: careSkin,
          concerns: careConcerns,
          notes: `Назначено на визите ${visit.visit_date}`,
          items,
        }),
      })
    },
    onSuccess: () => {
      setShowCareForm(false)
      setCareReco([])
      void qc.invalidateQueries({ queryKey: ['care-plans', clientId] })
      void qc.invalidateQueries({ queryKey: ['care-plans', clientId, 'visit', visit.id] })
    },
  })

  const toggleCareConcern = (x: string) => {
    setCareConcerns((prev) => (prev.includes(x) ? prev.filter((y) => y !== x) : [...prev, x]))
  }

  const isSel = (pid: number) => compare.some((s) => s.visitId === visit.id && s.photoId === pid)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-2">
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Заметки врача о визите…"
                rows={3}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 py-2 text-sm outline-none ring-brand-500/30 placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2"
              />
              {save.isError ? <p className="text-xs text-red-600">{(save.error as Error).message}</p> : null}
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Визит {visit.visit_date}</p>
              {visit.notes ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-500">{visit.notes}</p>
              ) : (
                <p className="mt-1 text-xs text-zinc-400">Заметок нет</p>
              )}
            </>
          )}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-col items-end gap-2">
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
                  Сохранить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false)
                    setEditDate(visit.visit_date)
                    setEditNotes(visit.notes ?? '')
                  }}
                >
                  Отмена
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <div className="flex gap-3 text-xs font-medium">
                  <button type="button" onClick={() => setEditing(true)} className="text-brand-600 hover:underline">
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCareForm((v) => !v)}
                    className="text-brand-600 hover:underline"
                  >
                    Назначить уход
                  </button>
                  <label className="cursor-pointer text-brand-600 hover:underline">
                    Загрузить фото
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => upload.mutate(e.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Удалить визит вместе с фото?')) remove.mutate()
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
                {remove.isError ? (
                  <p className="text-xs text-red-600">{(remove.error as Error).message}</p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {showCareForm ? (
          <div className="rounded-lg border border-brand-100 bg-brand-50/30 dark:bg-zinc-800 p-4 space-y-3">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Назначить уход для визита</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Тип кожи</Label>
                <select
                  className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-zinc-100 px-3 text-sm"
                  value={careSkin}
                  onChange={(e) => setCareSkin(e.target.value as (typeof SKIN)[number])}
                >
                  {SKIN.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Задачи</Label>
                <div className="flex flex-wrap gap-1">
                  {CONCERNS_OPTS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      onClick={() => toggleCareConcern(x)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                        careConcerns.includes(x)
                          ? 'bg-brand-600 text-white ring-brand-600'
                          : 'bg-white dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-600'
                      }`}
                    >
                      {x}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => careRecommend.mutate()} disabled={careRecommend.isPending}>
                Подобрать топ-3
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => createVisitPlan.mutate()}
                disabled={!careReco.length || createVisitPlan.isPending}
              >
                Сохранить как план
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowCareForm(false); setCareReco([]) }}>
                Отмена
              </Button>
            </div>
            {careReco.length ? (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg border border-zinc-100 dark:border-zinc-800 text-sm">
                {careReco.map((p) => (
                  <li key={p.id} className="px-3 py-2 flex justify-between">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-zinc-500">{p.skin_types.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {createVisitPlan.isError ? (
              <p className="text-xs text-red-600">{(createVisitPlan.error as Error).message}</p>
            ) : null}
          </div>
        ) : null}

        {(visitPlansQ.data?.length ?? 0) > 0 ? (
          <div className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Назначенный уход</p>
            {visitPlansQ.data?.map((plan) => {
              const morning = plan.items.filter((i) => i.period === 'morning')
              const evening = plan.items.filter((i) => i.period === 'evening')
              return (
                <div key={plan.id} className="grid gap-2 sm:grid-cols-2">
                  <RoutineList title="Утро" items={morning} />
                  <RoutineList title="Вечер" items={evening} />
                </div>
              )
            })}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {photosQ.data?.map((ph) => (
            <button
              key={ph.id}
              type="button"
              onClick={() => toggleCompare(visit.id, ph.id)}
              className={`overflow-hidden rounded-lg ring-2 transition ${
                isSel(ph.id) ? 'ring-brand-600' : 'ring-transparent hover:ring-zinc-200'
              }`}
            >
              <img src={absoluteFileUrl(ph.url)} alt="" className="h-28 w-full object-cover" />
            </button>
          ))}
        </div>
        {photosQ.data?.length ? (
          <p className="text-xs text-zinc-400">Нажмите до двух снимков для блока сравнения ниже</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
