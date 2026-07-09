import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  Grid2X2,
  List,
  Map,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  TicketCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from './Projects.module.css';

type LeafletDefaultIconPrototype = L.Icon.Default & { _getIconUrl?: unknown };
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

interface Project {
  id: string;
  name: string;
  venue?: string;
  address?: string;
  managerId?: string;
  managerName?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
  updatedAt?: string;
  deviceCount?: number;
  orderCount?: number;
  openOrderCount?: number;
  overtimeOrderCount?: number;
  partCount?: number;
  lowStockCount?: number;
  inspectionPlanCount?: number;
}

type ViewMode = 'cards' | 'list' | 'map';

const STATUS_LABELS: Record<string, string> = {
  active: '运行中',
  maintenance: '维护期',
  closed: '已关闭',
};

const emptyForm = {
  name: '',
  venue: '',
  address: '',
  status: 'active',
  latitude: '',
  longitude: '',
};

function number(value?: number) {
  return Number(value || 0);
}

function statusClass(status?: string) {
  if (status === 'closed') return styles.statusClosed;
  if (status === 'maintenance') return styles.statusMaintenance;
  return styles.statusActive;
}

export default function Projects() {
  const navigate = useNavigate();
  const { user, currentProjectId, setCurrentProject } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const isAdmin = user?.role === 'admin';

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await apiClient.get<Project[]>('/projects/overview');
      setProjects(Array.isArray(list) ? list : []);
      setSelectedId(previous => {
        if (previous && list.some(project => project.id === previous)) return previous;
        return currentProjectId || list[0]?.id || '';
      });
    } catch (err) {
      setError(getErrorMessage(err, '项目概览加载失败'));
    } finally {
      setLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId),
    [projects, selectedId],
  );

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return projects.filter(project => {
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      const matchesKeyword = !keyword || [project.name, project.venue, project.address, project.managerName]
        .some(value => value?.toLowerCase().includes(keyword));
      return matchesStatus && matchesKeyword;
    });
  }, [projects, query, statusFilter]);

  const totals = useMemo(() => ({
    activeProjects: projects.filter(project => project.status === 'active').length,
    devices: projects.reduce((sum, project) => sum + number(project.deviceCount), 0),
    openOrders: projects.reduce((sum, project) => sum + number(project.openOrderCount), 0),
    risks: projects.reduce((sum, project) => sum + number(project.overtimeOrderCount) + number(project.lowStockCount), 0),
  }), [projects]);

  useEffect(() => {
    if (!selectedProject) {
      setForm(emptyForm);
      return;
    }
    setForm({
      name: selectedProject.name || '',
      venue: selectedProject.venue || '',
      address: selectedProject.address || '',
      status: selectedProject.status || 'active',
      latitude: selectedProject.latitude == null ? '' : String(selectedProject.latitude),
      longitude: selectedProject.longitude == null ? '' : String(selectedProject.longitude),
    });
  }, [selectedProject]);

  const selectProject = (project: Project, makeCurrent = false) => {
    setSelectedId(project.id);
    setNotice('');
    if (makeCurrent) setCurrentProject(project.id);
  };

  const handleNewProject = () => {
    setSelectedId('');
    setForm(emptyForm);
    setNotice('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('请填写项目名称');
      return;
    }

    const latitude = form.latitude === '' ? undefined : Number(form.latitude);
    const longitude = form.longitude === '' ? undefined : Number(form.longitude);
    if (latitude != null && (latitude < -90 || latitude > 90)) {
      setError('纬度必须在 -90 到 90 之间');
      return;
    }
    if (longitude != null && (longitude < -180 || longitude > 180)) {
      setError('经度必须在 -180 到 180 之间');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name.trim(),
        venue: form.venue.trim() || undefined,
        address: form.address.trim() || undefined,
        status: form.status,
        latitude,
        longitude,
      };
      const saved = selectedProject
        ? await apiClient.put<Project>(`/projects/${selectedProject.id}`, payload)
        : await apiClient.post<Project>('/projects', payload);
      setCurrentProject(saved.id);
      setSelectedId(saved.id);
      setNotice(selectedProject ? '项目资料已更新' : '新项目已创建，并已切换为当前项目');
      window.dispatchEvent(new Event('wlight:projects-changed'));
      await fetchProjects();
    } catch (err) {
      setError(getErrorMessage(err, '保存项目失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!selectedProject || deleting) return;
    const ok = window.confirm(`确定彻底删除项目“${selectedProject.name}”吗？该项目下的设备、工单、维修记录、备件和巡检数据都会删除，此操作不可恢复。`);
    if (!ok) return;

    setDeleting(true);
    setError('');
    setNotice('');
    try {
      const deletedId = selectedProject.id;
      await apiClient.delete(`/projects/${deletedId}`);
      const remaining = projects.filter(project => project.id !== deletedId);
      const nextProject = remaining[0];
      setProjects(remaining);
      setSelectedId(nextProject?.id || '');
      if (nextProject) setCurrentProject(nextProject.id);
      setNotice('项目已删除');
      window.dispatchEvent(new Event('wlight:projects-changed'));
      await fetchProjects();
    } catch (err) {
      setError(getErrorMessage(err, '删除项目失败'));
    } finally {
      setDeleting(false);
    }
  };

  const openModule = (path: string) => {
    if (!selectedProject) return;
    setCurrentProject(selectedProject.id);
    navigate(path);
  };

  const renderProjectCard = (project: Project) => {
    const current = currentProjectId === project.id;
    const riskCount = number(project.overtimeOrderCount) + number(project.lowStockCount);
    return (
      <article
        key={project.id}
        className={`${styles.projectCard} ${selectedId === project.id ? styles.selectedCard : ''}`}
        onClick={() => selectProject(project)}
      >
        <div className={styles.cardHeader}>
          <div className={styles.projectIdentity}>
            <div className={styles.projectIcon}><Building2 size={21} /></div>
            <div>
              <div className={styles.projectNameRow}>
                <h3>{project.name}</h3>
                {current && <span className={styles.currentBadge}>当前</span>}
              </div>
              <p>{project.venue || '未填写场馆/区域'}</p>
            </div>
          </div>
          <span className={`${styles.statusBadge} ${statusClass(project.status)}`}>
            {STATUS_LABELS[project.status || 'active'] || project.status}
          </span>
        </div>
        <div className={styles.locationLine}>
          <MapPin size={14} />
          <span>{project.address || '未填写项目地址'}</span>
        </div>
        <div className={styles.cardStats}>
          <div><strong>{number(project.deviceCount)}</strong><span>设备</span></div>
          <div><strong>{number(project.openOrderCount)}</strong><span>待办工单</span></div>
          <div><strong>{number(project.inspectionPlanCount)}</strong><span>巡检计划</span></div>
          <div className={riskCount > 0 ? styles.riskStat : ''}><strong>{riskCount}</strong><span>风险提醒</span></div>
        </div>
        <div className={styles.cardFooter}>
          <span>{project.managerName ? `负责人：${project.managerName}` : '暂未指定负责人'}</span>
          <button
            type="button"
            onClick={event => {
              event.stopPropagation();
              selectProject(project, true);
            }}
          >
            {current ? <CheckCircle2 size={15} /> : <ExternalLink size={15} />}
            {current ? '正在管理' : '进入项目'}
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>MULTI-PROJECT OPERATIONS</span>
          <h1>项目管理中心</h1>
          <p>统一管理多个景区、剧场、水秀、主题乐园或城市亮化项目，业务数据按项目独立隔离。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryButton} onClick={fetchProjects} disabled={loading}>
            <RefreshCw size={16} /> 刷新
          </button>
          {isAdmin && (
            <button className={styles.primaryButton} onClick={handleNewProject}>
              <Plus size={16} /> 新建项目
            </button>
          )}
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.green}`}><Building2 size={21} /></div>
          <div><span>项目总数</span><strong>{projects.length}</strong><small>{totals.activeProjects} 个正在运行</small></div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.blue}`}><Settings2 size={21} /></div>
          <div><span>设备资产</span><strong>{totals.devices}</strong><small>跨项目设备总量</small></div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${styles.amber}`}><TicketCheck size={21} /></div>
          <div><span>待办工单</span><strong>{totals.openOrders}</strong><small>所有项目未闭环</small></div>
        </div>
        <div className={styles.summaryCard}>
          <div className={`${styles.summaryIcon} ${totals.risks > 0 ? styles.red : styles.green}`}><AlertTriangle size={21} /></div>
          <div><span>运营风险</span><strong>{totals.risks}</strong><small>超时工单 + 低库存</small></div>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.projectBrowser}>
          <div className={styles.browserToolbar}>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目、场馆、地址或负责人" />
            </div>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="项目状态筛选">
              <option value="all">全部状态</option>
              <option value="active">运行中</option>
              <option value="maintenance">维护期</option>
              <option value="closed">已关闭</option>
            </select>
            <div className={styles.viewSwitch}>
              <button className={viewMode === 'cards' ? styles.activeView : ''} onClick={() => setViewMode('cards')} title="卡片视图"><Grid2X2 size={16} /></button>
              <button className={viewMode === 'list' ? styles.activeView : ''} onClick={() => setViewMode('list')} title="列表视图"><List size={16} /></button>
              <button className={viewMode === 'map' ? styles.activeView : ''} onClick={() => setViewMode('map')} title="地图视图"><Map size={16} /></button>
            </div>
          </div>

          <div className={styles.browserMeta}>
            <div>
              <h2>项目资产</h2>
              <p>当前显示 {filteredProjects.length} / {projects.length} 个项目</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>正在加载项目概览...</div>
          ) : filteredProjects.length === 0 ? (
            <div className={styles.empty}>没有符合条件的项目。</div>
          ) : viewMode === 'map' ? (
            <div className={styles.mapWrap}>
              <MapContainer center={[34.3, 108.9]} zoom={4} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {filteredProjects.filter(project => project.latitude != null && project.longitude != null).map(project => (
                  <Marker
                    key={project.id}
                    position={[project.latitude as number, project.longitude as number]}
                    eventHandlers={{ click: () => selectProject(project) }}
                  >
                    <Popup>
                      <strong>{project.name}</strong><br />
                      {project.venue || project.address || '暂无位置说明'}<br />
                      待办工单：{number(project.openOrderCount)}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : viewMode === 'list' ? (
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr><th>项目</th><th>状态</th><th>设备</th><th>全部工单</th><th>待办</th><th>风险</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {filteredProjects.map(project => (
                    <tr key={project.id} className={selectedId === project.id ? styles.selectedRow : ''} onClick={() => selectProject(project)}>
                      <td><strong>{project.name}</strong><span>{project.venue || project.address || '-'}</span></td>
                      <td><span className={`${styles.statusBadge} ${statusClass(project.status)}`}>{STATUS_LABELS[project.status || 'active']}</span></td>
                      <td>{number(project.deviceCount)}</td>
                      <td>{number(project.orderCount)}</td>
                      <td>{number(project.openOrderCount)}</td>
                      <td>{number(project.overtimeOrderCount) + number(project.lowStockCount)}</td>
                      <td><button onClick={event => { event.stopPropagation(); selectProject(project, true); }}>进入</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.projectGrid}>{filteredProjects.map(renderProjectCard)}</div>
          )}
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <span>{selectedProject ? 'PROJECT DETAIL' : 'NEW PROJECT'}</span>
              <h2>{selectedProject ? '项目详情与配置' : '创建新项目'}</h2>
            </div>
            {selectedProject && (
              <span className={`${styles.statusBadge} ${statusClass(selectedProject.status)}`}>
                {STATUS_LABELS[selectedProject.status || 'active']}
              </span>
            )}
          </div>

          {selectedProject && (
            <>
              <div className={styles.detailStats}>
                <button onClick={() => openModule('/devices')}><Settings2 size={18} /><strong>{number(selectedProject.deviceCount)}</strong><span>设备</span></button>
                <button onClick={() => openModule('/orders')}><TicketCheck size={18} /><strong>{number(selectedProject.openOrderCount)}</strong><span>待办</span></button>
                <button onClick={() => openModule('/parts')}><Package size={18} /><strong>{number(selectedProject.lowStockCount)}</strong><span>低库存</span></button>
                <button onClick={() => openModule('/inspections')}><ClipboardList size={18} /><strong>{number(selectedProject.inspectionPlanCount)}</strong><span>巡检</span></button>
              </div>
              <div className={styles.quickActions}>
                <button onClick={() => openModule('/dashboard')}><Boxes size={15} />项目概览</button>
                <button onClick={() => openModule('/orders')}><Wrench size={15} />工单运维</button>
                <button onClick={() => openModule('/reports')}><ExternalLink size={15} />查看报表</button>
                {isAdmin && (
                  <button
                    className={styles.quickDangerButton}
                    onClick={handleDeleteProject}
                    disabled={deleting || saving}
                  >
                    <Trash2 size={15} /> {deleting ? '删除中...' : '删除项目'}
                  </button>
                )}
              </div>
            </>
          )}

          {!isAdmin && <div className={styles.readonly}>当前账号只有查看权限，项目资料由管理员维护。</div>}

          <div className={styles.formGrid}>
            <label className={styles.fullField}>
              <span>项目名称 *</span>
              <input value={form.name} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} placeholder="例如：凤凰古城夜游灯光项目" disabled={!isAdmin} />
            </label>
            <label>
              <span>运行状态</span>
              <select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value }))} disabled={!isAdmin}>
                <option value="active">运行中</option>
                <option value="maintenance">维护期</option>
                <option value="closed">已关闭</option>
              </select>
            </label>
            <label>
              <span>场馆 / 运维区域</span>
              <input value={form.venue} onChange={event => setForm(previous => ({ ...previous, venue: event.target.value }))} placeholder="主舞台、水秀区、古城街区" disabled={!isAdmin} />
            </label>
            <label className={styles.fullField}>
              <span>项目详细地址</span>
              <input value={form.address} onChange={event => setForm(previous => ({ ...previous, address: event.target.value }))} placeholder="省 / 市 / 景区 / 具体位置" disabled={!isAdmin} />
            </label>
            <label>
              <span>经度</span>
              <input type="number" step="0.000001" value={form.longitude} onChange={event => setForm(previous => ({ ...previous, longitude: event.target.value }))} placeholder="120.155100" disabled={!isAdmin} />
            </label>
            <label>
              <span>纬度</span>
              <input type="number" step="0.000001" value={form.latitude} onChange={event => setForm(previous => ({ ...previous, latitude: event.target.value }))} placeholder="30.274100" disabled={!isAdmin} />
            </label>
          </div>

          <div className={styles.detailFooter}>
            {selectedProject && (
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  setCurrentProject(selectedProject.id);
                  setNotice(`已切换到：${selectedProject.name}`);
                }}
              >
                <Building2 size={16} /> 设为当前项目
              </button>
            )}
            {isAdmin && selectedProject && (
              <button className={styles.dangerButton} onClick={handleDeleteProject} disabled={deleting || saving}>
                <Trash2 size={16} /> {deleting ? '删除中...' : '删除项目'}
              </button>
            )}
            {isAdmin && (
              <button className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                {selectedProject ? <Edit3 size={16} /> : <Save size={16} />}
                {saving ? '保存中...' : selectedProject ? '保存修改' : '创建项目'}
              </button>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
