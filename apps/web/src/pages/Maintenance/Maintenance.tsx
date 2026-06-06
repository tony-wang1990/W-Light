import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, RefreshCw, Search, Wrench } from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

interface Order {
  id: string;
  orderNo: string;
  status: string;
  priority?: string;
  faultType?: string;
  faultDesc?: string;
  repairCost?: number;
  createdAt?: string;
  closedAt?: string;
  device?: { deviceNo?: string; name?: string };
  assignee?: { name?: string };
  assigneeName?: string;
}

interface RepairLog {
  id: string;
  stepType?: string;
  stepDesc?: string;
  loggedAt?: string;
  engineer?: { name?: string };
  partUsages?: Array<{ name?: string; quantity: number; unit?: string; note?: string }>;
  outsourceVendor?: string;
  outsourceCost?: number;
}

type ListResponse<T> = T[] | { items?: T[] };

const STATUS_LABELS: Record<string, string> = {
  pending: '待派单',
  assigned: '已派单',
  processing: '处理中',
  suspended: '已挂起',
  reviewing: '待验收',
  closed: '已归档',
  rejected: '已取消',
};

function normalizeList<T>(res: ListResponse<T>): T[] {
  return Array.isArray(res) ? res : res.items || [];
}

export default function Maintenance() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [logs, setLogs] = useState<RepairLog[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ pageSize: '300' });
      if (keyword.trim()) params.set('keyword', keyword.trim());
      const res = await apiClient.get<ListResponse<Order>>(`/orders?${params.toString()}`);
      const list = normalizeList(res);
      setOrders(list);
      if (!selectedOrderId && list[0]?.id) setSelectedOrderId(list[0].id);
    } catch (err) {
      setError(getErrorMessage(err, '维修台账加载失败'));
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedOrderId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const selectedOrder = useMemo(
    () => orders.find(order => order.id === selectedOrderId),
    [orders, selectedOrderId],
  );

  const fetchLogs = useCallback(async () => {
    if (!selectedOrderId) {
      setLogs([]);
      return;
    }

    setLoadingLogs(true);
    try {
      const res = await apiClient.get<ListResponse<RepairLog>>(`/orders/${selectedOrderId}/repair-logs`);
      setLogs(normalizeList(res));
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const ledgerStats = useMemo(() => {
    const closed = orders.filter(order => order.status === 'closed').length;
    const open = orders.filter(order => !['closed', 'rejected'].includes(order.status)).length;
    const cost = orders.reduce((sum, order) => sum + (Number(order.repairCost) || 0), 0);
    return { closed, open, cost };
  }, [orders]);

  const exportOrders = () => {
    apiClient.download('/reports/export/orders.xlsx', `w-light-maintenance-ledger-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>维修记录台账</h1>
          <p className={styles.pageSubtitle}>按工单沉淀维修步骤、备件消耗、外协费用、验收归档和设备历史，便于追溯和导出。</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={fetchOrders} disabled={loading}>
            <RefreshCw size={16} /> 刷新
          </button>
          <button className={styles.primaryBtn} onClick={exportOrders}>
            <Download size={16} /> 导出台账 Excel
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <span className={styles.muted}>闭环归档工单</span>
          <strong className={styles.statValue}>{ledgerStats.closed}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.muted}>未闭环工单</span>
          <strong className={styles.statValue}>{ledgerStats.open}</strong>
        </div>
        <div className={styles.card}>
          <span className={styles.muted}>登记维修费用</span>
          <strong className={styles.statValue}>¥{ledgerStats.cost.toFixed(2)}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div style={{ maxWidth: 360, flex: '1 1 260px' }}>
          <div className={styles.copyBox}>
            <Search size={16} />
            <input
              className={styles.input}
              style={{ border: 0, padding: 0, minHeight: 0, background: 'transparent' }}
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="搜索工单号、设备或故障描述"
            />
          </div>
        </div>
      </div>

      <div className={styles.wideGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>工单台账</h2>
            <span className={styles.muted}>{loading ? '加载中...' : `${orders.length} 条记录`}</span>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>工单号</th>
                  <th>设备</th>
                  <th>故障</th>
                  <th>状态</th>
                  <th>负责人</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={6}><div className={styles.empty}>暂无工单记录</div></td></tr>
                ) : orders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td><strong>{order.orderNo}</strong></td>
                    <td>{order.device ? `${order.device.deviceNo || ''} ${order.device.name || ''}` : '-'}</td>
                    <td>{order.faultType || order.faultDesc || '-'}</td>
                    <td>
                      <span className={`${styles.badge} ${order.status === 'closed' ? styles.successBadge : order.status === 'rejected' ? styles.dangerBadge : styles.warningBadge}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                    <td>{order.assigneeName || order.assignee?.name || '未指派'}</td>
                    <td>{order.closedAt ? new Date(order.closedAt).toLocaleDateString('zh-CN') : order.createdAt ? new Date(order.createdAt).toLocaleDateString('zh-CN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>维修过程</h2>
            <span className={styles.badge}><Wrench size={13} /> {logs.length}</span>
          </div>

          {selectedOrder ? (
            <div className={styles.list}>
              <div className={styles.listItemActive} style={{ padding: 12, borderRadius: 8 }}>
                <strong>{selectedOrder.orderNo}</strong>
                <div className={styles.muted} style={{ marginTop: 6 }}>{selectedOrder.faultDesc || selectedOrder.faultType}</div>
              </div>

              {loadingLogs ? (
                <div className={styles.empty}>维修记录加载中...</div>
              ) : logs.length === 0 ? (
                <div className={styles.empty}>该工单暂无维修步骤记录</div>
              ) : logs.map(log => (
                <div className={styles.listItem} key={log.id}>
                  <div className={styles.cardHeader} style={{ marginBottom: 8 }}>
                    <strong>{log.stepType || '维修记录'}</strong>
                    <span className={styles.muted}>{log.loggedAt ? new Date(log.loggedAt).toLocaleString('zh-CN') : '-'}</span>
                  </div>
                  <div className={styles.muted}>{log.stepDesc}</div>
                  {Array.isArray(log.partUsages) && log.partUsages.length > 0 && (
                    <div className={styles.actions} style={{ marginTop: 10 }}>
                      {log.partUsages.map((part, idx) => (
                        <span className={styles.badge} key={idx}>
                          {part.name || '备件'} × {part.quantity}{part.unit || ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {(log.outsourceVendor || log.outsourceCost) && (
                    <div className={styles.muted} style={{ marginTop: 8 }}>
                      外协：{log.outsourceVendor || '-'} {log.outsourceCost ? `¥${log.outsourceCost}` : ''}
                    </div>
                  )}
                  {log.engineer?.name && <div className={styles.muted} style={{ marginTop: 8 }}><FileText size={13} /> 记录人：{log.engineer.name}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>请选择左侧工单查看维修过程</div>
          )}
        </div>
      </div>
    </div>
  );
}
