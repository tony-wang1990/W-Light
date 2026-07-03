import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, ClipboardCheck, Plus, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

interface InspectionPlan {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  deviceIds?: string[];
  assigneeId?: string;
  nextInspectionAt?: string;
  isActive: number;
  createdAt?: string;
}

interface InspectionRecord {
  id: string;
  planId: string;
  inspectorId: string;
  status: 'normal' | 'abnormal' | 'skipped';
  resultDesc?: string;
  orderId?: string;
  inspectedAt?: string;
}

interface DeviceOption {
  id: string;
  deviceNo?: string;
  name: string;
  location?: string;
}

interface UserOption {
  id: string;
  name: string;
  phone?: string;
  role?: string;
}

const frequencyLabels: Record<InspectionPlan['frequency'], string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
};

const statusLabels: Record<InspectionRecord['status'], string> = {
  normal: '正常',
  abnormal: '异常',
  skipped: '跳过',
};

const emptyPlanForm = {
  name: '',
  frequency: 'weekly' as InspectionPlan['frequency'],
  deviceId: '',
  assigneeId: '',
  nextInspectionAt: '',
};

const emptyRecordForm = {
  status: 'normal' as InspectionRecord['status'],
  resultDesc: '',
  createOrder: true,
};

function normalizeList<T>(res: T[] | { items?: T[] }) {
  return Array.isArray(res) ? res : res.items || [];
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export default function Inspections() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [plans, setPlans] = useState<InspectionPlan[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [recordForm, setRecordForm] = useState(emptyRecordForm);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedPlan = useMemo(
    () => plans.find(plan => plan.id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  const deviceMap = useMemo(() => new Map(devices.map(device => [device.id, device])), [devices]);
  const userMap = useMemo(() => new Map(users.map(item => [item.id, item])), [users]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const planEndpoint = isAdmin ? '/inspections/plans' : '/inspections/today';
      const [planRes, recordRes, deviceRes, userRes] = await Promise.all([
        apiClient.get<InspectionPlan[] | { items?: InspectionPlan[] }>(planEndpoint),
        apiClient.get<{ items?: InspectionRecord[] }>('/inspections/records?pageSize=50'),
        apiClient.get<DeviceOption[] | { items?: DeviceOption[] }>('/devices?pageSize=500'),
        apiClient.get<UserOption[] | { items?: UserOption[] }>('/users?pageSize=200'),
      ]);
      const nextPlans = normalizeList(planRes);
      setPlans(nextPlans);
      setRecords(recordRes.items || []);
      setDevices(normalizeList(deviceRes));
      setUsers(normalizeList(userRes));
      setSelectedPlanId(current => (
        current && nextPlans.some(plan => plan.id === current) ? current : nextPlans[0]?.id || ''
      ));
    } catch (err) {
      setError(getErrorMessage(err, '巡检数据加载失败，请检查后端服务和当前项目权限'));
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const planStats = useMemo(() => {
    const dueToday = plans.filter(plan => {
      if (!plan.nextInspectionAt) return true;
      const due = new Date(plan.nextInspectionAt).getTime();
      return due <= Date.now();
    }).length;
    const abnormalRecords = records.filter(record => record.status === 'abnormal').length;
    return {
      total: plans.length,
      dueToday,
      normalRecords: records.filter(record => record.status === 'normal').length,
      abnormalRecords,
    };
  }, [plans, records]);

  const selectedRecords = useMemo(
    () => records.filter(record => !selectedPlanId || record.planId === selectedPlanId),
    [records, selectedPlanId],
  );

  const resetPlanForm = () => {
    setPlanForm(emptyPlanForm);
    setShowPlanForm(false);
  };

  const createPlan = async () => {
    if (!planForm.name.trim()) {
      setError('请填写巡检计划名称');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/inspections/plans', {
        name: planForm.name.trim(),
        frequency: planForm.frequency,
        deviceIds: planForm.deviceId ? [planForm.deviceId] : [],
        assigneeId: planForm.assigneeId || undefined,
        nextInspectionAt: planForm.nextInspectionAt || undefined,
      });
      resetPlanForm();
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err, '巡检计划创建失败'));
    } finally {
      setSaving(false);
    }
  };

  const deactivatePlan = async (plan: InspectionPlan) => {
    const confirmed = window.confirm(`确认停用巡检计划「${plan.name}」？`);
    if (!confirmed) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.put(`/inspections/plans/${plan.id}`, { isActive: 0 });
      setSelectedPlanId('');
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err, '巡检计划停用失败'));
    } finally {
      setSaving(false);
    }
  };

  const openRecordForm = (plan: InspectionPlan) => {
    setSelectedPlanId(plan.id);
    setRecordForm(emptyRecordForm);
    setShowRecordForm(true);
  };

  const submitRecord = async () => {
    if (!selectedPlan) return;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/inspections/records', {
        planId: selectedPlan.id,
        status: recordForm.status,
        resultDesc: recordForm.resultDesc.trim() || undefined,
        createOrder: recordForm.status === 'abnormal' ? recordForm.createOrder : false,
      });
      setShowRecordForm(false);
      setRecordForm(emptyRecordForm);
      await fetchAll();
    } catch (err) {
      setError(getErrorMessage(err, '巡检记录提交失败'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>巡检管理</h1>
          <p className={styles.pageSubtitle}>把定期巡检、异常上报和自动生成维修工单串起来，现场发现问题可以直接进入闭环。</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={fetchAll} disabled={loading}>
            <RefreshCw size={15} /> 刷新
          </button>
          {isAdmin && (
            <button className={styles.primaryBtn} onClick={() => setShowPlanForm(value => !value)}>
              <Plus size={15} /> 新建计划
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.muted}>启用计划</span>
          <strong className={styles.statValue}>{planStats.total}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.muted}>当前应巡检</span>
          <strong className={styles.statValue}>{planStats.dueToday}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.muted}>正常记录</span>
          <strong className={styles.statValue}>{planStats.normalRecords}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.muted}>异常记录</span>
          <strong className={styles.statValue}>{planStats.abnormalRecords}</strong>
        </div>
      </div>

      {showPlanForm && isAdmin && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>新建巡检计划</h2>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>计划名称 *</label>
              <input
                className={styles.input}
                value={planForm.name}
                onChange={event => setPlanForm(form => ({ ...form, name: event.target.value }))}
                placeholder="例如：主舞台摇头灯周检"
              />
            </div>
            <div className={styles.formGroup}>
              <label>频率</label>
              <select
                className={styles.select}
                value={planForm.frequency}
                onChange={event => setPlanForm(form => ({ ...form, frequency: event.target.value as InspectionPlan['frequency'] }))}
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
                <option value="monthly">每月</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>关联设备</label>
              <select
                className={styles.select}
                value={planForm.deviceId}
                onChange={event => setPlanForm(form => ({ ...form, deviceId: event.target.value }))}
              >
                <option value="">不指定设备</option>
                {devices.map(device => (
                  <option key={device.id} value={device.id}>
                    {[device.deviceNo, device.name, device.location].filter(Boolean).join(' / ')}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>责任人</label>
              <select
                className={styles.select}
                value={planForm.assigneeId}
                onChange={event => setPlanForm(form => ({ ...form, assigneeId: event.target.value }))}
              >
                <option value="">所有巡检人员可执行</option>
                {users.map(item => (
                  <option key={item.id} value={item.id}>{item.name} {item.phone ? `(${item.phone})` : ''}</option>
                ))}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>首次巡检时间</label>
              <input
                className={styles.input}
                type="datetime-local"
                value={planForm.nextInspectionAt}
                onChange={event => setPlanForm(form => ({ ...form, nextInspectionAt: event.target.value }))}
              />
            </div>
          </div>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={createPlan} disabled={saving}>
              {saving ? '保存中...' : '保存计划'}
            </button>
            <button className={styles.secondaryBtn} onClick={resetPlanForm}>取消</button>
          </div>
        </div>
      )}

      <div className={styles.wideGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>巡检计划</h2>
            {loading && <span className={styles.muted}>加载中...</span>}
          </div>
          {plans.length === 0 ? (
            <div className={styles.empty}>暂无巡检计划。管理员可以先为重点区域或设备建立每日、每周、每月巡检。</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>计划</th>
                    <th>频率</th>
                    <th>关联设备</th>
                    <th>责任人</th>
                    <th>下次巡检</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(plan => {
                    const linkedDevice = plan.deviceIds?.[0] ? deviceMap.get(plan.deviceIds[0]) : null;
                    const assignee = plan.assigneeId ? userMap.get(plan.assigneeId) : null;
                    return (
                      <tr key={plan.id}>
                        <td>
                          <button className={styles.listItem} onClick={() => setSelectedPlanId(plan.id)}>
                            <strong>{plan.name}</strong>
                            <div className={styles.muted}>创建于 {formatDateTime(plan.createdAt)}</div>
                          </button>
                        </td>
                        <td><span className={styles.badge}>{frequencyLabels[plan.frequency]}</span></td>
                        <td>{linkedDevice ? `${linkedDevice.deviceNo || ''} ${linkedDevice.name}`.trim() : '未指定'}</td>
                        <td>{assignee?.name || '不限人员'}</td>
                        <td>{formatDateTime(plan.nextInspectionAt)}</td>
                        <td>
                          <div className={styles.actions}>
                            <button className={styles.secondaryBtn} onClick={() => openRecordForm(plan)}>
                              <Send size={14} /> 记录
                            </button>
                            {isAdmin && (
                              <button className={styles.dangerBtn} onClick={() => deactivatePlan(plan)}>
                                停用
                              </button>
                            )}
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

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>巡检记录</h2>
            <span className={styles.muted}>{selectedPlan ? selectedPlan.name : '全部计划'}</span>
          </div>

          {showRecordForm && selectedPlan && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>提交巡检结果</h3>
                <span className={styles.muted}>{selectedPlan.name}</span>
              </div>
              <div className={styles.formGroup}>
                <label>巡检状态</label>
                <select
                  className={styles.select}
                  value={recordForm.status}
                  onChange={event => setRecordForm(form => ({ ...form, status: event.target.value as InspectionRecord['status'] }))}
                >
                  <option value="normal">正常</option>
                  <option value="abnormal">异常</option>
                  <option value="skipped">跳过</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>结果说明</label>
                <textarea
                  className={styles.textarea}
                  value={recordForm.resultDesc}
                  onChange={event => setRecordForm(form => ({ ...form, resultDesc: event.target.value }))}
                  placeholder="记录现场检查项、异常现象、已处理情况或需要后续维修的内容"
                />
              </div>
              {recordForm.status === 'abnormal' && (
                <label className={styles.copyBox}>
                  <span>异常记录自动生成维修工单</span>
                  <input
                    type="checkbox"
                    checked={recordForm.createOrder}
                    onChange={event => setRecordForm(form => ({ ...form, createOrder: event.target.checked }))}
                  />
                </label>
              )}
              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={submitRecord} disabled={saving}>
                  <ClipboardCheck size={15} /> 提交记录
                </button>
                <button className={styles.secondaryBtn} onClick={() => setShowRecordForm(false)}>取消</button>
              </div>
            </div>
          )}

          <div className={styles.list}>
            {selectedRecords.length === 0 ? (
              <div className={styles.empty}>暂无巡检记录。</div>
            ) : selectedRecords.map(record => (
              <div key={record.id} className={styles.listItem}>
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{statusLabels[record.status]}</strong>
                    <div className={styles.muted}>{formatDateTime(record.inspectedAt)}</div>
                  </div>
                  <span className={`${styles.badge} ${record.status === 'abnormal' ? styles.dangerBadge : styles.successBadge}`}>
                    {record.status === 'abnormal' ? <ShieldAlert size={13} /> : <CalendarCheck size={13} />}
                    {statusLabels[record.status]}
                  </span>
                </div>
                <p className={styles.muted}>{record.resultDesc || '未填写说明'}</p>
                {record.orderId && <div className={styles.copyBox}>已生成工单：{record.orderId}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
