import { useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  Download,
  DollarSign,
  FileSpreadsheet,
  FileText,
  MapPin,
  Package,
  ShieldAlert,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from './Downloads.module.css';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type Accent = 'green' | 'blue' | 'amber' | 'red' | 'slate';

interface DownloadDefinition {
  key: string;
  title: string;
  desc: string;
  path: string;
  filenamePrefix: string;
  icon: ReactNode;
  accent: Accent;
  usesDateRange: boolean;
}

export const DOWNLOAD_EXPORTS: DownloadDefinition[] = [
  {
    key: 'monthly-operations',
    title: '月度运营总览工作簿',
    desc: '核心指标、故障排行、设备可靠性、人员绩效、成本走势、风险与管理建议集中在一个工作簿。',
    path: 'monthly-operations.xlsx',
    filenamePrefix: 'monthly-operations',
    icon: <TrendingUp size={22} />,
    accent: 'green',
    usesDateRange: true,
  },
  {
    key: 'orders',
    title: '工单明细表',
    desc: '导出报修时间、故障描述、处理人、状态、时效与维修结果等完整工单字段。',
    path: 'orders.xlsx',
    filenamePrefix: 'orders',
    icon: <FileSpreadsheet size={22} />,
    accent: 'blue',
    usesDateRange: true,
  },
  {
    key: 'fault-stats',
    title: '故障统计表',
    desc: '按故障类型汇总次数、维修成本和平均维修时长，用于识别高频故障。',
    path: 'fault-stats.xlsx',
    filenamePrefix: 'fault-stats',
    icon: <AlertTriangle size={22} />,
    accent: 'red',
    usesDateRange: true,
  },
  {
    key: 'performance',
    title: '人员绩效考核表',
    desc: '统计工程师接单量、闭环率、超时数、平均维修时长和维修成本。',
    path: 'performance.xlsx',
    filenamePrefix: 'performance',
    icon: <Users size={22} />,
    accent: 'green',
    usesDateRange: true,
  },
  {
    key: 'parts-inventory',
    title: '备件库存总表',
    desc: '导出当前备件库存、最低库存、规格型号和资金占用，不受日期范围影响。',
    path: 'parts-inventory.xlsx',
    filenamePrefix: 'parts-inventory',
    icon: <Package size={22} />,
    accent: 'amber',
    usesDateRange: false,
  },
  {
    key: 'parts-consumption',
    title: '备件消耗明细表',
    desc: '导出选定时间范围内的备件出库、数量、关联工单和操作记录。',
    path: 'parts-consumption.xlsx',
    filenamePrefix: 'parts-consumption',
    icon: <Wrench size={22} />,
    accent: 'blue',
    usesDateRange: true,
  },
  {
    key: 'devices',
    title: '设备台账总表',
    desc: '导出全部设备编号、名称、分类、品牌型号、安装位置和当前状态。',
    path: 'devices.xlsx',
    filenamePrefix: 'devices',
    icon: <FileText size={22} />,
    accent: 'slate',
    usesDateRange: false,
  },
  {
    key: 'financial-consumption',
    title: '备件资金消耗汇总',
    desc: '按备件汇总消耗数量、单价和总成本，为采购与预算复盘提供依据。',
    path: 'financial-consumption.xlsx',
    filenamePrefix: 'financial-consumption',
    icon: <DollarSign size={22} />,
    accent: 'amber',
    usesDateRange: true,
  },
  {
    key: 'device-reliability',
    title: '设备质量评估汇总',
    desc: '分析不同品牌与型号的设备数量、故障次数和故障率，辅助采购决策。',
    path: 'device-reliability.xlsx',
    filenamePrefix: 'device-reliability',
    icon: <Activity size={22} />,
    accent: 'green',
    usesDateRange: true,
  },
  {
    key: 'location-heatmap',
    title: '区域故障热力汇总',
    desc: '统计各物理区域的工单、超时和维修成本，快速定位环境与布线隐患。',
    path: 'location-heatmap.xlsx',
    filenamePrefix: 'location-heatmap',
    icon: <MapPin size={22} />,
    accent: 'blue',
    usesDateRange: true,
  },
  {
    key: 'daily-kpi',
    title: '每日运营走势表',
    desc: '按日汇总新增、闭环、超时工单与维修成本，便于查看周期趋势。',
    path: 'daily-kpi.xlsx',
    filenamePrefix: 'daily-kpi',
    icon: <TrendingUp size={22} />,
    accent: 'green',
    usesDateRange: true,
  },
  {
    key: 'inspection-anomaly',
    title: '巡检异常统计表',
    desc: '汇总巡检异常、漏检项、巡检人员和关联工单，追踪隐患闭环。',
    path: 'inspection-anomaly.xlsx',
    filenamePrefix: 'inspection-anomaly',
    icon: <ShieldAlert size={22} />,
    accent: 'red',
    usesDateRange: true,
  },
];

export default function Downloads() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const runDownload = async (key: string, task: () => Promise<void>) => {
    if (activeDownload) return;
    setActiveDownload(key);
    setDownloadError('');
    try {
      await task();
    } catch (err: unknown) {
      setDownloadError(getErrorMessage(err, '下载失败，请稍后重试'));
    } finally {
      setActiveDownload(null);
    }
  };

  const downloadExcel = (item: DownloadDefinition) => runDownload(item.key, async () => {
    const params = new URLSearchParams();
    if (item.usesDateRange) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    const query = params.toString();
    const url = `/reports/export/${item.path}${query ? `?${query}` : ''}`;
    const suffix = item.usesDateRange ? `${startDate}-${endDate}` : today();
    await apiClient.download(url, `w-light-${item.filenamePrefix}-${suffix}.xlsx`);
  });

  const downloadMonthlyReport = (format: 'pdf' | 'docx') => runDownload(`monthly-${format}`, async () => {
    const [year, targetMonth] = month.split('-');
    await apiClient.download(
      `/reports/export/monthly-report.${format}?year=${year}&month=${targetMonth}`,
      `w-light-monthly-report-${month}.${format}`,
    );
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>数据下载中心</h1>
        <p className={styles.subtitle}>一站式统一导出各种报表模板，月底汇总和日常台账都在这里完成。</p>
      </header>

      {downloadError && <div className={styles.error}>{downloadError}</div>}

      <section className={styles.filterCard}>
        <h2>全局时间范围设定</h2>
        <div className={styles.filterFields}>
          <label>
            <span>开始日期</span>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </label>
          <p>注：时间范围仅对工单、消耗、绩效等时间敏感的报表生效。</p>
        </div>
      </section>

      <div className={styles.grid}>
        {DOWNLOAD_EXPORTS.map(item => (
          <article className={styles.reportCard} key={item.key}>
            <div className={styles.cardTitle}>
              <span className={styles.cardIcon}>{item.icon}</span>
              <h2>{item.title}</h2>
            </div>
            <p>{item.desc}</p>
            <button
              className={styles.downloadButton}
              onClick={() => downloadExcel(item)}
              disabled={Boolean(activeDownload)}
            >
              <Download size={15} />
              {activeDownload === item.key ? '正在生成...' : '下载 Excel 表格'}
            </button>
          </article>
        ))}
      </div>

      <section className={styles.monthlyCard}>
        <div className={styles.monthlyIntro}>
          <h2><FileText size={20} /> 月度综合总结报告</h2>
          <p>
            自动整理项目概况、管理摘要、核心指标、风险清单、故障排行、人员绩效、
            备件消耗、每日走势和整改建议。PDF 适合直接汇报，Word/DOCX 适合二次编辑。
          </p>
        </div>
        <div className={styles.monthlyActions}>
          <label>
            <span>报告月份</span>
            <input type="month" value={month} onChange={event => setMonth(event.target.value)} />
          </label>
          <button
            className={styles.primaryReportButton}
            onClick={() => downloadMonthlyReport('pdf')}
            disabled={Boolean(activeDownload)}
          >
            <Download size={15} />
            {activeDownload === 'monthly-pdf' ? '正在生成...' : '下载 PDF 报告'}
          </button>
          <button
            className={styles.secondaryReportButton}
            onClick={() => downloadMonthlyReport('docx')}
            disabled={Boolean(activeDownload)}
          >
            <Download size={15} />
            {activeDownload === 'monthly-docx' ? '正在生成...' : '下载 Word/DOCX'}
          </button>
        </div>
      </section>
    </div>
  );
}
