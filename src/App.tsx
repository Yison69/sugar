import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/Login'
import Setup from '@/pages/Setup'
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminWorks from '@/pages/admin/Works'
import AdminPackages from '@/pages/admin/Packages'
import AdminBookings from '@/pages/admin/Bookings'
import AdminSettings from '@/pages/admin/Settings'
import RequireAdmin from '@/pages/admin/RequireAdmin'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/works" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<Setup />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<Navigate to="/admin/works" replace />} />
          <Route path="works" element={<AdminWorks />} />
          <Route path="packages" element={<AdminPackages />} />
          <Route path="bookings" element={<AdminBookings />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/admin/works" replace />} />
      </Routes>
    </Router>
  )
}
