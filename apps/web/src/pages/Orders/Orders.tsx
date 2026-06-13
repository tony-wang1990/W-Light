import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  PauseCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiClient, getApiBaseUrl } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import { useAuthStore, getCurrentProjectId } from '../../store/authStore';
import OrderModal from './components/OrderModal';
import OrderDetailDrawer from './components/OrderDetailDrawer';
import styles from './Orders.module.css';

interface UserLite {
  id: string;
  name?: string;
  phone?: string;
  role?: string;
}

export interface Order {
  id: string;
  orderNo: string;
  faultDesc: string;
  status: string;
  priority: string;
  assigneeId?: string | null;
  assigneeName?: string;
  assignee?: UserLite | null;
  reporter?: UserLite | null;
  reporterName?: string;
  device?: { name?: string; deviceNo?: string; location?: string } | null;
  createdAt: string;
  updatedAt?: string;
  category?: string;
  faultType?: string;
  locationDesc?: string;
  rejectReason?: string | null;
  isOvertime?: boolean;
}

type ListResponse<T> = T[] | { items?: T[] };

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待派单' },
  { value: 'assigned', label: '已派单' },
  { value: 'processing', label: '处理中' },
  { value: 'suspended', label: '已挂起' },
  { value: 'reviewing', label: '待验收' },
  { value: 'closed', label: '已归档' },
  { value: 'rejected', label: '已取消' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: '全部优先级' },
  { value: 'P0', label: 'P0 特急' },
  { value: 'P1', label: 'P1 紧急' },
  { value: 'P2', label: 'P2 普通' },
  { value: 'P3', label: 'P3 低' },
];

const STATUS_COLUMNS = [
  { key: 'pending', title: '待派单', statuses: ['pending'], icon: AlertCircle },
  { key: 'assigned', title: '已派单', statuses: ['assigned'], icon: Clock },
  { key: 'processing', title: '处理中', statuses: ['processing'], icon: Clock },
  { key: 'suspended', title: '已挂起', statuses: ['suspended'], icon: PauseCircle },
  { key: 'reviewing', title: '待验收', statuses: ['reviewing'], icon: ShieldCheck },
  { key: 'closed', title: '已归档/取消', statuses: ['closed', 'rejected'], icon: CheckCircle2 },
];

function normalizeList<T>(res: ListResponse<T>): T[] {
  return Array.isArray(res) ? res : res.items || [];
}

function getAssigneeName(order: Order) {
  return order.assigneeName || order.assignee?.name || '未指派';
}

function getReporterName(order: Order) {
  return order.reporter?.name || order.reporterName || '未记录';
}

function statusText(status: string) {
  return STATUS_OPTIONS.find(item => item.value === status)?.label || status || '未知';
}

