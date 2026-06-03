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

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/inspections" element={<Inspections />} />
          <Route path="/users" element={<Users />} />
          <Route path="/toolbox" element={<Toolbox />} />
        </Route>
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
