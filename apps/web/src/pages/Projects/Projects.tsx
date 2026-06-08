import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Map, List, Plus, RefreshCw, Save } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

// Fix leaflet icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

interface Project {
  id: string;
  name: string;
  venue?: string;
  address?: string;
  managerId?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  createdAt?: string;
}

type ProjectResponse = Project[] | { items?: Project[] };

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

function normalizeProjects(res: ProjectResponse) {
  return Array.isArray(res) ? res : res.items || [];
}

export default function Projects() {
  const { user, currentProjectId, setCurrentProject } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const isAdmin = user?.role === 'admin';

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get<ProjectResponse>('/projects');
      const list = normalizeProjects(res);
      setProjects(list);
      const nextId = selectedId || currentProjectId || list[0]?.id || '';
      setSelectedId(nextId);
    } catch (err) {
      setError(getErrorMessage(err, '项目列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [currentProjectId, selectedId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const selectedProject = useMemo(
    () => projects.find(project => project.id === selectedId),
    [projects, selectedId],
  );

  useEffect(() => {
    if (selectedProject) {
      setForm({
        name: selectedProject.name || '',
        venue: selectedProject.venue || '',
        address: selectedProject.address || '',
        status: selectedProject.status || 'active',
        latitude: selectedProject.latitude ? String(selectedProject.latitude) : '',
        longitude: selectedProject.longitude ? String(selectedProject.longitude) : '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [selectedProject]);

  const handleNewProject = () => {
    setSelectedId('');
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      window.alert('请填写项目名称');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        venue: form.venue.trim() || undefined,
        address: form.address.trim() || undefined,
        status: form.status,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      };

      const saved = selectedProject
        ? await apiClient.put<Project>(`/projects/${selectedProject.id}`, payload)
        : await apiClient.post<Project>('/projects', payload);

      setCurrentProject(saved.id);
      setSelectedId(saved.id);
      await fetchProjects();
    } catch (err) {
      const message = getErrorMessage(err, '保存项目失败');
      setError(message);
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>项目管理</h1>
          <p className={styles.pageSubtitle}>维护文旅项目、场馆位置和运行状态；所有工单、设备、巡检与备件数据都会按项目隔离。</p>
        </div>
        <div className={styles.actions}>
          <div style={{ display: 'flex', background: '#F3F4F6', padding: 4, borderRadius: 8, marginRight: 8 }}>
            <button
              onClick={() => setViewMode('list')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', background: viewMode === 'list' ? 'white' : 'transparent', borderRadius: 6, cursor: 'pointer', boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 'list' ? 600 : 400 }}
            >
              <List size={16} /> 列表
            </button>
            <button
              onClick={() => setViewMode('map')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: 'none', background: viewMode === 'map' ? 'white' : 'transparent', borderRadius: 6, cursor: 'pointer', boxShadow: viewMode === 'map' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: viewMode === 'map' ? 600 : 400 }}
            >
              <Map size={16} /> 地图
            </button>
          </div>
          <button className={styles.secondaryBtn} onClick={fetchProjects} disabled={loading}>
            <RefreshCw size={16} /> 刷新
          </button>
          {isAdmin && (
            <button className={styles.primaryBtn} onClick={handleNewProject}>
              <Plus size={16} /> 新建项目
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.wideGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>项目列表</h2>
            <span className={styles.muted}>共 {projects.length} 个项目</span>
          </div>

          {loading ? (
            <div className={styles.empty}>加载中...</div>
          ) : projects.length === 0 ? (
            <div className={styles.empty}>暂无项目，请先创建一个项目用于现场运维。</div>
          ) : viewMode === 'map' ? (
            <div style={{ height: '600px', width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
              <MapContainer center={[30.2741, 120.1551]} zoom={5} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {projects.filter(p => p.latitude && p.longitude).map(project => (
                  <Marker
                    key={project.id}
                    position={[project.latitude!, project.longitude!]}
                    eventHandlers={{ click: () => { setSelectedId(project.id); setCurrentProject(project.id); } }}
                  >
                    <Popup>
                      <strong>{project.name}</strong><br />
                      {project.address}<br />
                      状态: {STATUS_LABELS[project.status || 'active'] || project.status}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>项目名称</th>
                    <th>场馆</th>
                    <th>地址</th>
                    <th>状态</th>
                    <th>创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map(project => (
                    <tr
                      key={project.id}
                      onClick={() => {
                        setSelectedId(project.id);
                        setCurrentProject(project.id);
                      }}
                      style={{ cursor: 'pointer', background: selectedId === project.id ? '#EFF6FF' : '' }}
                    >
                      <td><strong>{project.name}</strong></td>
                      <td>{project.venue || '-'}</td>
                      <td>{project.address || '-'}</td>
                      <td>
                        <span className={`${styles.badge} ${project.status === 'closed' ? styles.dangerBadge : project.status === 'maintenance' ? styles.warningBadge : styles.successBadge}`}>
                          {STATUS_LABELS[project.status || 'active'] || project.status}
                        </span>
                      </td>
                      <td>{project.createdAt ? new Date(project.createdAt).toLocaleDateString('zh-CN') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{selectedProject ? '编辑项目' : '新建项目'}</h2>
            {selectedProject && <span className={styles.badge}>{currentProjectId === selectedProject.id ? '当前项目' : '可切换'}</span>}
          </div>

          {!isAdmin && (
            <div className={styles.error}>当前账号不是管理员，只能查看项目，不能创建或编辑。</div>
          )}

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>项目名称 *</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
                placeholder="例如：西湖夜游灯光项目"
                disabled={!isAdmin}
              />
            </div>
            <div className={styles.formGroup}>
              <label>运行状态</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={event => setForm(prev => ({ ...prev, status: event.target.value }))}
                disabled={!isAdmin}
              >
                <option value="active">运行中</option>
                <option value="maintenance">维护期</option>
                <option value="closed">已关闭</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>场馆/区域</label>
              <input
                className={styles.input}
                value={form.venue}
                onChange={event => setForm(prev => ({ ...prev, venue: event.target.value }))}
                placeholder="例如：主舞台 / 水秀区"
                disabled={!isAdmin}
              />
            </div>
            <div className={styles.formGroup}>
              <label>地址</label>
              <input
                className={styles.input}
                value={form.address}
                onChange={event => setForm(prev => ({ ...prev, address: event.target.value }))}
                placeholder="项目详细地址"
                disabled={!isAdmin}
              />
            </div>
            <div className={styles.formGroup}>
              <label>经度 (Longitude)</label>
              <input
                className={styles.input}
                type="number"
                step="0.000001"
                value={form.longitude}
                onChange={event => setForm(prev => ({ ...prev, longitude: event.target.value }))}
                placeholder="例如：120.1551"
                disabled={!isAdmin}
              />
            </div>
            <div className={styles.formGroup}>
              <label>纬度 (Latitude)</label>
              <input
                className={styles.input}
                type="number"
                step="0.000001"
                value={form.latitude}
                onChange={event => setForm(prev => ({ ...prev, latitude: event.target.value }))}
                placeholder="例如：30.2741"
                disabled={!isAdmin}
              />
            </div>
          </div>

          <div className={styles.actions} style={{ marginTop: 16 }}>
            <button className={styles.secondaryBtn} onClick={() => selectedProject && setCurrentProject(selectedProject.id)} disabled={!selectedProject}>
              <Building2 size={16} /> 设为当前项目
            </button>
            {isAdmin && (
              <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                {selectedProject ? <Edit3 size={16} /> : <Save size={16} />}
                {saving ? '保存中...' : '保存项目'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
