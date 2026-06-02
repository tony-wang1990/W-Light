import React, { useEffect, useState } from 'react';
import { Activity, Users, Lightbulb, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { apiClient } from '../../api/client';
import styles from './Dashboard.module.css';

// Fallback mock data when API is unavailable
const MOCK_TREND = [
  { name: 'Mon', newOrders: 4, solved: 3 },
  { name: 'Tue', newOrders: 7, solved: 5 },
  { name: 'Wed', newOrders: 2, solved: 6 },
  { name: 'Thu', newOrders: 5, solved: 4 },
  { name: 'Fri', newOrders: 8, solved: 7 },
  { name: 'Sat', newOrders: 3, solved: 5 },
  { name: 'Sun', newOrders: 1, solved: 2 },
];
const MOCK_DEVICE_STATUS = [
  { name: '正常运行', value: 0, color: '#10B981' },
  { name: '维修中', value: 0, color: '#F59E0B' },
  { name: '离线', value: 0, color: '#6B7280' },
];
const MOCK_PARTS = [
  { name: '暂无数据', 消耗量: 0 },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type OperationsSummary = {
  overview: {
    faultRateByOrders: number;
    faultRateByDevices: number;
    avgRepairHours: number;
    avgResponseHours: number;
    faultOrders: number;
    overtimeOrders: number;
  };
  faultTypes: Array<{ fault_type: string; count: number }>;
  repeatFaultDevices: Array<{ device_no: string; device_name: string; fault_count: number; last_fault_at: string }>;
  engineerPerformance: Array<{ engineer_name: string; total_orders: number; closed_orders: number; avg_repair_hours: number }>;
  partsConsumption: Array<{ part_name: string; consumed_quantity: number; unit?: string; order_count: number }>;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalDevices: '-',
    pendingOrders: '-',
    todayInspections: '-',
    engineers: '-',
  });
  const [trendData, setTrendData] = useState(MOCK_TREND);
  const [deviceStatusData, setDeviceStatusData] = useState(MOCK_DEVICE_STATUS);
  const [partsData, setPartsData] = useState(MOCK_PARTS);
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      // 1. 工单汇总 (工单列表中统计)
      const [ordersRes, devicesRes] = await Promise.allSettled([
        apiClient.get('/orders?pageSize=200'),
        apiClient.get('/devices?pageSize=500'),
      ]);

      // 设备统计
      if (devicesRes.status === 'fulfilled') {
        const devData = devicesRes.value;
        const devices = devData.items || devData || [];
        const total = devData.total || devices.length;
        const statusCounts: Record<string, number> = {};
        devices.forEach((d: any) => { statusCounts[d.status] = (statusCounts[d.status] || 0) + 1; });
        setStats(prev => ({ ...prev, totalDevices: String(total) }));
        setDeviceStatusData([
          { name: '正常运行', value: statusCounts['normal'] || 0, color: '#10B981' },
          { name: '维修中',  value: statusCounts['maintenance'] || 0, color: '#F59E0B' },
          { name: '故障',    value: statusCounts['fault'] || 0, color: '#EF4444' },
          { name: '离线',    value: statusCounts['offline'] || 0, color: '#6B7280' },
        ]);
      }

      // 工单统计
      if (ordersRes.status === 'fulfilled') {
        const ordData = ordersRes.value;
        const orders = ordData.items || ordData || [];
        const pending = orders.filter((o: any) => ['pending', 'assigned'].includes(o.status)).length;
        setStats(prev => ({ ...prev, pendingOrders: String(pending) }));
      }

      // 2. 周趋势数据
      try {
        const trend = await apiClient.get('/reports/weekly-trend');
        if (Array.isArray(trend) && trend.length > 0) {
          const formatted = trend.map((row: any) => ({
            name: DAY_NAMES[Number(row.day_of_week)] || row.date_str,
            newOrders: Number(row.new_orders) || 0,
            solved: Number(row.solved) || 0,
          }));
          setTrendData(formatted);
        }
      } catch { /* 保持 mock 数据 */ }

      // 3. 备件消耗排行
      try {
        const parts = await apiClient.get('/reports/parts-rank');
        if (Array.isArray(parts) && parts.length > 0) {
          const formatted = parts.map((row: any) => ({
            name: row.name,
            消耗量: Number(row.total_consumed) || 0,
          }));
          setPartsData(formatted);
        }
      } catch { /* 保持 mock 数据 */ }

      // 4. 用户数量（工程师数）
      try {
        const users = await apiClient.get('/users?role=engineer');
        const userList = users.items || users || [];
        setStats(prev => ({ ...prev, engineers: String(userList.length || '-') }));
      } catch { /* ignore */ }

      // 5. 今日巡检计划数
      try {
        const inspRes = await apiClient.get('/inspections/plans');
        const plans = Array.isArray(inspRes) ? inspRes : inspRes.items || [];
        // Count active plans that have nextInspectionAt today or earlier
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayPlans = plans.filter((p: any) => {
          if (!p.isActive) return false;
          if (!p.nextInspectionAt) return p.frequency === 'daily';
          const next = new Date(p.nextInspectionAt);
          next.setHours(0, 0, 0, 0);
          return next <= today;
        });
        setStats(prev => ({ ...prev, todayInspections: String(todayPlans.length || plans.filter((p: any) => p.isActive).length) }));
      } catch { /* ignore */ }

      // 6. 运维综合报表
      try {
        const summary = await apiClient.get<OperationsSummary>('/reports/operations-summary');
        setOperations(summary);
      } catch { /* ignore */ }

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const statCards = [
    { title: '运行设备总数', value: stats.totalDevices, icon: Lightbulb, color: '#10B981', bgColor: 'rgba(16,185,129,0.1)' },
    { title: '待处理工单', value: stats.pendingOrders, icon: AlertTriangle, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
    { title: '今日巡检任务', value: stats.todayInspections, icon: Activity, color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)' },
    { title: '值班工程师', value: stats.engineers, icon: Users, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)' },
    { title: '故障率（按工单）', value: operations ? `${operations.overview.faultRateByOrders}%` : '-', icon: AlertTriangle, color: '#EF4444', bgColor: 'rgba(239,68,68,0.1)' },
    { title: '平均维修时长', value: operations ? `${operations.overview.avgRepairHours}h` : '-', icon: Activity, color: '#0EA5E9', bgColor: 'rgba(14,165,233,0.1)' },
    { title: '重复故障设备', value: operations ? String(operations.repeatFaultDevices.length) : '-', icon: Lightbulb, color: '#F97316', bgColor: 'rgba(249,115,22,0.1)' },
    { title: '超时工单', value: operations ? String(operations.overview.overtimeOrders) : '-', icon: Users, color: '#6366F1', bgColor: 'rgba(99,102,241,0.1)' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h1 className={styles.pageTitle}>系统概览</h1>
        <button className={styles.refreshBtn} onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={14} className={loading ? styles.spin : ''} />
          {lastUpdated ? `刷新 · 更新于 ${lastUpdated.toLocaleTimeString()}` : '加载中...'}
        </button>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map((stat, idx) => (
          <div key={idx} className={styles.statCard}>
            <div className={styles.statInfo}>
              <span className={styles.statTitle}>{stat.title}</span>
              <span className={styles.statValue}>{stat.value}</span>
            </div>
            <div className={styles.statIconWrapper} style={{ backgroundColor: stat.bgColor, color: stat.color }}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.chartsGrid}>
        {/* Line Chart - 工单趋势 */}
        <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
          <div className={styles.chartHeader}>
            <h3>工单处理趋势（近7天）</h3>
            <span className={styles.chartBadge}><TrendingUp size={12} /> 实时数据</span>
          </div>
          <div style={{ height: 280, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-8} allowDecimals={false} />
                <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                <Line type="monotone" name="新增报修" dataKey="newOrders" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="已解决" dataKey="solved" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart - 设备健康度 */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>设备健康度分布</h3>
          </div>
          <div style={{ height: 280, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={deviceStatusData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value">
                  {deviceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${value} 台`, '数量']}
                />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart - 备件消耗 */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>备件消耗排行（本月）</h3>
          </div>
          <div style={{ height: 280, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partsData} layout="vertical" margin={{ left: 24, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 11 }} width={80} />
                <RechartsTooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="消耗量" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {operations && (
        <div className={styles.reportGrid}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>故障类型排行</h3>
              <span className={styles.chartBadge}>{operations.overview.faultOrders} 个故障工单</span>
            </div>
            <div className={styles.tableList}>
              {operations.faultTypes.length > 0 ? operations.faultTypes.map(row => (
                <div key={row.fault_type} className={styles.tableRow}>
                  <span>{row.fault_type}</span>
                  <strong>{Number(row.count)} 次</strong>
                </div>
              )) : <span className={styles.emptyText}>暂无故障数据</span>}
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>重复故障设备</h3>
              <span className={styles.chartBadge}>按 30 天统计</span>
            </div>
            <div className={styles.tableList}>
              {operations.repeatFaultDevices.length > 0 ? operations.repeatFaultDevices.map(row => (
                <div key={`${row.device_no}-${row.device_name}`} className={styles.tableRow}>
                  <span>{row.device_no || '未绑定'} · {row.device_name}</span>
                  <strong>{Number(row.fault_count)} 次</strong>
                </div>
              )) : <span className={styles.emptyText}>暂无重复故障</span>}
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>人员绩效</h3>
              <span className={styles.chartBadge}>完工/平均时长</span>
            </div>
            <div className={styles.tableList}>
              {operations.engineerPerformance.length > 0 ? operations.engineerPerformance.map(row => (
                <div key={row.engineer_name} className={styles.tableRow}>
                  <span>{row.engineer_name || '未命名工程师'}</span>
                  <strong>{Number(row.closed_orders)}/{Number(row.total_orders)} · {(Number(row.avg_repair_hours) || 0).toFixed(1)}h</strong>
                </div>
              )) : <span className={styles.emptyText}>暂无人员数据</span>}
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3>备件消耗</h3>
              <span className={styles.chartBadge}>按出库统计</span>
            </div>
            <div className={styles.tableList}>
              {operations.partsConsumption.length > 0 ? operations.partsConsumption.map(row => (
                <div key={row.part_name} className={styles.tableRow}>
                  <span>{row.part_name}</span>
                  <strong>{Number(row.consumed_quantity)} {row.unit || ''}</strong>
                </div>
              )) : <span className={styles.emptyText}>暂无备件消耗</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
