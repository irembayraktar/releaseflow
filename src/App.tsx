import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Logo from './components/Logo'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/NewRequest'
import ProjectDetail from './pages/ProjectDetail'

function ProtectedLayout() {
  const { session, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Yükleniyor…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/giris" replace />
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-100 via-fuchsia-50 to-sky-100">
      {/* Dekoratif renk lekeleri */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/35 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-300/40 blur-3xl" />
      </div>
      <header className="sticky top-0 z-10 border-b border-indigo-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Logo size={28} />
            ReleaseFlow
          </span>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 transition-colors hover:text-gray-900"
          >
            Çıkış yap
          </button>
        </div>
      </header>
      <div className="relative">
        <Outlet />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/giris" element={<Login />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/yeni-talep" element={<NewRequest />} />
            <Route path="/is/:id" element={<ProjectDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
