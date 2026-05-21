import { useQuery } from '@tanstack/react-query'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { apiJson } from '@/lib/api'
import type { Client } from '@/lib/types'
import { Badge, Button, ThemeToggle } from '@/components/ui'
import { cn } from '@/lib/utils'

const link = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
  )

export default function Layout() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()
  const isClient = user?.role === 'client'

  const meQ = useQuery({
    queryKey: ['client-me'],
    queryFn: () => apiJson<Client>('/clients/me'),
    enabled: isClient,
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => nav('/app')}
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              Beauty<span className="text-brand-600">Track</span>
            </button>
            <nav className="hidden items-center gap-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/80 p-1 sm:flex">
              <NavLink to="/app" end className={link}>
                Обзор
              </NavLink>
              {isClient ? (
                meQ.data ? (
                  <NavLink to={`/app/clients/${meQ.data.id}`} className={link}>
                    Моя карточка
                  </NavLink>
                ) : (
                  <span className={cn(link({ isActive: false }), 'cursor-not-allowed opacity-50')}>
                    Моя карточка
                  </span>
                )
              ) : (
                <NavLink to="/app/clients" className={link}>
                  Клиенты
                </NavLink>
              )}
              <NavLink to="/app/booking" className={link}>
                Запись
              </NavLink>
              {user?.role === 'admin' ? (
                <NavLink to="/app/admin" className={link}>
                  Админ
                </NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Badge>{user?.role === 'admin' ? 'Админ' : user?.role === 'doctor' ? 'Врач' : 'Клиент'}</Badge>
            <span className="hidden max-w-[140px] truncate text-sm text-zinc-600 dark:text-zinc-400 sm:inline">{user?.full_name}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              Выйти
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