export default function Orders() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [keyword, setKeyword] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [openAssignOnSelect, setOpenAssignOnSelect] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ pageSize: '200' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterPriority) params.set('priority', filterPriority);
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const res = await apiClient.get<ListResponse<Order>>(`/orders?${params.toString()}`);
      setOrders(normalizeList(res));
    } catch (err) {
      setError(getErrorMessage(err, '工单列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterPriority, keyword]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    const projectId = getCurrentProjectId();
    if (!token || !projectId) return;
    
    // Connect to SSE using the standard EventSource. 
    // Note: EventSource doesn't support headers directly in browser, so we pass token in query.
    const apiBaseUrl = getApiBaseUrl().replace(/\/+$/, '');
    const url = `${apiBaseUrl}/sse/orders?token=${encodeURIComponent(token)}&projectId=${encodeURIComponent(projectId)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = () => {
      // Refresh the orders list silently when an event arrives
      fetchOrders();
    };

    return () => {
      eventSource.close();
    };
  }, [fetchOrders]);

  const refreshSelectedOrder = useCallback(async (orderId: string) => {
    const detail = await apiClient.get<Order>(`/orders/${orderId}`);
    setSelectedOrder(detail);
    return detail;
  }, []);

  const handleOrderUpdated = useCallback(async (updated?: { id?: string }) => {
    await fetchOrders();
    const currentId = updated?.id || selectedOrder?.id;
    if (!currentId) return;
    try {
      await refreshSelectedOrder(currentId);
    } catch {
      setSelectedOrder(null);
    }
  }, [fetchOrders, refreshSelectedOrder, selectedOrder?.id]);

  const openOrder = (order: Order, assign = false) => {
    setOpenAssignOnSelect(assign);
    setSelectedOrder(order);
  };

  const handleCardClick = (order: Order, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    openOrder(order);
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

  const summary = useMemo(() => {
    return STATUS_COLUMNS.reduce<Record<string, number>>((acc, column) => {
      acc[column.key] = orders.filter(order => column.statuses.includes(order.status?.toLowerCase())).length;
      return acc;
    }, {});
  }, [orders]);

  const renderAction = (order: Order) => {
    if (user?.role === 'viewer') {
      return (
        <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
          查看
        </button>
      );
    }
    switch (order.status) {
      case 'pending':
        return (
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openOrder(order, true); }}>
            派单
          </button>
        );
      case 'assigned':
        return (
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
            接单/拒单
          </button>
        );
      case 'processing':
        return (
          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
            记录/验收
          </button>
        );
      case 'suspended':
        return (
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
            恢复处理
          </button>
        );
      case 'reviewing':
        return (
          <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
            验收
          </button>
        );
      default:
        return (
          <button className={styles.actionBtn} onClick={(e) => { e.stopPropagation(); openOrder(order); }}>
            查看
          </button>
        );
    }
  };

  const renderColumn = (column: typeof STATUS_COLUMNS[number]) => {
    const columnOrders = orders.filter(order => column.statuses.includes(order.status?.toLowerCase()));
    const ColumnIcon = column.icon;

    return (
      <div className={styles.kanbanColumn} key={column.key}>
        <div className={styles.columnHeader}>
          <h3><ColumnIcon size={16} /> {column.title}</h3>
          <span className={styles.countBadge}>{loading ? '-' : columnOrders.length}</span>
        </div>
        <div className={styles.orderList}>
          {columnOrders.map(order => (
            <div
              key={order.id}
              className={`${styles.orderCard} ${order.isOvertime ? styles.overtimeCard : ''}`}
              onClick={(e) => handleCardClick(order, e)}
            >
              <div className={styles.orderHeader}>
                <span className={styles.orderId}>{order.orderNo}</span>
                <span className={`${styles.priorityBadge} ${getPriorityStyle(order.priority)}`}>
                  {order.priority || 'P2'}
                </span>
              </div>

              <div className={styles.statusLine}>
                <span>{statusText(order.status)}</span>
                {order.isOvertime && <strong>超时</strong>}
              </div>

              {order.device && (
                <div className={styles.orderDevice}>
                  {order.device.deviceNo ? `${order.device.deviceNo} · ` : ''}{order.device.name}
                </div>
              )}

              <h4 className={styles.orderTitle} title={order.faultDesc}>
                {order.faultDesc || '未填写故障描述'}
              </h4>

              {order.rejectReason && (
                <div className={styles.reasonText}>原因：{order.rejectReason}</div>
              )}

              <div className={styles.cardFooter}>
                <div className={styles.assignee}>
                  <div className={styles.avatar}>
                    {(getAssigneeName(order) || '?').charAt(0).toUpperCase()}
                  </div>
                  <span title={`报修人：${getReporterName(order)}`}>{getAssigneeName(order)}</span>
                </div>
                <div className={styles.cardActions}>{renderAction(order)}</div>
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

  const hasFilter = Boolean(filterStatus || filterPriority || keyword.trim());

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>工单调度中心</h1>
          <p className={styles.pageSubtitle}>按闭环流程管理报修、派单、维修记录、验收归档与取消退回。</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.secondaryBtn} ${hasFilter ? styles.filterActive : ''}`}
            onClick={() => setShowFilter(!showFilter)}
          >
            <Filter size={16} />
            {hasFilter ? `筛选中 (${[filterStatus, filterPriority, keyword.trim()].filter(Boolean).length})` : '筛选'}
          </button>
          <button className={styles.secondaryBtn} onClick={fetchOrders} disabled={loading}>
            <RefreshCw size={16} className={loading ? styles.spin : ''} />
            刷新
          </button>
          {user?.role !== 'viewer' && (
            <button className={styles.primaryBtn} onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> 新增报修
            </button>
          )}
        </div>
      </div>

      <div className={styles.summaryRow}>
        {STATUS_COLUMNS.map(column => (
          <div className={styles.summaryItem} key={column.key}>
            <span>{column.title}</span>
            <strong>{summary[column.key] || 0}</strong>
          </div>
        ))}
      </div>

      {showFilter && (
        <div className={styles.filterBar}>
          <div className={styles.searchInput}>
            <Search size={16} />
            <input
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="搜索工单号、设备、故障描述"
            />
          </div>
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={event => setFilterStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select
            className={styles.filterSelect}
            value={filterPriority}
            onChange={event => setFilterPriority(event.target.value)}
          >
            {PRIORITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {hasFilter && (
            <button className={styles.clearFilterBtn} onClick={() => { setFilterStatus(''); setFilterPriority(''); setKeyword(''); }}>
              <X size={14} /> 清除筛选
            </button>
          )}
        </div>
      )}

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.kanbanBoard}>
        {STATUS_COLUMNS.map(renderColumn)}
      </div>

      <OrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchOrders}
      />

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          initialAssignOpen={openAssignOnSelect}
          onClose={() => setSelectedOrder(null)}
          onUpdated={handleOrderUpdated}
        />
      )}
    </div>
  );
}
