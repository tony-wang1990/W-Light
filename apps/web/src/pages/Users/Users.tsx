import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Plus, RefreshCw, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from './Users.module.css';

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  projectIds?: string[];
  skillTags?: string[];
  activeOrderCount?: number;
  busyStatus?: 'idle' | 'busy' | 'overloaded';
  createdAt?: string;
}

interface Project {
  id: string;
  name: string;
}

type ListResponse<T> = T[] | { items?: T[] };

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: '管理员', color: '#8B5CF6' },
  engineer: { label: '维修工程师', color: '#3B82F6' },
  inspector: { label: '巡检员', color: '#10B981' },
  viewer: { label: '只读账号', color: '#6B7280' },
};

const busyLabels: Record<string, { label: string; className: string }> = {
  idle: { label: '空闲', className: styles.idleBadge },
  busy: { label: '处理中', className: styles.busyBadge },
  overloaded: { label: '高负载', className: styles.overloadedBadge },
};

const emptyForm = {
  name: '',
  phone: '',
  role: 'engineer',
  password: '',
  projectIds: [] as string[],
  skillTagsText: '',
};

function normalizeList<T>(res: ListResponse<T>) {
  return Array.isArray(res) ? res : res.items || [];
}

function splitSkillTags(value: string) {
  return value
    .split(/[,，\s]+/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, projectsRes] = await Promise.all([
        apiClient.get<ListResponse<User>>('/users?pageSize=200&includeWorkload=true'),
        apiClient.get<ListResponse<Project>>('/projects'),
      ]);
      setUsers(normalizeList(usersRes));
      setProjects(normalizeList(projectsRes));
    } catch (err) {
      setError(getErrorMessage(err, '用户列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const projectMap = useMemo(() => new Map(projects.map(project => [project.id, project.name])), [projects]);

  const roleCount = (role: string) => users.filter(user => user.role === role).length;

  const openCreate = () => {
    setEditUser(null);
    setForm({ ...emptyForm, projectIds: projects.map(project => project.id) });
    setError('');
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      role: user.role || 'engineer',
      password: '',
      projectIds: user.projectIds || [],
      skillTagsText: (user.skillTags || []).join('，'),
    });
    setError('');
    setShowModal(true);
  };

  const toggleProject = (projectId: string) => {
    setForm(current => ({
      ...current,
      projectIds: current.projectIds.includes(projectId)
        ? current.projectIds.filter(id => id !== projectId)
        : [...current.projectIds, projectId],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('请填写姓名和手机号');
      return;
    }
    if (!editUser && form.password.length < 8) {
      setError('新建用户必须填写不少于 8 位的初始密码');
      return;
    }
    if (form.password && form.password.length < 8) {
      setError('新密码不能少于 8 位');
      return;
    }

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      password: form.password || undefined,
      projectIds: form.projectIds,
      skillTags: splitSkillTags(form.skillTagsText),
    };

    setSaving(true);
    setError('');
    try {
      if (editUser) {
        await apiClient.put(`/users/${editUser.id}`, payload);
      } else {
        await apiClient.post('/users', payload);
      }
      setShowModal(false);
      setForm(emptyForm);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, '用户保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: User) => {
    const confirmed = window.confirm(`确认禁用用户「${user.name}」？该账号将无法继续登录。`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.delete(`/users/${user.id}`);
      await fetchData();
    } catch (err) {
      setError(getErrorMessage(err, '用户禁用失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>用户权限管理</h1>
          <p className={styles.pageSubtitle}>管理账号、角色、项目授权、技能标签和派单负载。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn} onClick={fetchData} disabled={loading}>
            <RefreshCw size={15} /> 刷新
          </button>
          <button className={styles.primaryBtn} onClick={openCreate}>
            <Plus size={16} /> 新建用户
          </button>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.roleCards}>
        {Object.entries(roleLabels).map(([role, meta]) => (
          <div key={role} className={styles.roleCard} style={{ borderTopColor: meta.color }}>
            <div className={styles.roleCount} style={{ color: meta.color }}>{roleCount(role)}</div>
            <div className={styles.roleName}>{meta.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3><UserCog size={16} /> 用户列表（共 {users.length} 人）</h3>
        </div>
        {loading ? (
          <div className={styles.loadingBox}>加载中...</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyBox}>
            <ShieldCheck size={40} color="#D1D5DB" />
            <p>暂无用户数据</p>
          </div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>人员</th>
                  <th>角色</th>
                  <th>项目授权</th>
                  <th>技能标签</th>
                  <th>派单负载</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const roleMeta = roleLabels[user.role] || { label: user.role, color: '#6B7280' };
                  const busyMeta = busyLabels[user.busyStatus || 'idle'] || busyLabels.idle;
                  return (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.userCell}>
                          <div className={styles.avatar} style={{ backgroundColor: roleMeta.color + '22', color: roleMeta.color }}>
                            {user.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <span className={styles.userName}>{user.name}</span>
                            <div className={styles.phoneCell}>{user.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.roleBadge} style={{ background: roleMeta.color + '18', color: roleMeta.color }}>
                          {roleMeta.label}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tagList}>
                          {(user.projectIds || []).length > 0 ? user.projectIds?.map(projectId => (
                            <span key={projectId} className={styles.projectTag}>{projectMap.get(projectId) || projectId}</span>
                          )) : <span className={styles.mutedText}>未授权项目</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.tagList}>
                          {(user.skillTags || []).length > 0 ? user.skillTags?.map(tag => (
                            <span key={tag} className={styles.skillTag}>{tag}</span>
                          )) : <span className={styles.mutedText}>未设置</span>}
                        </div>
                      </td>
                      <td>
                        <span className={busyMeta.className}>
                          {busyMeta.label} · {user.activeOrderCount || 0} 单
                        </span>
                      </td>
                      <td className={styles.dateCell}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td>
                        <div className={styles.actionsCell}>
                          <button className={styles.editBtn} onClick={() => openEdit(user)}>
                            <Edit2 size={13} /> 编辑
                          </button>
                          <button className={styles.dangerBtn} onClick={() => handleDelete(user)}>
                            <Trash2 size={13} /> 禁用
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={event => event.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editUser ? '编辑用户' : '新建用户'}</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>姓名 *</label>
                <input className={styles.input} value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="真实姓名" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>手机号 *</label>
                <input className={styles.input} value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="登录账号" disabled={!!editUser} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>角色</label>
                <select className={styles.input} value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))}>
                  <option value="admin">管理员</option>
                  <option value="engineer">维修工程师</option>
                  <option value="inspector">巡检员</option>
                  <option value="viewer">只读账号</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{editUser ? '新密码（留空不修改）' : '初始密码 *'}</label>
                <input className={styles.input} type="password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} placeholder={editUser ? '留空则不修改' : '不少于 8 位'} />
              </div>
              <div className={styles.formGroupWide}>
                <label className={styles.label}>项目授权</label>
                <div className={styles.checkboxGrid}>
                  {projects.length === 0 ? (
                    <span className={styles.mutedText}>暂无项目，请先在项目管理中创建项目。</span>
                  ) : projects.map(project => (
                    <label key={project.id} className={styles.checkboxItem}>
                      <input
                        type="checkbox"
                        checked={form.projectIds.includes(project.id)}
                        onChange={() => toggleProject(project.id)}
                      />
                      {project.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.formGroupWide}>
                <label className={styles.label}>技能标签</label>
                <input
                  className={styles.input}
                  value={form.skillTagsText}
                  onChange={event => setForm(current => ({ ...current, skillTagsText: event.target.value }))}
                  placeholder="例如：MA2，MA3，强电，水秀，媒体服务器"
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>取消</button>
              <button className={styles.primaryBtn} onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
