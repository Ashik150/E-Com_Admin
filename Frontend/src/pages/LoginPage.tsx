import LockOutlined from '@mui/icons-material/LockOutlined'
import { Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { apiErrorMessage } from '../lib/api'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password)
      navigate('/')
    } catch (requestError) {
      setError(apiErrorMessage(requestError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', p: 2, background: 'linear-gradient(135deg,#eef2ff,#f8fafc 55%,#ecfeff)' }}>
      <Card sx={{ width: '100%', maxWidth: 430, boxShadow: 8 }}>
        <CardContent sx={{ p: 4 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mx: 'auto', mb: 2 }}><LockOutlined /></Avatar>
          <Typography variant="h4" textAlign="center" fontWeight={700}>Trends Bird Admin</Typography>
          <Typography color="text.secondary" textAlign="center" mb={3}>Sign in to manage the dashboard</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={submit} display="grid" gap={2}>
            <TextField label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            <TextField label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            <Button type="submit" size="large" variant="contained" disabled={submitting}>
              {submitting ? <CircularProgress size={24} /> : 'Sign in'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
