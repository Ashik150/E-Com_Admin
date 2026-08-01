import { Card, CardContent, Grid, Typography } from '@mui/material'
import { useAuth } from '../auth/useAuth'

export function HomePage() {
  const { user } = useAuth()
  return (
    <>
      <Typography variant="h4" fontWeight={800} mb={1}>Welcome, {user?.name}</Typography>
      <Typography color="text.secondary" mb={3}>Your dashboard access is controlled by the {user?.role.name} role.</Typography>
      <Grid container spacing={2}>
        {['Permission groups', 'Roles', 'Dashboard users'].map((label) => (
          <Grid size={{ xs: 12, md: 4 }} key={label}>
            <Card><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h5" fontWeight={700}>Manage securely</Typography></CardContent></Card>
          </Grid>
        ))}
      </Grid>
    </>
  )
}
