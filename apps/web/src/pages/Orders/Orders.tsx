import React, { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import styles from './Orders.module.css';

interface Order {
  id: string;
  orderNo: string;
  faultDesc: string;
  status: string;
  priority: string;
  reporter?: { name: string };
  createdAt: string;
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await apiClient.get('/orders');
        setOrders(res.items || res || []);
      } catch (err) {
        console.error('Failed to fetch orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);
  const getStatusIcon = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'pending': return <AlertCircle size={16} className={styles.iconTodo} />;
      case 'processing':
      case 'assigned': return <Clock size={16} className={styles.iconProgress} />;
      case 'closed': return <CheckCircle2 size={16} className={styles.iconDone} />;
      default: return null;
    }
  };

  const getPriorityStyle = (priority: string) => {
    const p = priority?.toUpperCase();
    switch (p) {
      case 'P0':
      case 'P1': return styles.priorityHigh;
      case 'P2': return styles.priorityMedium;
      case 'P3': return styles.priorityLow;
      default: return '';
    }
  };

  const renderColumn = (status: string[], title: string) => {
    const columnOrders = orders.filter(o => status.includes(o.status?.toLowerCase()));
    
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
              <h4 className={styles.orderTitle}>{order.faultDesc.substring(0, 30)}...</h4>
              <div className={styles.orderFooter}>
                <div className={styles.orderMeta}>
                  {getStatusIcon(order.status)}
                  <span>{order.reporter?.name || '未知'}</span>
                </div>
                <span className={styles.orderTime}>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>工单调度中心</h1>
          <p className={styles.pageSubtitle}>使用看板视图管理故障报修、巡检任务及维修进度。</p>
        </div>
        <button className={styles.primaryBtn}>
          <Plus size={16} /> 极速派单
        </button>
      </div>

      <div className={styles.kanbanBoard}>
        {renderColumn(['pending'], '待处理 (To Do)')}
        {renderColumn(['assigned', 'processing'], '处理中 (In Progress)')}
        {renderColumn(['closed'], '已完成 (Done)')}
      </div>
    </div>
  );
}
