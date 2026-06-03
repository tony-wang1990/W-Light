import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../api/client';
import { 
  LayoutDashboard, 
  Settings2, 
  Wrench, 
  Briefcase, 
  Package, 
  LogOut,
  User as UserIcon,
  Menu,
  ClipboardList,
  Users as UsersIcon
} from 'lucide-react';
import styles from './AdminLayout.module.css';

const MENU_ITEMS = [
  { path: '/dashboard', label: '控制台概览', icon: LayoutDashboard },
  { path: '/orders', label: '工单调度中心', icon: Briefcase },
  { path: '/devices', label: '设备台账管理', icon: Settings2 },
  { path: '/parts', label: '备件库存管理', icon: Package },
  { path: '/inspections', label: '巡检管理', icon: ClipboardList },
  { path: '/users', label: '用户权限管理', icon: UsersIcon },
  { path: '/toolbox', label: '专业工具箱', icon: Wrench },
];

interface ProjectOption {
  id: string;
  name?: string;
  projectName?: string;
}

type ProjectListResponse = ProjectOption[] | { items?: ProjectOption[] };

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const { user, currentProjectId, setCurrentProject, logout } = useAuthStore();
  const navigate = useNavigate();
  const fallbackProjects: ProjectOption[] = (user?.projectIds || []).map(id => ({ id, name: id.slice(0, 8) }));
  const projectOptions: ProjectOption[] = projects.length > 0 ? projects : fallbackProjects;

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setProjects([]);
      return;
    }

    apiClient.get<ProjectListResponse>('/projects')
      .then((res) => {
        if (cancelled) return;
        setProjects(Array.isArray(res) ? res : res.items || []);
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (currentProjectId) return;
    const firstProjectId = projectOptions[0]?.id;
    if (firstProjectId) setCurrentProject(firstProjectId);
  }, [currentProjectId, projectOptions, setCurrentProject]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBox}>W</div>
          {!collapsed && <span className={styles.logoText}>W-Light</span>}
        </div>

        <nav className={styles.navMenu}>
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <item.icon className={styles.navIcon} size={20} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={20} />
            {!collapsed && <span>退出系统</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              className={styles.collapseBtn}
              onClick={() => setCollapsed(!collapsed)}
            >
              <Menu size={20} />
            </button>
            <span className={styles.pageTitle}>控制中心</span>
          </div>
          <div className={styles.headerRight}>
            {projectOptions.length > 0 && (
              <select
                className={styles.projectSelect}
                value={currentProjectId || ''}
                onChange={(event) => setCurrentProject(event.target.value)}
                aria-label="Current project"
                title="Current project"
              >
                <option value="" disabled>Project</option>
                {projectOptions.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name || project.projectName || project.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.userInfo}>
              <UserIcon size={18} />
              <span>{user?.name || '管理员'}</span>
              <span className={styles.roleTag}>Admin</span>
            </div>
          </div>
        </header>

        <main key={currentProjectId || 'no-project'} className={styles.mainContent}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
