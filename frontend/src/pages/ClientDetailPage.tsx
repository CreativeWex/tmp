import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { absoluteFileUrl, apiJson } from '@/lib/api'
import type { CarePlan, Client, Product, Visit, VisitPhoto } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label, Tabs } from '@/components/ui'

const SKIN = ['dry', 'oily', 'combination', 'normal'] as const
const CONCERNS_OPTS = ['acne', 'pigmentation', 'rosacea', 'wrinkles', 'dryness']

type CompareSlot = { visitId: number; photoId: number }

export default function ClientDetailPage() {
  const { id } = useParams()
  const clientId = Number(id)
  const qc = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab] = useState('profile')
  const [visitDate, setVisitDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [compare, setCompare] = useState<CompareSlot[]>([])
  const [skin, setSkin] = useState<(typeof SKIN)[number]>('combination')
  const [concerns, setConcerns] = useState<string[]>(['dryness'])
  const [reco, setReco] = useState<Product[]>([])
  const [planId, setPlanId] = useState<number | null>(null)

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

  useEffect(() => {
    if (!canEdit && tab === 'care') setTab('profile')
  }, [canEdit, tab])

  const addVisit = useMutation({
    mutationFn: () =>
      apiJson<Visit>(`/clients/${clientId}/visits`, {
        method: 'POST',
        body: JSON.stringify({ visit_date: visitDate }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['visits', clientId] }),
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
    onSuccess: (p) => setPlanId(p.id),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{c?.full_name ?? '…'}</h1>
        <p className="text-sm text-zinc-500">Карточка клиента #{clientId}</p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'profile', label: 'Профиль' },
          { id: 'visits', label: 'Визиты и фото' },
          ...(canEdit ? [{ id: 'care', label: 'Уход' }] : []),
        ]}
      />

      {tab === 'profile' && c ? (
        <Card>
          <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase text-zinc-400">Телефон</p>
              <p className="font-medium">{c.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-zinc-400">Email</p>
              <p className="font-medium">{c.email ?? '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-zinc-400">Аллергии</p>
              <p className="font-medium">{c.allergies ?? '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase text-zinc-400">Противопоказания</p>
              <p className="font-medium">{c.contraindications ?? '—'}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'visits' ? (
        <div className="space-y-6">
          {canEdit ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-medium">Новый визит</h2>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label>Дата</Label>
                  <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
                </div>
                <Button onClick={() => addVisit.mutate()} disabled={addVisit.isPending}>
                  Создать визит
                </Button>
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
                <CompareSlot clientId={clientId} slot={compare[0]} />
                <CompareSlot clientId={clientId} slot={compare[1]} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {tab === 'care' && canEdit ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-medium">Подбор и PDF-схема</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Тип кожи</Label>
                <select
                  className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm"
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
                          : 'bg-white text-zinc-600 ring-zinc-200'
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
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-100">
                {reco.map((p) => (
                  <li key={p.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-zinc-900">{p.name}</span>
                    <span className="text-xs text-zinc-500">{p.skin_types.join(', ')}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {recommend.isError ? <p className="text-sm text-red-600">{(recommend.error as Error).message}</p> : null}
            {createPlan.isError ? <p className="text-sm text-red-600">{(createPlan.error as Error).message}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function CompareSlot({ clientId, slot }: { clientId: number; slot: CompareSlot }) {
  const q = useQuery({
    queryKey: ['photos', clientId, slot.visitId],
    queryFn: () => apiJson<VisitPhoto[]>(`/clients/${clientId}/visits/${slot.visitId}/photos`),
  })
  const ph = q.data?.find((p) => p.id === slot.photoId)
  const url = ph ? absoluteFileUrl(ph.url) : ''
  return <img src={url} alt="" className="max-h-80 w-full rounded-lg object-contain ring-1 ring-zinc-100" />
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
  const photosQ = useQuery({
    queryKey: ['photos', clientId, visit.id],
    queryFn: () => apiJson<VisitPhoto[]>(`/clients/${clientId}/visits/${visit.id}/photos`),
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

  const isSel = (pid: number) => compare.some((s) => s.visitId === visit.id && s.photoId === pid)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900">Визит {visit.visit_date}</p>
          <p className="text-xs text-zinc-500">{visit.notes ?? ''}</p>
        </div>
        {canEdit ? (
          <label className="cursor-pointer text-xs font-medium text-brand-600 hover:underline">
            Загрузить фото
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => upload.mutate(e.target.files)}
            />
          </label>
        ) : null}
      </CardHeader>
      <CardContent>
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
        <p className="mt-2 text-xs text-zinc-400">Нажмите до двух снимков для блока сравнения ниже</p>
      </CardContent>
    </Card>
  )
}
