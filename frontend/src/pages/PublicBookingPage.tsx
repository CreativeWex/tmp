import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import type { ClinicPublic, Slot } from '@/lib/types'
import { Button, Card, CardContent, CardHeader, Input, Label } from '@/components/ui'

export default function PublicBookingPage() {
  const { slug } = useParams()
  const [step, setStep] = useState(0)
  const [procId, setProcId] = useState<number | ''>('')
  const [doctorId, setDoctorId] = useState<number | ''>('')
  const [day, setDay] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [slot, setSlot] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [apptId, setApptId] = useState<number | null>(null)

  const clinicQ = useQuery({
    queryKey: ['pub', slug],
    queryFn: () => apiJson<ClinicPublic>(`/public/clinics/${slug}`),
    enabled: !!slug,
  })

  const slotsQ = useQuery({
    queryKey: ['pubslots', slug, doctorId, procId, day],
    queryFn: () =>
      apiJson<Slot[]>(
        `/public/clinics/${slug}/slots?doctor_user_id=${doctorId}&procedure_id=${procId}&day=${day}`,
      ),
    enabled: !!slug && !!doctorId && !!procId,
  })

  const sendOtp = useMutation({
    mutationFn: () =>
      apiJson<{ ok: boolean; dev_code?: string }>('/public/otp/send', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      }),
    onSuccess: (data) => {
      setOtpSent(true)
      setDevCode(data.dev_code ?? null)
    },
  })

  const book = useMutation({
    mutationFn: () =>
      apiJson<{ appointment_id: number; cancellation_token: string }>(`/public/clinics/${slug}/book`, {
        method: 'POST',
        body: JSON.stringify({
          doctor_user_id: doctorId,
          procedure_id: procId,
          start_at: slot,
          guest_name: name,
          guest_phone: phone,
          guest_email: email.trim() ? email.trim() : null,
          otp_code: otpCode,
        }),
      }),
  })

  if (!slug) return null

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-brand-50/40 px-4 py-12">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Онлайн-запись</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{clinicQ.data?.name ?? 'Клиника'}</h1>
          <p className="mt-1 text-sm text-zinc-500">Выберите процедуру, врача и удобное время</p>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex gap-2 text-xs font-medium text-zinc-500">
              <span className={step >= 0 ? 'text-brand-600' : ''}>1. Процедура</span>
              <span>→</span>
              <span className={step >= 1 ? 'text-brand-600' : ''}>2. Врач</span>
              <span>→</span>
              <span className={step >= 2 ? 'text-brand-600' : ''}>3. Время</span>
              <span>→</span>
              <span className={step >= 3 ? 'text-brand-600' : ''}>4. Контакты</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 0 ? (
              <div className="space-y-2">
                <Label>Процедура</Label>
                <select
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={procId === '' ? '' : String(procId)}
                  onChange={(e) => setProcId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Выберите</option>
                  {clinicQ.data?.procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button className="w-full" disabled={!procId} onClick={() => setStep(1)}>
                  Далее
                </Button>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-2">
                <Label>Врач</Label>
                <select
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm"
                  value={doctorId === '' ? '' : String(doctorId)}
                  onChange={(e) => setDoctorId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Выберите</option>
                  {clinicQ.data?.doctors.map((d) => (
                    <option key={d.user_id} value={d.user_id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(0)}>
                    Назад
                  </Button>
                  <Button className="flex-1" disabled={!doctorId} onClick={() => setStep(2)}>
                    Далее
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-3">
                <Label>Дата</Label>
                <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-zinc-100 p-2">
                  {slotsQ.data?.map((s) => (
                    <button
                      key={s.start_at}
                      type="button"
                      onClick={() => setSlot(s.start_at)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                        slot === s.start_at ? 'bg-brand-50 text-brand-900' : 'hover:bg-zinc-50'
                      }`}
                    >
                      {format(new Date(s.start_at), 'dd.MM.yyyy HH:mm')}
                    </button>
                  ))}
                  {slotsQ.data?.length === 0 ? <p className="text-xs text-zinc-500">Нет слотов</p> : null}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    Назад
                  </Button>
                  <Button className="flex-1" disabled={!slot} onClick={() => setStep(3)}>
                    Далее
                  </Button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Как к вам обращаться" disabled={otpSent} />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <div className="flex gap-2">
                    <Input
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); setOtpSent(false); setOtpCode(''); setDevCode(null) }}
                      placeholder="+7…"
                      disabled={otpSent}
                      className="flex-1"
                    />
                    {!otpSent && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!phone.trim() || !name.trim() || sendOtp.isPending}
                        onClick={() => sendOtp.mutate()}
                      >
                        {sendOtp.isPending ? '…' : 'Отправить код'}
                      </Button>
                    )}
                    {otpSent && (
                      <Button type="button" variant="outline" onClick={() => { setOtpSent(false); setOtpCode(''); setDevCode(null) }}>
                        Изменить
                      </Button>
                    )}
                  </div>
                  {sendOtp.isError ? <p className="text-xs text-red-600">{(sendOtp.error as Error).message}</p> : null}
                </div>

                {otpSent && (
                  <div className="space-y-2">
                    <Label>Код из СМС</Label>
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      inputMode="numeric"
                    />
                    {devCode && (
                      <p className="text-xs text-zinc-400">
                        Demo-режим: код <span className="font-mono font-semibold text-zinc-600">{devCode}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Email (необязательно)</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    Назад
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!otpSent || !otpCode.trim() || book.isPending}
                    onClick={async () => {
                      const r = await book.mutateAsync()
                      setToken(r.cancellation_token)
                      setApptId(r.appointment_id)
                      setStep(4)
                    }}
                  >
                    {book.isPending ? 'Отправка…' : 'Записаться'}
                  </Button>
                </div>
                {book.isError ? <p className="text-xs text-red-600">{(book.error as Error).message}</p> : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-2 text-sm text-zinc-700">
                <p className="font-medium text-emerald-700">Вы записаны.</p>
                <p className="text-zinc-500">Ждём вас в назначённое время!</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
