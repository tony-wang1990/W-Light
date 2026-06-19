import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login/Login';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import Devices from './pages/Devices/Devices';
import Orders from './pages/Orders/Orders';
import Parts from './pages/Parts/Parts';
import Toolbox from './pages/Toolbox/Toolbox';
import Inspections from './pages/Inspections/Inspections';
import Users from './pages/Users/Users';
import Projects from './pages/Projects/Projects';
import Downloads from './pages/Downloads/Downloads';
import Maintenance from './pages/Maintenance/Maintenance';
import Reports from './pages/Reports/Reports';
import Clients from './pages/Clients/Clients';
import ScanPage from './pages/Scan/ScanPage';

export const PROTECTED_ROUTES = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/projects', element: <Projects /> },
  { path: '/devices', element: <Devices /> },
  { path: '/orders', element: <Orders /> },
  { path: '/maintenance', element: <Maintenance /> },
  { path: '/parts', element: <Parts /> },
  { path: '/inspections', element: <Inspections /> },
  { path: '/reports', element: <Reports /> },
  { path: '/downloads', element: <Downloads /> },
  { path: '/users', element: <Users /> },
  { path: '/toolbox', element: <Toolbox /> },
  { path: '/clients', element: <Clients /> },
] as const;

function App() {
  const Router = ['file:', 'wlight:'].includes(window.location.protocol) ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 公开扫码页（无需登录） */}
        <Route path="/scan/:qrCode" element={<ScanPage />} />
        <Route element={<AdminLayout />}>
          {PROTECTED_ROUTES.map(route => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
