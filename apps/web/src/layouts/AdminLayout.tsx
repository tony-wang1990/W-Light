import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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

export const MENU_ITEMS = [
  { path: '/dashboard', label: '控制概览', title: '控制台概览', icon: LayoutDashboard },
  { path: '/orders', label: '工单调度', title: '工单调度中心', icon: Briefcase },
  { path: '/maintenance', label: '维修台账', title: '维修记录台账', icon: FileText },
  { path: '/inspections', label: '巡检管理', icon: ClipboardList, roles: ['admin', 'engineer', 'inspector'] },
  { path: '/devices', label: '设备台账', title: '设备台账管理', icon: Settings2, roles: ['admin', 'engineer', 'inspector', 'viewer'] },
  { path: '/parts', label: '备件库存', title: '备件库存管理', icon: Package, roles: ['admin', 'engineer', 'inspector', 'viewer'] },
  { path: '/reports', label: '报表数据', title: '报表与数据', icon: BarChart3, roles: ['admin', 'viewer'] },
  { path: '/downloads', label: '数据下载', title: '数据下载中心', icon: Download, roles: ['admin', 'viewer'] },
  { path: '/projects', label: '项目管理', icon: Building2, roles: ['admin'] },
  { path: '/users', label: '权限管理', title: '用户权限管理', icon: UsersIcon, roles: ['admin'] },
  { path: '/toolbox', label: '专业工具', title: '专业工具箱', icon: Wrench },
  { path: '/clients', label: '终端下载', title: '客户端下载中心', icon: DownloadCloud },
];

function canAccessMenuItem(item: typeof MENU_ITEMS[number], role?: string) {
  return !item.roles || item.roles.includes(role || '');
}

interface ProjectOption {
  id: string;
  name?: string;
  projectName?: string;
}

type ProjectListResponse = ProjectOption[] | { items?: ProjectOption[] };

function roleLabel(role?: string) {
  switch (role) {
    case 'admin': return '管理员';
    case 'engineer': return '维修工程师';
    case 'inspector': return '巡检员';
    case 'viewer': return '只读用户';
    default: return role || '用户';
  }
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const { user, currentProjectId, setCurrentProject, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

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
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const matchedItem = MENU_ITEMS.find(item => (
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
    ));
    if (matchedItem && !canAccessMenuItem(matchedItem, user.role)) {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate, user]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

  const handleMenuToggle = () => {
    if (window.matchMedia('(max-width: 760px)').matches) {
      setMobileMenuOpen(open => !open);
      return;
    }
    setCollapsed(value => !value);
  };

  const visibleMenuItems = MENU_ITEMS.filter(item => canAccessMenuItem(item, user?.role));

  if (!user) return null;

  return (
    <div className={styles.layout}>
      {mobileMenuOpen && (
        <button
          className={styles.mobileBackdrop}
          aria-label="关闭导航菜单"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileMenuOpen ? styles.mobileOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoBox}>W</div>
          {!collapsed && <span className={styles.logoText}>W-Light</span>}
        </div>

        <nav className={styles.navMenu}>
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
              title={item.title || item.label}
            >
              <item.icon className={styles.navIcon} size={20} />
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
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
              onClick={handleMenuToggle}
              aria-label="折叠菜单"
              aria-expanded={mobileMenuOpen}
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
