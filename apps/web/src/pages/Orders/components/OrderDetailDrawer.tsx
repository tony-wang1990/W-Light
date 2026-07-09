import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Clock,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { apiClient, getServerOrigin } from '../../../api/client';
import { useAuthStore } from '../../../store/authStore';
import { getErrorMessage } from '../../../utils/errors';
import styles from './OrderDetailDrawer.module.css';

interface OrderDetailDrawerProps {
  order: WorkOrderDetail;
  initialAssignOpen?: boolean;
  onClose: () => void;
  onUpdated: (order?: WorkOrderDetail) => void | Promise<void>;
  onDeleted?: (orderId: string) => void | Promise<void>;
}

interface UserOption {
  id: string;
  name?: string;
  username?: string;
  phone?: string;
  role?: string;
}

interface PartOption {
  id: string;
  name: string;
  model?: string;
  unit?: string;
  stock?: number;
}

interface WorkOrderDevice {
  id?: string;
  deviceNo?: string;
  name?: string;
  location?: string;
}

interface WorkOrderDetail {
  id: string;
  orderNo?: string;
  faultDesc?: string;
  status?: string;
  priority?: string;
  category?: string;
  faultType?: string;
  locationDesc?: string;
  device?: WorkOrderDevice | null;
  assigneeId?: string | null;
  assignee?: UserOption | null;
  assigneeName?: string;
  reporter?: UserOption | null;
  reporterName?: string;
  createdAt?: string | Date | null;
  assignedAt?: string | Date | null;
  startedAt?: string | Date | null;
  submittedAt?: string | Date | null;
  closedAt?: string | Date | null;
  slaDeadline?: string | Date | null;
  rejectReason?: string | null;
  acceptanceNote?: string | null;
  isOvertime?: boolean;
}

interface RepairPartUsage {
  partId?: string;
  name?: string;
  quantity?: number | string;
  unit?: string;
}

interface RepairLog {
  id?: string;
  stepType?: string;
  stepDesc?: string;
  description?: string;
  photoUrls?: string[];
  partUsages?: RepairPartUsage[];
  outsourceVendor?: string;
  outsourceCost?: number | string;
  loggedAt?: string | Date | null;
  engineer?: {
    name?: string;
  } | null;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '待派单', color: '#B45309', bg: '#FEF3C7' },
  assigned: { label: '已派单', color: '#2563EB', bg: '#EFF6FF' },
  processing: { label: '处理中', color: '#7C3AED', bg: '#EDE9FE' },
  suspended: { label: '已挂起', color: '#92400E', bg: '#FFEDD5' },
  reviewing: { label: '待验收', color: '#EA580C', bg: '#FFF7ED' },
  closed: { label: '已归档', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: '已取消', color: '#DC2626', bg: '#FEE2E2' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0 特急', color: '#EF4444' },
  P1: { label: 'P1 紧急', color: '#F97316' },
  P2: { label: 'P2 普通', color: '#F59E0B' },
  P3: { label: 'P3 低', color: '#10B981' },
};

const STEP_TYPES = ['故障排查', '更换配件', '线路处理', '参数调试', '测试复核', '外协处理', '其他'];

function normalizeList<T>(res: T[] | { items?: T[] }): T[] {
  return Array.isArray(res) ? res : res.items || [];
}

