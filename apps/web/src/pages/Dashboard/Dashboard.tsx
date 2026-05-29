import React from 'react';
import { Activity, Users, Lightbulb, AlertTriangle } from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, Legend
} from 'recharts';
import styles from './Dashboard.module.css';

// Mock Data for Charts
const orderTrendData = [
  { name: 'Mon', newOrders: 4, solved: 3 },
  { name: 'Tue', newOrders: 7, solved: 5 },
  { name: 'Wed', newOrders: 2, solved: 6 },
  { name: 'Thu', newOrders: 5, solved: 4 },
  { name: 'Fri', newOrders: 8, solved: 7 },
  { name: 'Sat', newOrders: 3, solved: 5 },
  { name: 'Sun', newOrders: 1, solved: 2 },
];

const deviceStatusData = [
  { name: '正常运行', value: 1100, color: '#10B981' },
  { name: '维修中', value: 85, color: '#F59E0B' },
  { name: '已报废', value: 45, color: '#EF4444' },
  { name: '离线', value: 18, color: '#6B7280' },
];

const partsConsumptionData = [
  { name: '330W 灯泡', 消耗量: 145 },
  { name: 'DMX 信号线', 消耗量: 80 },
  { name: '保险丝 5A', 消耗量: 65 },
  { name: '电源线', 消耗量: 45 },
  { name: '色片', 消耗量: 30 },
];

export default function Dashboard() {
  const stats = [
    { title: '运行设备总数', value: '1,248', icon: Lightbulb, color: '#10B981', bgColor: 'rgba(16,185,129,0.1)' },
    { title: '待处理工单', value: '12', icon: AlertTriangle, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
    { title: '今日巡检任务', value: '45', icon: Activity, color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)' },
    { title: '值班工程师', value: '8', icon: Users, color: '#8B5CF6', bgColor: 'rgba(139,92,246,0.1)' },
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>系统概览</h1>
      
      <div className={styles.statsGrid}>
        {stats.map((stat, idx) => (
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
        {/* Line Chart */}
        <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
          <h3>工单处理趋势 (近7天)</h3>
          <div style={{ height: 300, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={orderTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} dx={-10} />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 20 }} />
                <Line type="monotone" name="新增报修" dataKey="newOrders" stroke="#F59E0B" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                <Line type="monotone" name="已解决" dataKey="solved" stroke="#10B981" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className={styles.chartCard}>
          <h3>设备健康度分布</h3>
          <div style={{ height: 300, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {deviceStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  formatter={(value) => [`${value} 台`, '数量']}
                />
                <Legend iconType="circle" layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart */}
        <div className={styles.chartCard}>
          <h3>本月备件消耗排行</h3>
          <div style={{ height: 300, marginTop: 16 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partsConsumptionData} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#4B5563', fontSize: 12}} />
                <RechartsTooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="消耗量" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
