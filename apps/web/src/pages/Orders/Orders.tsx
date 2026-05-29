import React from 'react';
import { Plus, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import styles from './Orders.module.css';

const MOCK_ORDERS = [
  { id: 'WO-2026-0529-01', title: '主舞台A区频闪灯无响应', status: 'TODO', priority: 'HIGH', creator: '张工', time: '10:30 AM' },
  { id: 'WO-2026-0529-02', title: '观众席走道灯亮度异常', status: 'IN_PROGRESS', priority: 'MEDIUM', creator: '李工', time: '11:15 AM' },
  { id: 'WO-2026-0528-14', title: 'MA3控台按键粘滞清理', status: 'DONE', priority: 'LOW', creator: '王工', time: '昨天' },
  { id: 'WO-2026-0528-15', title: '线缆老化更换', status: 'TODO', priority: 'LOW', creator: '刘工', time: '昨天' },
];

export default function Orders() {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TODO': return <AlertCircle size={16} className={styles.iconTodo} />;
      case 'IN_PROGRESS': return <Clock size={16} className={styles.iconProgress} />;
      case 'DONE': return <CheckCircle2 size={16} className={styles.iconDone} />;
      default: return null;
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'HIGH': return styles.priorityHigh;
      case 'MEDIUM': return styles.priorityMedium;
      case 'LOW': return styles.priorityLow;
      default: return '';
    }
  };

  const renderColumn = (status: string, title: string) => {
    const columnOrders = MOCK_ORDERS.filter(o => o.status === status);
    
    return (
      <div className={styles.kanbanColumn}>
        <div className={styles.columnHeader}>
          <h3>{title}</h3>
          <span className={styles.countBadge}>{columnOrders.length}</span>
        </div>
        <div className={styles.orderList}>
          {columnOrders.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <span className={styles.orderId}>{order.id}</span>
                <span className={`${styles.priorityBadge} ${getPriorityStyle(order.priority)}`}>
                  {order.priority}
                </span>
              </div>
              <h4 className={styles.orderTitle}>{order.title}</h4>
              <div className={styles.orderFooter}>
                <div className={styles.orderMeta}>
                  {getStatusIcon(order.status)}
                  <span>{order.creator}</span>
                </div>
                <span className={styles.orderTime}>{order.time}</span>
              </div>
            </div>
          ))}
          {columnOrders.length === 0 && (
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
        {renderColumn('TODO', '待处理 (To Do)')}
        {renderColumn('IN_PROGRESS', '处理中 (In Progress)')}
        {renderColumn('DONE', '已完成 (Done)')}
      </div>
    </div>
  );
}