function roleLabel(role?: string) {
  switch (role) {
    case 'admin': return '管理员';
    case 'engineer': return '工程师';
    case 'inspector': return '巡检员';
    case 'viewer': return '只读';
    default: return role || '人员';
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN');
}

function resolveMediaUrl(url?: string) {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (url.startsWith('/v1/')) return `${getServerOrigin()}${url}`;
  if (url.startsWith('/')) return `${getServerOrigin()}${url}`;
  return url;
}

export default function OrderDetailDrawer({
  order,
  initialAssignOpen = false,
  onClose,
  onUpdated,
  onDeleted,
}: OrderDetailDrawerProps) {
  const [currentOrder, setCurrentOrder] = useState<WorkOrderDetail>(order);
  const [repairLogs, setRepairLogs] = useState<RepairLog[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [logForm, setLogForm] = useState({
    stepType: STEP_TYPES[0],
    stepDesc: '',
    outsourceVendor: '',
    outsourceCost: '',
    partId: '',
    partQuantity: '',
    partNote: '',
  });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(initialAssignOpen);
  const [assignLoading, setAssignLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuthStore();

  useEffect(() => {
    setCurrentOrder(order);
    setShowAssignPicker(initialAssignOpen);
  }, [initialAssignOpen, order]);

  const orderId = currentOrder.id;
  const status = currentOrder.status?.toLowerCase() || '';
  const priority = currentOrder.priority?.toUpperCase() || '';
  const statusInfo = STATUS_MAP[status] || { label: currentOrder.status || '未知', color: '#6B7280', bg: '#F3F4F6' };
  const priorityInfo = PRIORITY_MAP[priority] || { label: currentOrder.priority || '未分级', color: '#6B7280' };
  const isAdmin = user?.role === 'admin';
  const assigneeId = currentOrder.assigneeId || currentOrder.assignee?.id || '';
  const isAssignee = Boolean(user?.id && assigneeId === user.id);
  const canAssigneeAction = user?.role === 'engineer' && isAssignee;
  const canAddLog = status === 'processing' && user?.role === 'engineer' && isAssignee;
  const canSubmit = canAssigneeAction && repairLogs.length > 0;
  const canSuspend = isAdmin || canAssigneeAction;
  const canResume = isAdmin || canAssigneeAction;

  const fetchRepairLogs = useCallback(async () => {
    try {
      const res = await apiClient.get<RepairLog[] | { items?: RepairLog[] }>(`/orders/${orderId}/repair-logs`);
      setRepairLogs(normalizeList(res));
    } catch {
      setRepairLogs([]);
    }
  }, [orderId]);

  const refreshCurrentOrder = useCallback(async () => {
    const detail = await apiClient.get<WorkOrderDetail>(`/orders/${orderId}`);
    setCurrentOrder(detail);
    await onUpdated(detail);
    return detail;
  }, [onUpdated, orderId]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) {
      setUsers([]);
      return;
    }

    try {
      const res = await apiClient.get<UserOption[] | { items?: UserOption[] }>('/users?pageSize=200');
      setUsers(normalizeList(res).filter(user => user.role === 'engineer'));
    } catch {
      setUsers([]);
    }
  }, [isAdmin]);

  const fetchParts = useCallback(async () => {
    try {
      const res = await apiClient.get<PartOption[] | { items?: PartOption[] }>('/parts');
      setParts(normalizeList(res));
    } catch {
      setParts([]);
    }
  }, []);

  useEffect(() => {
    fetchRepairLogs();
    fetchUsers();
    fetchParts();
  }, [fetchParts, fetchRepairLogs, fetchUsers]);

  const assigneeName = currentOrder.assigneeName || currentOrder.assignee?.name || '未指派';
  const reporterName = currentOrder.reporter?.name || currentOrder.reporterName || '未记录';

  const timeline = useMemo(() => [
    { label: '创建', value: currentOrder.createdAt },
    { label: '派单', value: currentOrder.assignedAt },
    { label: '接单', value: currentOrder.startedAt },
    { label: '提交验收', value: currentOrder.submittedAt },
    { label: '归档', value: currentOrder.closedAt },
  ].filter(item => item.value), [currentOrder]);

  const handleAction = async (action: string, label: string) => {
    setError('');
    let body: Record<string, unknown> = {};

    if (['reject', 'suspend', 'reject-check', 'cancel'].includes(action)) {
      const reason = window.prompt(`${label}原因`);
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    }

    if (action === 'submit') {
      const repairCost = window.prompt('维修费用（可留空，单位：元）');
      if (repairCost?.trim()) body = { repairCost: Number(repairCost) };
    }

    if (action === 'accept-check') {
      const note = window.prompt('验收备注（可留空）');
      if (note?.trim()) body = { note: note.trim() };
    }

    setActionLoading(action);
    try {
      await apiClient.put(`/orders/${orderId}/${action}`, body);
      await refreshCurrentOrder();
      await fetchRepairLogs();
    } catch (err) {
      const message = getErrorMessage(err, `${label}失败`);
      setError(message);
      window.alert(message);
    } finally {
      setActionLoading('');
    }
  };

  const handleAssignUser = async (userId: string) => {
    setAssignLoading(true);
    setError('');
    try {
      await apiClient.put(`/orders/${orderId}/assign`, { assigneeId: userId });
      setShowAssignPicker(false);
      await refreshCurrentOrder();
    } catch (err) {
      const message = getErrorMessage(err, '指派失败');
      setError(message);
      window.alert(message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddRepairLog = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!logForm.stepDesc.trim() || !canAddLog) return;

    const partQuantity = Number(logForm.partQuantity);
    const partUsages = logForm.partId && Number.isFinite(partQuantity) && partQuantity > 0
      ? [{ partId: logForm.partId, quantity: partQuantity, note: logForm.partNote.trim() || undefined }]
      : undefined;

    setSubmittingLog(true);
    setError('');
    try {
      await apiClient.post(`/orders/${orderId}/repair-logs`, {
        stepType: logForm.stepType,
        stepDesc: logForm.stepDesc.trim(),
        outsourceVendor: logForm.outsourceVendor.trim() || undefined,
        outsourceCost: logForm.outsourceCost ? Number(logForm.outsourceCost) : undefined,
        partUsages,
      });
      setLogForm({
        stepType: STEP_TYPES[0],
        stepDesc: '',
        outsourceVendor: '',
        outsourceCost: '',
        partId: '',
        partQuantity: '',
        partNote: '',
      });
      await fetchRepairLogs();
      await fetchParts();
    } catch (err) {
      const message = getErrorMessage(err, '添加维修记录失败');
      setError(message);
      window.alert(message);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!isAdmin || actionLoading) return;
    const orderLabel = currentOrder.orderNo || currentOrder.id;
    const ok = window.confirm(`确定彻底删除工单 ${orderLabel} 吗？删除后维修记录和相关备件流水也会移除，此操作不可恢复。`);
    if (!ok) return;

    setActionLoading('delete');
    setError('');
    try {
      await apiClient.delete(`/orders/${orderId}`);
      await onDeleted?.(orderId);
      onClose();
    } catch (err) {
      const message = getErrorMessage(err, '删除工单失败');
      setError(message);
      window.alert(message);
    } finally {
      setActionLoading('');
    }
  };

  const actionDisabled = Boolean(actionLoading || assignLoading);

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.orderNo}>{currentOrder.orderNo}</span>
            <button className={styles.closeBtn} onClick={onClose} aria-label="关闭工单详情">
              <X size={18} />
            </button>
          </div>
          <div className={styles.statusRow}>
            <span className={styles.statusBadge} style={{ backgroundColor: statusInfo.bg, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
            <span className={styles.priorityBadge} style={{ color: priorityInfo.color }}>
              {priorityInfo.label}
            </span>
            {currentOrder.isOvertime && <span className={styles.overtimeBadge}>SLA 超时</span>}
          </div>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>故障描述</h4>
            <div className={styles.descBox}>
              <strong>{currentOrder.faultType || currentOrder.category || '故障报修'}</strong>
              <p>{currentOrder.faultDesc || '暂无描述'}</p>
              {currentOrder.locationDesc && <span>现场位置：{currentOrder.locationDesc}</span>}
            </div>
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>工单信息</h4>
            <div className={styles.infoList}>
              {currentOrder.device && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>关联设备</span>
                  <span className={styles.infoValue}>
                    {currentOrder.device.deviceNo ? `${currentOrder.device.deviceNo} · ` : ''}{currentOrder.device.name}
                  </span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>报修人</span>
                <span className={styles.infoValue}><User size={13} /> {reporterName}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>处理人</span>
                <span className={styles.infoValue}><UserCheck size={13} /> {assigneeName}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>创建时间</span>
                <span className={styles.infoValue}><Clock size={13} /> {formatDate(currentOrder.createdAt)}</span>
              </div>
              {currentOrder.slaDeadline && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>SLA 截止</span>
                  <span className={styles.infoValue}>{formatDate(currentOrder.slaDeadline)}</span>
                </div>
              )}
            </div>
          </div>

          {timeline.length > 0 && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>流转时间线</h4>
              <div className={styles.timeline}>
                {timeline.map(item => (
                  <div className={styles.timelineItem} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{formatDate(item.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(currentOrder.rejectReason || currentOrder.acceptanceNote) && (
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>处理备注</h4>
              {currentOrder.rejectReason && <div className={styles.noteBox}>退回/取消原因：{currentOrder.rejectReason}</div>}
              {currentOrder.acceptanceNote && <div className={styles.noteBox}>验收备注：{currentOrder.acceptanceNote}</div>}
            </div>
          )}

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>工单操作</h4>
            <div className={styles.actionButtons}>
              {isAdmin && status === 'pending' && (
                <>
                  <button className={styles.assignBtn} onClick={() => setShowAssignPicker(!showAssignPicker)} disabled={!isAdmin || actionDisabled}>
                    <UserCheck size={14} /> 指派工程师
                  </button>
                  <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={() => handleAction('cancel', '取消工单')} disabled={!isAdmin || actionDisabled}>
                    取消
                  </button>
                </>
              )}

              {status === 'assigned' && (
                <>
                  {canAssigneeAction && (
                    <>
                      <button className={styles.actionBtn} onClick={() => handleAction('accept', '接单')} disabled={actionDisabled}>
                        <PlayCircle size={14} /> 接单
                      </button>
                      <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={() => handleAction('reject', '拒单')} disabled={actionDisabled}>
                        拒单
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <button className={styles.assignBtn} onClick={() => setShowAssignPicker(!showAssignPicker)} disabled={actionDisabled}>
                        改派
                      </button>
                      <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={() => handleAction('cancel', '取消工单')} disabled={actionDisabled}>
                        取消
                      </button>
                    </>
                  )}
                </>
              )}

              {status === 'processing' && (
                <>
                  {canSubmit && (
                    <button className={`${styles.actionBtn} ${styles.greenBtn}`} onClick={() => handleAction('submit', '提交验收')} disabled={actionDisabled}>
                      <Send size={14} /> 提交验收
                    </button>
                  )}
                  {canSuspend && (
                    <button className={styles.actionBtn} onClick={() => handleAction('suspend', '挂起工单')} disabled={actionDisabled}>
                      <PauseCircle size={14} /> 挂起
                    </button>
                  )}
                </>
              )}

              {status === 'suspended' && canResume && (
                <button className={styles.actionBtn} onClick={() => handleAction('resume', '恢复工单')} disabled={actionDisabled}>
                  <RotateCcw size={14} /> 恢复处理
                </button>
              )}

              {isAdmin && status === 'reviewing' && (
                <>
                  <button className={`${styles.actionBtn} ${styles.greenBtn}`} onClick={() => handleAction('accept-check', '验收通过')} disabled={actionDisabled}>
                    <ShieldCheck size={14} /> 验收通过
                  </button>
                  <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={() => handleAction('reject-check', '验收退回')} disabled={actionDisabled}>
                    退回维修
                  </button>
                </>
              )}

              {isAdmin && (
                <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={handleDeleteOrder} disabled={actionDisabled}>
                  <Trash2 size={14} /> 彻底删除
                </button>
              )}
            </div>

            {isAdmin && showAssignPicker && (
              <div className={styles.assignPicker}>
                <div className={styles.assignPickerTitle}>选择维修负责人</div>
                {users.length === 0 ? (
                  <div className={styles.assignPickerEmpty}>暂无可指派用户，请先在用户权限中创建工程师账号</div>
                ) : (
                  users.map(user => (
                    <button
                      key={user.id}
                      className={styles.userOption}
                      onClick={() => handleAssignUser(user.id)}
                      disabled={assignLoading}
                    >
                      <div className={styles.userAvatar}>{(user.name || user.username || user.phone || '?').charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.userName}>{user.name || user.username || user.phone}</div>
                        <div className={styles.userRole}>{roleLabel(user.role)}{user.phone ? ` · ${user.phone}` : ''}</div>
                      </div>
                      <ChevronRight size={14} className={styles.userChevron} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>维修记录 ({repairLogs.length})</h4>

            {repairLogs.length > 0 ? (
              <div className={styles.logList}>
                {repairLogs.map((log, idx) => (
                  <div key={log.id || idx} className={styles.logItem}>
                    <div className={styles.logDot} />
                    <div className={styles.logContent}>
                      <div className={styles.logType}>{log.stepType || '维修记录'}</div>
                      <div className={styles.logDesc}>{log.stepDesc || log.description}</div>
                      {Array.isArray(log.partUsages) && log.partUsages.length > 0 && (
                        <div className={styles.partsUsed}>
                          {log.partUsages.map((part, partIdx) => (
                            <span key={`${part.partId || part.name}-${partIdx}`}>
                              {part.name || part.partId} × {part.quantity}{part.unit || ''}
                            </span>
                          ))}
                        </div>
                      )}
                      {(log.outsourceVendor || log.outsourceCost) && (
                        <div className={styles.partsUsed}>
                          <span>外协：{log.outsourceVendor || '-'} {log.outsourceCost ? `¥${log.outsourceCost}` : ''}</span>
                        </div>
                      )}
                      {Array.isArray(log.photoUrls) && log.photoUrls.length > 0 && (
                        <div className={styles.logPhotos}>
                          {log.photoUrls.map((url, photoIdx) => {
                            const href = resolveMediaUrl(url);
                            return (
                              <a
                                key={`${url}-${photoIdx}`}
                                className={styles.logPhotoLink}
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                title="查看维修照片"
                              >
                                <img src={href} alt={`维修照片 ${photoIdx + 1}`} className={styles.logPhotoThumb} loading="lazy" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <div className={styles.logMeta}>
                        {log.loggedAt && <span>{formatDate(log.loggedAt)}</span>}
                        {log.engineer?.name && <span>by {log.engineer.name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyLogs}>暂无维修记录</div>
            )}

            {canAddLog && (
              <form className={styles.logForm} onSubmit={handleAddRepairLog}>
                <div className={styles.logFormTitle}>
                  <MessageSquare size={14} /> 添加维修过程记录
                </div>
                <div className={styles.formRow}>
                  <select
                    className={styles.formInput}
                    value={logForm.stepType}
                    onChange={event => setLogForm(form => ({ ...form, stepType: event.target.value }))}
                  >
                    {STEP_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <input
                    className={styles.formInput}
                    value={logForm.outsourceVendor}
                    onChange={event => setLogForm(form => ({ ...form, outsourceVendor: event.target.value }))}
                    placeholder="外协单位（可选）"
                  />
                </div>
                <textarea
                  className={styles.logTextarea}
                  value={logForm.stepDesc}
                  onChange={event => setLogForm(form => ({ ...form, stepDesc: event.target.value }))}
                  placeholder="记录排查步骤、更换配件、测试结果和现场情况"
                  rows={4}
                />
                <div className={styles.formRow}>
                  <select
                    className={styles.formInput}
                    value={logForm.partId}
                    onChange={event => setLogForm(form => ({ ...form, partId: event.target.value }))}
                  >
                    <option value="">未使用备件</option>
                    {parts.map(part => (
                      <option key={part.id} value={part.id}>
                        {part.name}{part.model ? ` · ${part.model}` : ''}（库存 {part.stock ?? '-'}{part.unit || ''}）
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={styles.formInput}
                    value={logForm.partQuantity}
                    onChange={event => setLogForm(form => ({ ...form, partQuantity: event.target.value }))}
                    placeholder="领用数量"
                    min={0}
                    step="1"
                    disabled={!logForm.partId}
                  />
                </div>
                <div className={styles.formRow}>
                  <input
                    className={styles.formInput}
                    value={logForm.partNote}
                    onChange={event => setLogForm(form => ({ ...form, partNote: event.target.value }))}
                    placeholder="备件使用说明（可选）"
                    disabled={!logForm.partId}
                  />
                  <input
                    type="number"
                    className={styles.formInput}
                    value={logForm.outsourceCost}
                    onChange={event => setLogForm(form => ({ ...form, outsourceCost: event.target.value }))}
                    placeholder="外协费用（可选）"
                    min={0}
                    step="0.01"
                  />
                </div>
                <button
                  type="submit"
                  className={styles.submitLogBtn}
                  disabled={submittingLog || !logForm.stepDesc.trim()}
                >
                  <Send size={14} />
                  {submittingLog ? '提交中...' : '提交记录'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
