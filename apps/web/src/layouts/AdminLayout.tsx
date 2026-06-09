import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  Download,
  DownloadCloud,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings2,
  User as UserIcon,
  Users as UsersIcon,
  Wrench,
} from 'lucide-react';
import { apiClient } from '../api/client';
import { isValidProjectId, useAuthStore } from '../store/authStore';
import styles from './AdminLayout.module.css';

const MENU_ITEMS = [
  { path: '/dashboard', label: '控制台概览', icon: LayoutDashboard },
  { path: '/orders', label: '工单调度中心', icon: Briefcase },
  { path: '/maintenance', label: '维修记录台账', icon: FileText },
  { path: '/inspections', label: '巡检管理', icon: ClipboardList, roles: ['admin', 'engineer', 'inspector'] },
  { path: '/devices', label: '设备台账管理', icon: Settings2, roles: ['admin', 'engineer'] },
  { path: '/parts', label: '备件库存管理', icon: Package, roles: ['admin', 'engineer'] },
  { path: '/reports', label: '报表与数据', icon: BarChart3, roles: ['admin', 'viewer'] },
  { path: '/downloads', label: '数据下载中心', icon: Download, roles: ['admin', 'viewer'] },
  { path: '/projects', label: '项目管理', icon: Building2, roles: ['admin'] },
  { path: '/users', label: '用户权限管理', icon: UsersIcon, roles: ['admin'] },
  { path: '/toolbox', label: '专业工具箱', icon: Wrench },
  { path: '/clients', label: '客户端下载中心', icon: DownloadCloud },
];

interface ProjectOption {
  id: string;
  name?: string;
  projectName?: string;
}

type ProjectListResponse = ProjectOption[] | { items?: ProjectOption[] };

function roleLabel(role?: string) {
  switch (role) {
    case 'admin': return 'Admin';
    case 'engineer': return 'Engineer';
    case 'inspector': return 'Inspector';
    case 'viewer': return 'Viewer';
    default: return role || 'User';
  }
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const { user, currentProjectId, setCurrentProject, logout } = useAuthStore();
  const navigate = useNavigate();

  const fallbackProjects: ProjectOption[] = useMemo(
    () => (user?.projectIds || []).map(id => ({ id, name: id.slice(0, 8) })),
    [user?.projectIds],
  );
  const projectOptions = projects.length > 0 ? projects : fallbackProjects;

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
    const validProjectIds = projectOptions.map(project => project.id).filter(isValidProjectId);
    if (currentProjectId && validProjectIds.includes(currentProjectId)) return;
    const firstProjectId = validProjectIds[0];
    if (firstProjectId) setCurrentProject(firstProjectId);
  }, [currentProjectId, projectOptions, setCurrentProject]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBox}>W</div>
          {!collapsed && <span className={styles.logoText}>W-Light</span>}
        </div>

        <nav className={styles.navMenu}>
          {MENU_ITEMS.filter(item => !item.roles || item.roles.includes(user?.role || '')).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              title={item.label}
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

      <div className={styles.mainWrapper}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.collapseBtn}
              onClick={() => setCollapsed(!collapsed)}
              aria-label="折叠菜单"
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
                aria-label="当前项目"
                title="当前项目"
              >
                <option value="" disabled>选择项目</option>
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
              <span className={styles.roleTag}>{roleLabel(user?.role)}</span>
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
