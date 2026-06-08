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
import Maintenance from './pages/Maintenance/Maintenance';
import Reports from './pages/Reports/Reports';
import Clients from './pages/Clients/Clients';
import ScanPage from './pages/Scan/ScanPage';
import Downloads from './pages/Downloads/Downloads';

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* 公开扫码页（无需登录） */}
        <Route path="/scan/:qrCode" element={<ScanPage />} />
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/inspections" element={<Inspections />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/users" element={<Users />} />
          <Route path="/toolbox" element={<Toolbox />} />
          <Route path="/clients" element={<Clients />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
