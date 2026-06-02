import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Clock, ChevronRight, MessageSquare, Send, UserCheck } from 'lucide-react';
import { apiClient } from '../../../api/client';
import styles from './OrderDetailDrawer.module.css';

interface OrderDetailDrawerProps {
  order: any;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: '待处理', color: '#F59E0B', bg: '#FEF3C7' },
  assigned:   { label: '已派单', color: '#3B82F6', bg: '#EFF6FF' },
  processing: { label: '处理中', color: '#8B5CF6', bg: '#EDE9FE' },
  reviewing:  { label: '待验收', color: '#F97316', bg: '#FFF7ED' },
  closed:     { label: '已完成', color: '#10B981', bg: '#D1FAE5' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  P0: { label: 'P0 特急', color: '#EF4444' },
  P1: { label: 'P1 紧急', color: '#F97316' },
  P2: { label: 'P2 普通', color: '#F59E0B' },
  P3: { label: 'P3 低',   color: '#10B981' },
};

export default function OrderDetailDrawer({ order, onClose, onUpdated }: OrderDetailDrawerProps) {
  const [repairLogs, setRepairLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logForm, setLogForm] = useState({ description: '', duration: '' });
  const [submittingLog, setSubmittingLog] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const statusInfo = STATUS_MAP[order.status?.toLowerCase()] || { label: order.status, color: '#6B7280', bg: '#F3F4F6' };
  const priorityInfo = PRIORITY_MAP[order.priority?.toUpperCase()] || { label: order.priority, color: '#6B7280' };

  const fetchRepairLogs = useCallback(async () => {
    try {
      const res = await apiClient.get(`/orders/${order.id}/repair-logs`);
      setRepairLogs(Array.isArray(res) ? res : res.items || []);
    } catch (e) {
      // Repair logs may not be available
    }
  }, [order.id]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.get('/users');
      setUsers(res.items || res || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchRepairLogs();
    fetchUsers();
  }, [fetchRepairLogs, fetchUsers]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      if (action === 'assign-self') {
        const me = await apiClient.get('/auth/me');
        await apiClient.put(`/orders/${order.id}/assign`, { assigneeId: me.id });
      } else {
        await apiClient.put(`/orders/${order.id}/${action}`);
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignUser = async (userId: string) => {
    setAssignLoading(true);
    try {
      await apiClient.put(`/orders/${order.id}/assign`, { assigneeId: userId });
      setShowAssignPicker(false);
      onUpdated();
    } catch (err: any) {
      alert(err.message || '指派失败');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleAddRepairLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logForm.description.trim()) return;
    setSubmittingLog(true);
    try {
      await apiClient.post(`/orders/${order.id}/repair-logs`, {
        description: logForm.description,
        duration: logForm.duration ? Number(logForm.duration) : undefined,
      });
      setLogForm({ description: '', duration: '' });
      fetchRepairLogs();
    } catch (err: any) {
      alert(err.message || '添加失败');
    } finally {
      setSubmittingLog(false);
    }
  };

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.orderNo}>{order.orderNo}</span>
            <button className={styles.closeBtn} onClick={onClose}>
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
          </div>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Fault Description */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>故障描述</h4>
            <div className={styles.descBox}>{order.faultDesc || '暂无描述'}</div>
          </div>

          {/* Basic Info */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>工单信息</h4>
            <div className={styles.infoList}>
              {order.device && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>关联设备</span>
                  <span className={styles.infoValue}>📡 {order.device.name || order.device.deviceNo}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>报修人</span>
                <span className={styles.infoValue}>
                  <User size={13} /> {order.reporter?.name || order.reporterName || '—'}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>处理人</span>
                <span className={styles.infoValue}>
                  <UserCheck size={13} /> {order.assigneeName || order.assignee?.name || '未指派'}
                </span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>工单类型</span>
                <span className={styles.infoValue}>{order.category || '—'}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>创建时间</span>
                <span className={styles.infoValue}>
                  <Clock size={13} /> {order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>工单操作</h4>
            <div className={styles.actionButtons}>
              <button
                className={styles.assignBtn}
                onClick={() => setShowAssignPicker(!showAssignPicker)}
                disabled={actionLoading}
              >
                <UserCheck size={14} /> 指派工程师
              </button>

              {order.status === 'pending' && (
                <button className={styles.actionBtn} onClick={() => handleAction('assign-self')} disabled={actionLoading}>
                  接单
                </button>
              )}
              {order.status === 'assigned' && (
                <button className={styles.actionBtn} onClick={() => handleAction('accept')} disabled={actionLoading}>
                  确认接单
                </button>
              )}
              {order.status === 'processing' && (
                <button className={`${styles.actionBtn} ${styles.greenBtn}`} onClick={() => handleAction('submit')} disabled={actionLoading}>
                  提交验收
                </button>
              )}
              {order.status === 'reviewing' && (
                <button className={`${styles.actionBtn} ${styles.greenBtn}`} onClick={() => handleAction('accept-check')} disabled={actionLoading}>
                  通过验收
                </button>
              )}
              {order.status !== 'closed' && (
                <button className={`${styles.actionBtn} ${styles.redBtn}`} onClick={() => handleAction('cancel')} disabled={actionLoading}>
                  取消工单
                </button>
              )}
            </div>

            {/* Assign User Picker */}
            {showAssignPicker && (
              <div className={styles.assignPicker}>
                <div className={styles.assignPickerTitle}>选择指派工程师</div>
                {users.length === 0 ? (
                  <div className={styles.assignPickerEmpty}>暂无用户数据</div>
                ) : (
                  users.map(user => (
                    <button
                      key={user.id}
                      className={styles.userOption}
                      onClick={() => handleAssignUser(user.id)}
                      disabled={assignLoading}
                    >
                      <div className={styles.userAvatar}>{(user.name || user.username || '?').charAt(0).toUpperCase()}</div>
                      <div>
                        <div className={styles.userName}>{user.name || user.username}</div>
                        <div className={styles.userRole}>{user.role || '工程师'}</div>
                      </div>
                      <ChevronRight size={14} className={styles.userChevron} />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Repair Logs */}
          <div className={styles.section}>
            <h4 className={styles.sectionTitle}>维修记录 ({repairLogs.length})</h4>
            
            {repairLogs.length > 0 && (
              <div className={styles.logList}>
                {repairLogs.map((log: any, idx: number) => (
                  <div key={log.id || idx} className={styles.logItem}>
                    <div className={styles.logDot} />
                    <div className={styles.logContent}>
                      <div className={styles.logDesc}>{log.description}</div>
                      <div className={styles.logMeta}>
                        {log.duration && <span>耗时 {log.duration} 分钟</span>}
                        {log.createdAt && <span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>}
                        {log.operator?.name && <span>by {log.operator.name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add log form */}
            <form className={styles.logForm} onSubmit={handleAddRepairLog}>
              <div className={styles.logFormTitle}>
                <MessageSquare size={14} /> 添加维修记录
              </div>
              <textarea
                className={styles.logTextarea}
                value={logForm.description}
                onChange={e => setLogForm(f => ({ ...f, description: e.target.value }))}
                placeholder="描述本次维修内容、使用的备件、处理结果..."
                rows={3}
              />
              <div className={styles.logFormFooter}>
                <input
                  type="number"
                  className={styles.durationInput}
                  value={logForm.duration}
                  onChange={e => setLogForm(f => ({ ...f, duration: e.target.value }))}
                  placeholder="耗时(分钟)"
                  min={0}
                />
                <button
                  type="submit"
                  className={styles.submitLogBtn}
                  disabled={submittingLog || !logForm.description.trim()}
                >
                  <Send size={14} />
                  {submittingLog ? '提交中...' : '提交记录'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
