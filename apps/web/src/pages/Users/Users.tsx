import React, { useState, useEffect, useCallback } from 'react';
import { Plus, UserCog, ShieldCheck, Trash2, Edit2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import styles from './Users.module.css';

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin:     { label: '管理员', color: '#8B5CF6' },
  engineer:  { label: '工程师', color: '#3B82F6' },
  inspector: { label: '巡检员', color: '#10B981' },
  viewer:    { label: '只读',   color: '#6B7280' },
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', role: 'engineer', password: '' });
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/users?pageSize=100');
      setUsers(res.items || res || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm({ name: '', phone: '', role: 'engineer', password: '' });
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ name: u.name, phone: u.phone, role: u.role, password: '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return alert('请填写姓名和手机号');
    setSaving(true);
    try {
      if (editUser) {
        const payload: any = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await apiClient.put(`/users/${editUser.id}`, payload);
      } else {
        if (!form.password) return alert('新建用户必须填写密码');
        await apiClient.post('/users', form);
      }
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除用户「${name}」？此操作不可恢复。`)) return;
    try {
      await apiClient.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) { alert(err.message || '删除失败'); }
  };

  const roleCount = (role: string) => users.filter(u => u.role === role).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>用户权限管理</h1>
          <p className={styles.pageSubtitle}>管理系统用户账号，分配角色与权限，控制功能访问范围。</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>
          <Plus size={16} /> 新建用户
        </button>
      </div>

      {/* Role Stats */}
      <div className={styles.roleCards}>
        {Object.entries(ROLE_LABELS).map(([role, meta]) => (
          <div key={role} className={styles.roleCard} style={{ borderTopColor: meta.color }}>
            <div className={styles.roleCount} style={{ color: meta.color }}>{roleCount(role)}</div>
            <div className={styles.roleName}>{meta.label}</div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3><UserCog size={16} style={{ display: 'inline', marginRight: 6 }} />用户列表（共 {users.length} 人）</h3>
        </div>
        {loading ? (
          <div className={styles.loadingBox}>加载中...</div>
        ) : users.length === 0 ? (
          <div className={styles.emptyBox}>
            <ShieldCheck size={40} color="#D1D5DB" />
            <p>暂无用户数据</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>姓名</th>
                <th>手机号</th>
                <th>角色</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleMeta = ROLE_LABELS[u.role] || { label: u.role, color: '#6B7280' };
                return (
                  <tr key={u.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar} style={{ backgroundColor: roleMeta.color + '22', color: roleMeta.color }}>
                          {u.name?.charAt(0) || '?'}
                        </div>
                        <span className={styles.userName}>{u.name}</span>
                      </div>
                    </td>
                    <td className={styles.phoneCell}>{u.phone}</td>
                    <td>
                      <span className={styles.roleBadge} style={{ background: roleMeta.color + '18', color: roleMeta.color }}>
                        {roleMeta.label}
                      </span>
                    </td>
                    <td className={styles.dateCell}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '—'}
                    </td>
                    <td>
                      <div className={styles.actionsCell}>
                        <button className={styles.editBtn} onClick={() => openEdit(u)}>
                          <Edit2 size={13} /> 编辑
                        </button>
                        <button className={styles.dangerBtn} onClick={() => handleDelete(u.id, u.name)}>
                          <Trash2 size={13} /> 删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editUser ? '编辑用户' : '新建用户'}</h2>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>姓名 *</label>
                <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="真实姓名" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>手机号 *</label>
                <input className={styles.input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="登录账号" disabled={!!editUser} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>角色</label>
                <select className={styles.input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="admin">管理员</option>
                  <option value="engineer">工程师</option>
                  <option value="inspector">巡检员</option>
                  <option value="viewer">只读</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>{editUser ? '新密码（留空不修改）' : '初始密码 *'}</label>
                <input className={styles.input} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editUser ? '留空则不修改' : '请设置初始密码'} />
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
