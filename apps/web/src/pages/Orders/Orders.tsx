import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Clock, CheckCircle2, AlertCircle, Filter, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import OrderModal from './components/OrderModal';
import styles from './Orders.module.css';

interface Order {
  id: string;
  orderNo: string;
  faultDesc: string;
  status: string;
  priority: string;
  assigneeName?: string;
  reporter?: { name: string };
  device?: { name: string };
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'assigned', label: '已派单' },
  { value: 'processing', label: '处理中' },
  { value: 'reviewing', label: '待验收' },
  { value: 'closed', label: '已完成' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'P0', label: 'P0 紧急' },
  { value: 'P1', label: 'P1 高' },
  { value: 'P2', label: 'P2 中' },
  { value: 'P3', label: 'P3 低' },
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: '200' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      const res = await apiClient.get(`/orders?${params}`);
      setOrders(res.items || res || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusUpdate = async (id: string, action: string) => {
    try {
      if (action === 'assign') {
        const me = await apiClient.get('/auth/me');
        await apiClient.put(`/orders/${id}/assign`, { assigneeId: me.id });
      } else {
        await apiClient.put(`/orders/${id}/${action}`);
      }
      fetchOrders();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <AlertCircle size={16} className={styles.iconTodo} />;
      case 'processing':
      case 'assigned': return <Clock size={16} className={styles.iconProgress} />;
      case 'closed': return <CheckCircle2 size={16} className={styles.iconDone} />;
      default: return null;
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'P0': return styles.priorityP0;
      case 'P1': return styles.priorityHigh;
      case 'P2': return styles.priorityMedium;
      case 'P3': return styles.priorityLow;
      default: return '';
    }
  };

  const renderColumn = (statuses: string[], title: string) => {
    const columnOrders = orders.filter(o => statuses.includes(o.status?.toLowerCase()));
    return (
      <div className={styles.kanbanColumn}>
        <div className={styles.columnHeader}>
          <h3>{title}</h3>
          <span className={styles.countBadge}>{loading ? '-' : columnOrders.length}</span>
        </div>
        <div className={styles.orderList}>
          {columnOrders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <span className={styles.orderId}>{order.orderNo}</span>
                <span className={`${styles.priorityBadge} ${getPriorityStyle(order.priority)}`}>
                  {order.priority}
                </span>
              </div>
              {order.device && <div className={styles.orderDevice}>📡 {order.device.name}</div>}
              <h4 className={styles.orderTitle} title={order.faultDesc}>
                {order.faultDesc?.length > 35 ? order.faultDesc.substring(0, 35) + '...' : order.faultDesc}
              </h4>
              <div className={styles.cardFooter}>
                <div className={styles.assignee}>
                  <div className={styles.avatar}>
                    {(order.assigneeName || order.reporter?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span>{order.assigneeName || '未指派'}</span>
                </div>
                <div className={styles.cardActions}>
                  {order.status === 'pending' && (
                    <button className={styles.actionBtn} onClick={() => handleStatusUpdate(order.id, 'assign')}>接单</button>
                  )}
                  {order.status === 'assigned' && (
                    <button className={styles.actionBtn} onClick={() => handleStatusUpdate(order.id, 'accept')}>确认接单</button>
                  )}
                  {order.status === 'processing' && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={() => handleStatusUpdate(order.id, 'submit')}>提交验收</button>
                  )}
                  {order.status === 'reviewing' && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={() => handleStatusUpdate(order.id, 'accept-check')}>通过验收</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!loading && columnOrders.length === 0 && (
            <div className={styles.emptyState}>暂无工单</div>
          )}
        </div>
      </div>
    );
  };

  const hasFilter = filterStatus || filterPriority;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>工单调度中心</h1>
          <p className={styles.pageSubtitle}>使用看板视图管理故障报修、维修进度与验收流程。</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.secondaryBtn} ${hasFilter ? styles.filterActive : ''}`}
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter size={16} />
            {hasFilter ? `筛选中 (${[filterStatus, filterPriority].filter(Boolean).length})` : '筛选'}
          </button>
          <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> 新增派单
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilter && (
        <div className={styles.filterBar}>
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select
            className={styles.filterSelect}
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {hasFilter && (
            <button className={styles.clearFilterBtn} onClick={() => { setFilterStatus(''); setFilterPriority(''); }}>
              <X size={14} /> 清除筛选
            </button>
          )}
        </div>
      )}

      <div className={styles.kanbanBoard}>
        {renderColumn(['pending'], '待处理')}
        {renderColumn(['assigned', 'processing'], '处理中')}
        {renderColumn(['reviewing'], '待验收')}
        {renderColumn(['closed'], '已完成')}
      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
      />
    </div>
  );
}



