import React, { useState } from 'react';
import { Download, FileText, Package, Wrench, Users, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { apiClient } from '../../api/client';
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

  const getQueryString = () => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  };

  const handleDownload = (path: string, prefix: string) => {
    const qs = getQueryString();
    apiClient.download(`/reports/export/${path}?${qs}`, `w-light-${prefix}-${startDate}-${endDate}.xlsx`);
  };

  const handleDownloadPdf = () => {
    const [y, m] = month.split('-');
    apiClient.download(`/reports/export/monthly-report.pdf?year=${y}&month=${m}`, `w-light-monthly-report-${month}.pdf`);
  };

  const downloadTypes = [
    {
      title: '月度工单明细表',
      desc: '包含所有工单的详细字段，如报修时间、处理人、故障描述等。',
      icon: <FileSpreadsheet size={24} className={styles.textPrimary} />,
      action: () => handleDownload('orders.xlsx', 'orders'),
    },
    {
      title: '月度统计故障表',
      desc: '按故障类型、设备进行汇总的统计数据，用于分析高频故障。',
      icon: <AlertTriangle size={24} className={styles.textDanger} />,
      action: () => handleDownload('fault-stats.xlsx', 'fault-stats'),
    },
    {
      title: '人员绩效考核表',
      desc: '统计每位工程师的接单量、完工率、平均维修时长等 KPI 指标。',
      icon: <Users size={24} className={styles.textSuccess} />,
      action: () => handleDownload('performance.xlsx', 'performance'),
    },
    {
      title: '备件库存总表',
      desc: '当前所有备件的实时库存数量，不限时间跨度。',
      icon: <Package size={24} className={styles.textWarning} />,
      action: () => {
        apiClient.download(`/reports/export/parts-inventory.xlsx`, `w-light-parts-inventory-${today()}.xlsx`);
      },
    },
    {
      title: '备件消耗明细表',
      desc: '选定时间范围内的所有备件出库/消耗记录明细。',
      icon: <Wrench size={24} className={styles.textPrimary} />,
      action: () => handleDownload('parts-consumption.xlsx', 'parts-consumption'),
    },
    {
      title: '设备台账总表',
      desc: '所有登记设备的台账信息，包括状态、位置、资产编号。',
      icon: <FileText size={24} className={styles.textSecondary} />,
      action: () => {
        apiClient.download(`/reports/export/devices.xlsx`, `w-light-devices-${today()}.xlsx`);
      },
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
            <button className={styles.primaryBtn} onClick={dt.action} style={{ width: '100%', justifyContent: 'center' }}>
              <Download size={16} /> 下载 Excel 表格
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
             <button className={styles.primaryBtn} onClick={handleDownloadPdf}>
               <Download size={16} /> 下载 PDF 报告
             </button>
           </div>
         </div>
      </div>
    </div>
  );
}
