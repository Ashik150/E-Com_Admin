import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { PermissionRoute, ProtectedRoute } from './components/ProtectedRoute'
import { DashboardLayout } from './layout/DashboardLayout'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PermissionPage } from './pages/PermissionPage'
import { RolePage } from './pages/RolePage'
import { UserPage } from './pages/UserPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 15_000 },
    mutations: { retry: 0 },
  },
})

const theme = createTheme({
  palette: { mode: 'light', primary: { main: '#4f46e5' }, secondary: { main: '#0891b2' } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  components: {
    MuiCard: { styleOverrides: { root: { border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(15,23,42,.06)' } } },
    MuiTableHead: { styleOverrides: { root: { background: '#f8fafc' } } },
  },
})

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<PermissionRoute permission="dashboard:watch"><HomePage /></PermissionRoute>} />
                <Route path="permissions" element={<PermissionRoute permission="permission:watch"><PermissionPage /></PermissionRoute>} />
                <Route path="roles" element={<PermissionRoute permission="role:watch"><RolePage /></PermissionRoute>} />
                <Route path="users" element={<PermissionRoute permission="user:watch"><UserPage /></PermissionRoute>} />
                <Route path="forbidden" element={<ForbiddenPage />} />
              </Route>
              <Route path="*" element={<ForbiddenPage />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
