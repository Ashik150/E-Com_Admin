import BlockOutlined from '@mui/icons-material/BlockOutlined'
import { Alert, Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <Box maxWidth={640} mx="auto" py={8} textAlign="center">
      <BlockOutlined color="error" sx={{ fontSize: 72 }} />
      <Typography variant="h4" fontWeight={800} my={2}>Access denied</Typography>
      <Alert severity="error" sx={{ mb: 3 }}>Your role does not have permission to open this screen.</Alert>
      <Button component={Link} to="/" variant="contained">Back to dashboard</Button>
    </Box>
  )
}
