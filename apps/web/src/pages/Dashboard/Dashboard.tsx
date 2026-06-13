import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, Lightbulb, Package, Users } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from './Dashboard.module.css';

interface OperationsSummary {
  overview: {
    totalOrders: number;
    faultOrders: number;
    closedOrders: number;
    overtimeOrders: number;
    deviceCount: number;
    faultRateByOrders: number;
    faultRateByDevices: number;
    avgRepairHours: number;
    avgResponseHours: number;
  };
  faultTypes: Array<{ fault_type: string; count: number }>;
  repeatFaultDevices: Array<{ device_no: string; device_name: string; fault_count: number; last_fault_at: string }>;
  engineerPerformance: Array<{ engineer_name: string; total_orders: number; closed_orders: number; avg_repair_hours: number }>;
  partsConsumption: Array<{ part_name: string; consumed_quantity: number; unit?: string; order_count: number }>;
}

interface WeeklyTrendRow {
  day_of_week?: number | string;
  date_str?: string;
  new_orders?: number | string;
  solved?: number | string;
}

interface DeviceStatusRow {
  status: string;
  count: number | string;
}

interface PartRankRow {
  name: string;
  total_consumed: number | string;
}

const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const statusLabels: Record<string, string> = {
  normal: '正常运行',
  maintenance: '维修中',
  fault: '故障',
  offline: '离线',
  retired: '退役',
};

