import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ClipboardCheck, Calendar, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import styles from './Inspections.module.css';

interface InspectionPlan {
  id: string;
  name: string;
  frequency: string;
  assigneeId?: string;
  nextInspectionAt?: string;
  isActive: number;
}

const FREQ_LABELS: Record<string, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
};

const FREQ_COLORS: Record<string, string> = {
  daily: '#10B981',
  weekly: '#3B82F6',
  monthly: '#8B5CF6',
};

export default function Inspections() {
  const [plans, setPlans] = useState<InspectionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', frequency: 'weekly' });
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/inspections/plans');
      setPlans(Array.isArray(res) ? res : res.items || []);
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/inspections/plans', form);
      setShowModal(false);
      setForm({ name: '', frequency: 'weekly' });
      fetchPlans();
    } catch (err: any) {
      alert(err.message || '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除该巡检计划？')) return;
    try {
      await apiClient.put(`/inspections/plans/${id}`, { isActive: 0 });
      fetchPlans();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>巡检管理</h1>
          <p className={styles.pageSubtitle}>制定巡检计划，记录设备定期检查结果，保障设备健康运行。</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => setShowModal(true)}>
          <Plus size={16} /> 新建巡检计划
        </button>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <ClipboardCheck size={20} color="#3B82F6" />
          <div>
            <div className={styles.statValue}>{plans.length}</div>
            <div className={styles.statLabel}>巡检计划总数</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <Calendar size={20} color="#10B981" />
          <div>
            <div className={styles.statValue}>{plans.filter(p => p.frequency === 'daily').length}</div>
            <div className={styles.statLabel}>每日检查计划</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <CheckCircle2 size={20} color="#8B5CF6" />
          <div>
            <div className={styles.statValue}>{plans.filter(p => p.frequency === 'weekly').length}</div>
            <div className={styles.statLabel}>每周检查计划</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <AlertCircle size={20} color="#F59E0B" />
          <div>
            <div className={styles.statValue}>{plans.filter(p => p.frequency === 'monthly').length}</div>
            <div className={styles.statLabel}>每月检查计划</div>
          </div>
        </div>
      </div>

      {/* Plans Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3>巡检计划列表</h3>
        </div>
        {loading ? (
          <div className={styles.loadingBox}>加载中...</div>
        ) : plans.length === 0 ? (
          <div className={styles.emptyBox}>
            <ClipboardCheck size={40} color="#D1D5DB" />
            <p>暂无巡检计划，点击右上角「新建巡检计划」开始配置</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>计划名称</th>
                <th>巡检频率</th>
                <th>下次执行</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map(plan => (
                <tr key={plan.id}>
                  <td>
                    <div className={styles.planName}>
                      <ClipboardCheck size={14} color="#6B7280" />
                      {plan.name}
                    </div>
                  </td>
                  <td>
                    <span
                      className={styles.freqBadge}
                      style={{ backgroundColor: (FREQ_COLORS[plan.frequency] || '#6B7280') + '20', color: FREQ_COLORS[plan.frequency] || '#6B7280' }}
                    >
                      {FREQ_LABELS[plan.frequency] || plan.frequency}
                    </span>
                  </td>
                  <td className={styles.dateCell}>
                    {plan.nextInspectionAt
                      ? new Date(plan.nextInspectionAt).toLocaleDateString('zh-CN')
                      : '—'}
                  </td>
                  <td>
                    <span className={plan.isActive ? styles.badgeActive : styles.badgeInactive}>
                      {plan.isActive ? '启用' : '停用'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.dangerBtn} onClick={() => handleDelete(plan.id)}>
                      <Trash2 size={13} /> 停用
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>新建巡检计划</h2>
            <div className={styles.formGroup}>
              <label className={styles.label}>计划名称 *</label>
              <input
                className={styles.input}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例如：主舞台摇头灯周检"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>巡检频率</label>
              <select
                className={styles.input}
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={() => setShowModal(false)}>取消</button>
              <button className={styles.primaryBtn} onClick={handleCreate} disabled={saving}>
                {saving ? '保存中...' : '创建计划'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
