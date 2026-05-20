import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const link = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900',
  )

export default function Layout() {
  const { user, signOut } = useAuth()
  const nav = useNavigate()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => nav('/app')}
              className="text-lg font-semibold tracking-tight text-zinc-900"
            >
              Beauty<span className="text-brand-600">Track</span>
            </button>
            <nav className="hidden items-center gap-1 rounded-xl bg-zinc-100/80 p-1 sm:flex">
              <NavLink to="/app" end className={link}>
                Обзор
              </NavLink>
              {user?.role === 'admin' || user?.role === 'doctor' ? (
                <NavLink to="/app/clients" className={link}>
                  Клиенты
                </NavLink>
              ) : (
                <NavLink to="/app/clients" className={link}>
                  Моя карточка
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
            <Badge>{user?.role === 'admin' ? 'Админ' : user?.role === 'doctor' ? 'Врач' : 'Клиент'}</Badge>
            <span className="hidden max-w-[140px] truncate text-sm text-zinc-600 sm:inline">{user?.full_name}</span>
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
