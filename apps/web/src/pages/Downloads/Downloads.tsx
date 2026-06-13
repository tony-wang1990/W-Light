import React, { useState } from 'react';
import { Download, FileText, Package, Wrench, Users, AlertTriangle, FileSpreadsheet, DollarSign, Activity, MapPin, TrendingUp, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function Downloads() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  const getQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  };

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

  const handleDownload = (path: string, prefix: string, key: string) => runDownload(key, async () => {
    const qs = getQueryString();
    await apiClient.download(`/reports/export/${path}?${qs}`, `w-light-${prefix}-${startDate}-${endDate}.xlsx`);
  });

  const handleDownloadPdf = () => runDownload('monthly-pdf', async () => {
    const [y, m] = month.split('-');
    await apiClient.download(`/reports/export/monthly-report.pdf?year=${y}&month=${m}`, `w-light-monthly-report-${month}.pdf`);
  });

  const downloadTypes = [
    {
      key: 'monthly-operations',
      title: '月度运营总览工作簿',
      desc: '一份 Excel 内含核心指标、故障类型、设备故障率、人员绩效、维修成本、每日走势和运营建议，适合月度复盘。',
      icon: <TrendingUp size={24} className={styles.textSuccess} />,
      action: () => handleDownload('monthly-operations.xlsx', 'monthly-operations', 'monthly-operations'),
    },
    {
      key: 'orders',
      title: '月度工单明细表',
      desc: '包含所有工单的详细字段，如报修时间、处理人、故障描述等。',
      icon: <FileSpreadsheet size={24} className={styles.textPrimary} />,
      action: () => handleDownload('orders.xlsx', 'orders', 'orders'),
    },
    {
      key: 'fault-stats',
      title: '月度统计故障表',
      desc: '按故障类型、设备进行汇总的统计数据，用于分析高频故障。',
      icon: <AlertTriangle size={24} className={styles.textDanger} />,
      action: () => handleDownload('fault-stats.xlsx', 'fault-stats', 'fault-stats'),
    },
    {
      key: 'performance',
      title: '人员绩效考核表',
      desc: '统计每位工程师的接单量、完工率、平均维修时长等 KPI 指标。',
      icon: <Users size={24} className={styles.textSuccess} />,
      action: () => handleDownload('performance.xlsx', 'performance', 'performance'),
    },
    {
      key: 'parts-inventory',
      title: '备件库存总表',
      desc: '当前所有备件的实时库存数量，不限时间跨度。',
      icon: <Package size={24} className={styles.textWarning} />,
      action: () => runDownload('parts-inventory', () => apiClient.download(`/reports/export/parts-inventory.xlsx`, `w-light-parts-inventory-${today()}.xlsx`)),
    },
    {
      key: 'parts-consumption',
      title: '备件消耗明细表',
      desc: '选定时间范围内的所有备件出库/消耗记录明细。',
      icon: <Wrench size={24} className={styles.textPrimary} />,
      action: () => handleDownload('parts-consumption.xlsx', 'parts-consumption', 'parts-consumption'),
    },
    {
      key: 'devices',
      title: '设备台账总表',
      desc: '所有登记设备的台账信息，包括状态、位置、资产编号。',
      icon: <FileText size={24} className={styles.textSecondary} />,
      action: () => runDownload('devices', () => apiClient.download(`/reports/export/devices.xlsx`, `w-light-devices-${today()}.xlsx`)),
    },
    {
      key: 'financial-consumption',
      title: '备件资金消耗汇总表',
      desc: '按备件分类汇总的资金消耗大表，包含每种备件的花费总额。',
      icon: <DollarSign size={24} className={styles.textWarning} />,
      action: () => handleDownload('financial-consumption.xlsx', 'financial-consumption', 'financial-consumption'),
    },
    {
      key: 'device-reliability',
      title: '设备质量评估汇总表',
      desc: '分析不同品牌/型号设备的故障率，作为下次采购的参考依据。',
      icon: <Activity size={24} className={styles.textSuccess} />,
      action: () => handleDownload('device-reliability.xlsx', 'device-reliability', 'device-reliability'),
    },
    {
      key: 'location-heatmap',
      title: '区域故障热力汇总表',
      desc: '统计不同物理区域的故障高发频次，精准暴露环境隐患。',
      icon: <MapPin size={24} className={styles.textPrimary} />,
      action: () => handleDownload('location-heatmap.xlsx', 'location-heatmap', 'location-heatmap'),
    },
    {
      key: 'daily-kpi',
      title: '每日运营走势大表',
      desc: '每日新增工单、结案、超时情况宏观走势聚合。',
      icon: <TrendingUp size={24} className={styles.textSuccess} />,
      action: () => handleDownload('daily-kpi.xlsx', 'daily-kpi', 'daily-kpi'),
    },
    {
      key: 'inspection-anomaly',
      title: '巡检异常统计汇总表',
      desc: '专门统计巡检中发现的异常与漏检项，防患于未然。',
      icon: <ShieldAlert size={24} className={styles.textDanger} />,
      action: () => handleDownload('inspection-anomaly.xlsx', 'inspection-anomaly', 'inspection-anomaly'),
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>数据下载中心</h1>
          <p className={styles.pageSubtitle}>一站式统一导出各种报表模板，月底汇总提效神器。</p>
        </div>
      </div>

      {downloadError && <div className={styles.error}>{downloadError}</div>}

      <div className={styles.card} style={{ marginBottom: 24 }}>
        <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>全局时间范围设定</h2>
        <div className={styles.toolbar}>
          <div className={styles.formGroup} style={{ width: 200 }}>
            <label>开始日期</label>
            <input className={styles.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className={styles.formGroup} style={{ width: 200 }}>
            <label>结束日期</label>
            <input className={styles.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <p className={styles.muted} style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>
            注：时间范围仅对工单、消耗、绩效等时间敏感的报表生效。
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {downloadTypes.map((dt, idx) => (
          <div className={styles.card} key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {dt.icon}
              <h2 className={styles.cardTitle} style={{ margin: 0 }}>{dt.title}</h2>
            </div>
            <p className={styles.muted} style={{ flex: 1 }}>{dt.desc}</p>
            <button
              className={styles.primaryBtn}
              onClick={dt.action}
              disabled={Boolean(activeDownload)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Download size={16} /> {activeDownload === dt.key ? '下载中...' : '下载 Excel 表格'}
            </button>
          </div>
        ))}
      </div>

      {/* PDF Report Section */}
      <div className={styles.card} style={{ marginTop: 24 }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <FileText size={24} className={styles.textPrimary} />
            <h2 className={styles.cardTitle} style={{ margin: 0 }}>月度综合总结报告 (PDF)</h2>
         </div>
         <p className={styles.muted} style={{ marginBottom: 16 }}>
           自动生成包含本月运维概况、高频故障分析、人员工作量总结的排版精美的 PDF 月报，可直接用于汇报。
         </p>
         <div className={styles.toolbar}>
           <div className={styles.formGroup} style={{ width: 200 }}>
             <label>选择月份</label>
             <input className={styles.input} type="month" value={month} onChange={e => setMonth(e.target.value)} />
           </div>
           <div className={styles.actions} style={{ alignSelf: 'flex-end' }}>
             <button className={styles.primaryBtn} onClick={handleDownloadPdf} disabled={Boolean(activeDownload)}>
               <Download size={16} /> {activeDownload === 'monthly-pdf' ? '下载中...' : '下载 PDF 报告'}
             </button>
           </div>
         </div>
      </div>
    </div>
  );
}
