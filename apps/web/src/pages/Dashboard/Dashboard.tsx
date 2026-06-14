import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
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

function toPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

function maxFrom<T>(rows: T[], pick: (row: T) => number) {
  return Math.max(1, ...rows.map(pick));
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
      setError(getErrorMessage(err, '控制台数据加载失败，请确认已登录、已选择项目，并且后端服务正常'));
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
    { title: '故障率', value: operations ? `${operations.overview.faultRateByOrders}%` : '-', icon: AlertTriangle, color: '#EF4444', bgColor: 'rgba(239,68,68,0.1)' },
    { title: '平均维修', value: operations ? `${operations.overview.avgRepairHours}h` : '-', icon: Activity, color: '#2563EB', bgColor: 'rgba(37,99,235,0.1)' },
    { title: '今日巡检', value: todayInspections || '-', icon: Lightbulb, color: '#059669', bgColor: 'rgba(5,150,105,0.1)' },
    { title: '超时工单', value: operations?.overview.overtimeOrders ?? '-', icon: Users, color: '#F97316', bgColor: 'rgba(249,115,22,0.1)' },
  ], [engineerCount, operations, todayInspections]);

  const closedRate = operations ? toPercent(operations.overview.closedOrders, operations.overview.totalOrders) : 0;
  const openOrders = operations ? Math.max(operations.overview.totalOrders - operations.overview.closedOrders, 0) : 0;
  const faultMax = maxFrom(operations?.faultTypes || [], row => toNumber(row.count));
  const repeatFaultMax = maxFrom(operations?.repeatFaultDevices || [], row => toNumber(row.fault_count));
  const partsMax = maxFrom(operations?.partsConsumption || [], row => toNumber(row.consumed_quantity));
  const riskItems = [
    { label: '超时工单', value: overdueOrders.length, tone: 'danger', detail: '需要优先派单或催办' },
    { label: '低库存备件', value: lowStockParts.length, tone: 'warning', detail: '低于安全库存线' },
    { label: '重复故障设备', value: operations?.repeatFaultDevices.length || 0, tone: 'info', detail: '近 30 天多次报修' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.pageTitle}>控制台概览</h1>
          <p className={styles.pageSubtitle}>汇总最近 30 天的工单、设备、巡检、备件和维修绩效数据。</p>
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {overdueOrders.length > 0 && (
        <div className={styles.todoBanner}>
          <div className={styles.todoIcon}>
            <AlertTriangle size={18} />
          </div>
          <div className={styles.todoContent}>
            <strong>今日重点待办</strong>
            <span>{overdueOrders.length} 张工单已超过处理时限，建议优先派单、催办或记录原因。</span>
          </div>
          <button className={styles.todoBtn} onClick={() => navigate('/orders')}>查看工单</button>
        </div>
      )}

      {lowStockParts.length > 0 && (
        <div className={styles.todoBanner}>
          <div className={`${styles.todoIcon} ${styles.todoIconWarning}`}>
            <Package size={18} />
          </div>
          <div className={styles.todoContent}>
            <strong>备件补货提醒</strong>
            <span>{lowStockParts.length} 种备件低于安全库存：{lowStockParts.map(p => `${p.name}（剩余 ${p.stock}${p.unit}）`).join('、')}</span>
          </div>
          <button className={styles.todoBtn} onClick={() => navigate('/parts')}>查看库存</button>
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
        <div className={styles.insightGrid}>
          <InsightCard title="闭环健康度" badge="近 30 天">
            <div className={styles.healthPanel}>
              <div className={styles.gauge} style={{ '--gauge-value': `${closedRate}%` } as CSSProperties}>
                <div className={styles.gaugeInner}>
                  <strong>{closedRate}%</strong>
                  <span>闭环率</span>
                </div>
              </div>
              <div className={styles.progressStack}>
                <ProgressRow label="已归档" value={operations.overview.closedOrders} total={operations.overview.totalOrders} color="#10B981" />
                <ProgressRow label="未闭环" value={openOrders} total={operations.overview.totalOrders} color="#F59E0B" />
                <ProgressRow label="超时" value={operations.overview.overtimeOrders} total={operations.overview.totalOrders} color="#EF4444" />
              </div>
            </div>
          </InsightCard>

          <InsightCard title="故障类型热度" badge={`${operations.overview.faultOrders} 个故障工单`}>
            <RankBars
              emptyText="暂无故障数据"
              rows={operations.faultTypes.slice(0, 5).map(row => ({
                key: row.fault_type || 'unknown',
                label: row.fault_type || '未分类',
                value: toNumber(row.count),
                max: faultMax,
                unit: '次',
                color: '#EF4444',
              }))}
            />
          </InsightCard>

          <InsightCard title="重复故障设备" badge="按近 30 天统计">
            <RankBars
              emptyText="暂无重复故障"
              rows={operations.repeatFaultDevices.slice(0, 5).map(row => ({
                key: `${row.device_no}-${row.device_name}`,
                label: `${row.device_no || '未绑定'} · ${row.device_name || '未命名设备'}`,
                value: toNumber(row.fault_count),
                max: repeatFaultMax,
                unit: '次',
                color: '#F97316',
              }))}
            />
          </InsightCard>

          <InsightCard title="人员绩效" badge="完工率 / 平均时长">
            <RankBars
              emptyText="暂无人员数据"
              rows={operations.engineerPerformance.slice(0, 5).map(row => {
                const totalOrders = toNumber(row.total_orders);
                const closedOrders = toNumber(row.closed_orders);
                return {
                  key: row.engineer_name || 'unknown',
                  label: row.engineer_name || '未命名工程师',
                  value: toPercent(closedOrders, totalOrders),
                  max: 100,
                  unit: `% · ${closedOrders}/${totalOrders} · ${toNumber(row.avg_repair_hours).toFixed(1)}h`,
                  color: '#8B5CF6',
                };
              })}
            />
          </InsightCard>

          <InsightCard title="备件消耗" badge="按出库统计">
            <RankBars
              emptyText="暂无备件消耗"
              rows={operations.partsConsumption.slice(0, 5).map(row => ({
                key: row.part_name || 'unknown',
                label: row.part_name || '未命名备件',
                value: toNumber(row.consumed_quantity),
                max: partsMax,
                unit: row.unit || '',
                color: '#0EA5E9',
              }))}
            />
          </InsightCard>

          <InsightCard title="风险关注" badge="现场优先级">
            <div className={styles.riskGrid}>
              {riskItems.map(item => (
                <button
                  type="button"
                  key={item.label}
                  className={`${styles.riskItem} ${styles[item.tone]}`}
                  onClick={() => {
                    if (item.label === '超时工单') navigate('/orders');
                    if (item.label === '低库存备件') navigate('/parts');
                    if (item.label === '重复故障设备') navigate('/reports');
                  }}
                >
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </button>
              ))}
            </div>
          </InsightCard>
        </div>
      )}
    </div>
  );
}

function InsightCard({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3>{title}</h3>
        <span className={styles.chartBadge}>{badge}</span>
      </div>
      {children}
    </div>
  );
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const percent = toPercent(value, total);
  return (
    <div className={styles.progressRow}>
      <div className={styles.progressMeta}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function RankBars({ rows, emptyText }: {
  rows: Array<{ key: string; label: string; value: number; max: number; unit: string; color: string }>;
  emptyText: string;
}) {
  if (rows.length === 0) return <span className={styles.emptyText}>{emptyText}</span>;
  return (
    <div className={styles.rankList}>
      {rows.map(row => (
        <div className={styles.rankRow} key={row.key}>
          <div className={styles.rankTop}>
            <span>{row.label}</span>
            <strong>{row.value}{row.unit}</strong>
          </div>
          <div className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${toPercent(row.value, row.max)}%`, backgroundColor: row.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
