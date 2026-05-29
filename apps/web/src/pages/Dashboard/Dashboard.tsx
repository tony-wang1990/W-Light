
import { Activity, Users, Lightbulb, AlertTriangle } from 'lucide-react';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const stats = [
    { title: '运行设备总数', value: '1,248', icon: Lightbulb, color: '#1EAE98', bgColor: 'rgba(30,174,152,0.1)' },
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
        <div className={styles.chartCard}>
          <h3>工单趋势分析</h3>
          <div className={styles.chartPlaceholder}>
            <span className={styles.placeholderText}>图表加载中...</span>
          </div>
        </div>
        <div className={styles.chartCard}>
          <h3>设备故障类型分布</h3>
          <div className={styles.chartPlaceholder}>
            <span className={styles.placeholderText}>图表加载中...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
