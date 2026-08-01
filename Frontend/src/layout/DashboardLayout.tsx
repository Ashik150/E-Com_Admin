import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined'
import DashboardOutlined from '@mui/icons-material/DashboardOutlined'
import GroupOutlined from '@mui/icons-material/GroupOutlined'
import LogoutOutlined from '@mui/icons-material/LogoutOutlined'
import MenuOutlined from '@mui/icons-material/MenuOutlined'
import SecurityOutlined from '@mui/icons-material/SecurityOutlined'
import PermMediaOutlined from '@mui/icons-material/PermMediaOutlined'
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const drawerWidth = 250

export function DashboardLayout() {
  const { user, logout, hasPermission } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const entries = [
    { label: 'Dashboard', path: '/', permission: 'dashboard:watch', icon: <DashboardOutlined /> },
    { label: 'Permissions', path: '/permissions', permission: 'permission:watch', icon: <SecurityOutlined /> },
    { label: 'Roles', path: '/roles', permission: 'role:watch', icon: <AdminPanelSettingsOutlined /> },
    { label: 'Users', path: '/users', permission: 'user:watch', icon: <GroupOutlined /> },
    { label: 'Media', path: '/media', permission: 'media:watch', icon: <PermMediaOutlined /> },
  ].filter((entry) => hasPermission(entry.permission))

  const drawer = (
    <Box height="100%" display="flex" flexDirection="column">
      <Toolbar><Typography variant="h6" fontWeight={800}>TRENDS BIRD</Typography></Toolbar>
      <Divider />
      <List sx={{ px: 1, flex: 1 }}>
        {entries.map((entry) => (
          <ListItemButton
            key={entry.path}
            component={NavLink}
            to={entry.path}
            end={entry.path === '/'}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 2, mb: .5, '&.active': { bgcolor: 'primary.main', color: 'primary.contrastText', '& .MuiListItemIcon-root': { color: 'inherit' } } }}
          >
            <ListItemIcon>{entry.icon}</ListItemIcon>
            <ListItemText primary={entry.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box p={2} display="flex" alignItems="center" gap={1.5}>
        <Avatar>{user?.name.charAt(0).toUpperCase()}</Avatar>
        <Box minWidth={0} flex={1}>
          <Typography fontWeight={700} noWrap>{user?.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{user?.role.name}</Typography>
        </Box>
        <Tooltip title="Logout"><IconButton onClick={() => void logout()}><LogoutOutlined /></IconButton></Tooltip>
      </Box>
    </Box>
  )

  return (
    <Box display="flex" minHeight="100vh" bgcolor="grey.50">
      <AppBar position="fixed" elevation={0} sx={{ ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` }, bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <IconButton sx={{ display: { md: 'none' }, mr: 1 }} onClick={() => setMobileOpen(true)}><MenuOutlined /></IconButton>
          <Typography variant="h6" fontWeight={700}>Administration</Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer>
        <Drawer variant="permanent" open sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>{drawer}</Drawer>
      </Box>
      <Box component="main" flex={1} minWidth={0} p={{ xs: 2, md: 3 }} mt={8}>
        <Outlet />
      </Box>
    </Box>
  )
}
