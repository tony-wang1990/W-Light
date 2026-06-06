import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Plus, RefreshCw, Save } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

interface Project {
  id: string;
  name: string;
  venue?: string;
  address?: string;
  managerId?: string;
  status?: string;
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
                      style={{ cursor: 'pointer' }}
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