const statusColors: Record<string, string> = {
  normal: '#10B981',
  maintenance: '#F59E0B',
  fault: '#EF4444',
  offline: '#6B7280',
  retired: '#94A3B8',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function toNumber(value: unknown) {
  return Number(value) || 0;
}

function normalizeTrend(rows: WeeklyTrendRow[]) {
  return rows.map(row => ({
    name: row.date_str ? `${dayNames[Number(row.day_of_week) || 0]} ${String(row.date_str).slice(5)}` : dayNames[Number(row.day_of_week) || 0],
    newOrders: toNumber(row.new_orders),
    solved: toNumber(row.solved),
  }));
}

function normalizeDeviceStatus(rows: DeviceStatusRow[]) {
  return rows.map(row => ({
    name: statusLabels[row.status] || row.status || '未分类',
    value: toNumber(row.count),
    color: statusColors[row.status] || '#0EA5E9',
  }));
}

function normalizePartsRank(rows: PartRankRow[]) {
  return rows.map(row => ({
    name: row.name || '未命名备件',
    consumed: toNumber(row.total_consumed),
  }));
}

export default function Dashboard() {
  const [operations, setOperations] = useState<OperationsSummary | null>(null);
  const [trendData, setTrendData] = useState<Array<{ name: string; newOrders: number; solved: number }>>([]);
  const [deviceStatusData, setDeviceStatusData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [partsData, setPartsData] = useState<Array<{ name: string; consumed: number }>>([]);
  const [engineerCount, setEngineerCount] = useState(0);
  const [todayInspections, setTodayInspections] = useState(0);
  const [error, setError] = useState('');
  const [overdueOrders, setOverdueOrders] = useState<Array<{ id: string; orderNo: string; status: string; faultDesc: string }>>([]);
  const [lowStockParts, setLowStockParts] = useState<Array<{ id: string; name: string; stock: number; minStock: number; unit: string }>>([]);
  const navigate = useNavigate();

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      const [summary, trend, deviceStatus, partsRank, users, inspectionStats, overdueRes, lowStockRes] = await Promise.all([
        apiClient.get<OperationsSummary>(`/reports/operations-summary?startDate=${daysAgo(30)}&endDate=${today()}`).catch(() => null),
        apiClient.get<WeeklyTrendRow[]>('/reports/weekly-trend').catch(() => []),
        apiClient.get<DeviceStatusRow[]>('/reports/device-status').catch(() => []),
        apiClient.get<PartRankRow[]>('/reports/parts-rank').catch(() => []),
        apiClient.get<{ items?: Array<{ id: string }> } | Array<{ id: string }>>('/users?role=engineer&pageSize=200'),
        apiClient.get<{ totalPlans?: number; todayRecords?: number }>('/inspections/stats'),
        apiClient.get<{ items: Array<{ id: string; orderNo: string; status: string; faultDesc: string }> }>('/orders/overdue').catch(() => ({ items: [] })),
        apiClient.get<Array<{ id: string; name: string; stock: number; minStock: number; unit: string }>>('/parts/low-stock-alerts').catch(() => []),
      ]);

      setOperations(summary);
      setTrendData(normalizeTrend(Array.isArray(trend) ? trend : []));
      setDeviceStatusData(normalizeDeviceStatus(Array.isArray(deviceStatus) ? deviceStatus : []));
      setPartsData(normalizePartsRank(Array.isArray(partsRank) ? partsRank : []));
      setEngineerCount(Array.isArray(users) ? users.length : users.items?.length || 0);
      setTodayInspections(toNumber(inspectionStats.todayRecords));
      setOverdueOrders(overdueRes.items || []);
      setLowStockParts(Array.isArray(lowStockRes) ? lowStockRes : []);
    } catch (err) {
      setError(getErrorMessage(err, '控制台数据加载失败，请确认已登录、已选择项目并且后端服务正常'));
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statCards = useMemo(() => [
    { title: '工单总数', value: operations?.overview.totalOrders ?? '-', icon: Activity, color: '#0EA5E9', bgColor: 'rgba(14,165,233,0.1)' },
    { title: '待闭环工单', value: operations ? Math.max(operations.overview.totalOrders - operations.overview.closedOrders, 0) : '-', icon: AlertTriangle, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
    { title: '设备总数', value: operations?.overview.deviceCount ?? '-', icon: Lightbulb, color: '#10B981', bgColor: 'rgba(16,185,129,0.1)' },
    { title: '工程师', value: engineerCount || '-', icon: Users, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)' },
    { title: '故障率（按工单）', value: operations ? `${operations.overview.faultRateByOrders}%` : '-', icon: AlertTriangle, color: '#EF4444', bgColor: 'rgba(239,68,68,0.1)' },
    { title: '平均维修时长', value: operations ? `${operations.overview.avgRepairHours}h` : '-', icon: Activity, color: '#2563EB', bgColor: 'rgba(37,99,235,0.1)' },
    { title: '今日已巡检', value: todayInspections || '-', icon: Lightbulb, color: '#059669', bgColor: 'rgba(5,150,105,0.1)' },
    { title: '超时工单', value: operations?.overview.overtimeOrders ?? '-', icon: Users, color: '#F97316', bgColor: 'rgba(249,115,22,0.1)' },
  ], [engineerCount, operations, todayInspections]);

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.pageTitle}>控制台概览</h1>
          <p className={styles.pageSubtitle}>汇总最近 30 天的工单、设备、巡检、备件和维修绩效数据。</p>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* 超时工单预警横幅 */}
      {overdueOrders.length > 0 && (
        <div className={styles.alertBanner} style={{ background: 'rgba(239,68,68,0.08)', borderColor: '#EF4444' }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontWeight: 600, color: '#EF4444' }}>⚠️ {overdueOrders.length} 张工单超时未处理！</span>
          <span style={{ color: '#6B7280', fontSize: 13 }}>这些工单超过 48 小时或已过 SLA 截止时间，请尽快处理。</span>
          <button className={styles.alertBtn} onClick={() => navigate('/orders')}>立即查看</button>
        </div>
      )}

      {/* 低库存预警横幅 */}
      {lowStockParts.length > 0 && (
        <div className={styles.alertBanner} style={{ background: 'rgba(245,158,11,0.08)', borderColor: '#F59E0B' }}>
          <Package size={18} color="#F59E0B" />
          <span style={{ fontWeight: 600, color: '#F59E0B' }}>库存预警：{lowStockParts.length} 种备件低于安全库存</span>
          <span style={{ color: '#6B7280', fontSize: 13 }}>{lowStockParts.map(p => `${p.name}（剩余${p.stock}${p.unit}）`).join('、')}</span>
          <button className={styles.alertBtn} style={{ borderColor: '#F59E0B', color: '#F59E0B' }} onClick={() => navigate('/parts')}>去补货</button>
        </div>
      )}

      <div className={styles.statsGrid}>
        {statCards.map(stat => (
          <div key={stat.title} className={styles.statCard}>
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
        <div className={styles.chartCardWide}>
          <div className={styles.chartHeader}>
            <h3>工单处理趋势（近 7 天）</h3>
            <span className={styles.chartBadge}>真实接口</span>
          </div>
          <div className={styles.chartArea}>
            {trendData.length === 0 ? (
              <div className={styles.emptyChart}>暂无趋势数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-8} allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                  <Line type="monotone" name="新增报修" dataKey="newOrders" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" name="已归档" dataKey="solved" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>设备状态分布</h3>
          </div>
          <div className={styles.chartArea}>
            {deviceStatusData.length === 0 ? (
              <div className={styles.emptyChart}>暂无设备数据</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={deviceStatusData} cx="50%" cy="45%" innerRadius={55} outerRadius={88} paddingAngle={3} dataKey="value">
                    {deviceStatusData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} 台`, '数量']} />
                  <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>备件消耗排行</h3>
          </div>
          <div className={styles.chartArea}>
            {partsData.length === 0 ? (
              <div className={styles.emptyChart}>暂无出库消耗</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partsData} layout="vertical" margin={{ left: 24, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4B5563', fontSize: 11 }} width={86} />
                  <RechartsTooltip cursor={{ fill: '#F3F4F6' }} />
                  <Bar dataKey="consumed" name="消耗量" fill="#0EA5E9" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {operations && (
        <div className={styles.reportGrid}>
          <ReportCard title="故障类型排行" badge={`${operations.overview.faultOrders} 个故障工单`}>
            {operations.faultTypes.length > 0 ? operations.faultTypes.map(row => (
              <div key={row.fault_type} className={styles.tableRow}>
                <span>{row.fault_type}</span>
                <strong>{toNumber(row.count)} 次</strong>
              </div>
            )) : <span className={styles.emptyText}>暂无故障数据</span>}
          </ReportCard>

          <ReportCard title="重复故障设备" badge="按近 30 天统计">
            {operations.repeatFaultDevices.length > 0 ? operations.repeatFaultDevices.map(row => (
              <div key={`${row.device_no}-${row.device_name}`} className={styles.tableRow}>
                <span>{row.device_no || '未绑定'} · {row.device_name || '未命名设备'}</span>
                <strong>{toNumber(row.fault_count)} 次</strong>
              </div>
            )) : <span className={styles.emptyText}>暂无重复故障</span>}
          </ReportCard>

          <ReportCard title="人员绩效" badge="完工 / 总单 / 平均时长">
            {operations.engineerPerformance.length > 0 ? operations.engineerPerformance.map(row => (
              <div key={row.engineer_name || 'unknown'} className={styles.tableRow}>
                <span>{row.engineer_name || '未命名工程师'}</span>
                <strong>{toNumber(row.closed_orders)}/{toNumber(row.total_orders)} · {toNumber(row.avg_repair_hours).toFixed(1)}h</strong>
              </div>
            )) : <span className={styles.emptyText}>暂无人员数据</span>}
          </ReportCard>

          <ReportCard title="备件消耗" badge="按出库统计">
            {operations.partsConsumption.length > 0 ? operations.partsConsumption.map(row => (
              <div key={row.part_name} className={styles.tableRow}>
                <span>{row.part_name}</span>
                <strong>{toNumber(row.consumed_quantity)} {row.unit || ''}</strong>
              </div>
            )) : <span className={styles.emptyText}>暂无备件消耗</span>}
          </ReportCard>
        </div>
      )}
    </div>
  );
}

function ReportCard({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3>{title}</h3>
        <span className={styles.chartBadge}>{badge}</span>
      </div>
      <div className={styles.tableList}>{children}</div>
    </div>
  );
}
