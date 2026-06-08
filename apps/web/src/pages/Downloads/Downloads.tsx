import React, { useState } from 'react';
import { DownloadCloud, FileText, Database, Settings, RefreshCw, BarChart2, Briefcase, FileSpreadsheet } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import styles from './Downloads.module.css';

export default function Downloads() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    new Date(new Date().getFullYear(), new Date().getMonth(), 1), // First day of current month
    new Date(),
  ]);
  const [startDate, endDate] = dateRange;

  const handleDownload = async (url: string, prefix: string) => {
    try {
      let finalUrl = url;
      if (startDate && endDate) {
        const startStr = startDate.toISOString();
        const endStr = endDate.toISOString();
        finalUrl += url.includes('?') ? `&startDate=${startStr}&endDate=${endStr}` : `?startDate=${startStr}&endDate=${endStr}`;
      }
      
      const filename = `${prefix}-${new Date().toISOString().slice(0,10)}${url.endsWith('.pdf') ? '.pdf' : url.endsWith('.json') ? '.json' : '.xlsx'}`;
      await apiClient.download(finalUrl, filename);
    } catch (error) {
      console.error('Download failed:', error);
      alert('下载失败：' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handlePdfDownload = async () => {
    try {
      const targetDate = startDate || new Date();
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;
      const filename = `lightops-report-${year}-${month.toString().padStart(2, '0')}.pdf`;
      await apiClient.download(`/reports/export/monthly-report.pdf?year=${year}&month=${month}`, filename);
    } catch (error) {
      console.error('PDF Download failed:', error);
      alert('下载月度报表 PDF 失败：' + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>数据下载中心</h1>
          <p className={styles.subtitle}>集中管理和导出各类系统数据与分析报表</p>
        </div>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterGroup}>
          <label>报表数据时间范围</label>
          <DatePicker
            selectsRange={true}
            startDate={startDate}
            endDate={endDate}
            onChange={(update: any) => setDateRange(update)}
            className={styles.datePicker}
            dateFormat="yyyy/MM/dd"
            placeholderText="选择时间段（默认本月）"
          />
          <span className={styles.hint}>* 提示：月度综合报告 (PDF) 将基于所选起始日期的月份生成。</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* 资产类报表 */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryHeader}>
            <Database className={styles.categoryIcon} size={20} />
            <h2 className={styles.categoryTitle}>资产与备件报表</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.desc}>导出设备台账、备件库存现状，以及维修过程中产生的备件消耗记录。</p>
            <div className={styles.actionList}>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/devices.xlsx', 'lightops-devices')}>
                <FileSpreadsheet size={16} /> 设备台账明细表
              </button>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/parts-inventory.xlsx', 'lightops-parts-inventory')}>
                <FileSpreadsheet size={16} /> 备品库存台账表
              </button>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/parts-consumption.xlsx', 'lightops-parts-consumption')}>
                <FileSpreadsheet size={16} /> 备件消耗明细表
              </button>
            </div>
          </div>
        </div>

        {/* 运维类报表 */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryHeader}>
            <Settings className={styles.categoryIcon} size={20} />
            <h2 className={styles.categoryTitle}>工单与故障报表</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.desc}>按时间段导出维修工单的完整跟进记录以及系统故障类型统计分析。</p>
            <div className={styles.actionList}>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/orders.xlsx', 'lightops-orders')}>
                <FileSpreadsheet size={16} /> 工单处理汇总表
              </button>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/fault-stats.xlsx', 'lightops-fault-stats')}>
                <FileSpreadsheet size={16} /> 故障统计分析表
              </button>
            </div>
          </div>
        </div>

        {/* 人员类报表 */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryHeader}>
            <Briefcase className={styles.categoryIcon} size={20} />
            <h2 className={styles.categoryTitle}>人员绩效报表</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.desc}>统计工程师在选定时间段内的接单量、完成情况以及平均维修耗时。</p>
            <div className={styles.actionList}>
              <button className={styles.downloadBtn} onClick={() => handleDownload('/reports/export/performance.xlsx', 'lightops-performance')}>
                <FileSpreadsheet size={16} /> 工程师绩效考核表
              </button>
            </div>
          </div>
        </div>

        {/* 综合管理报表 */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryHeader}>
            <BarChart2 className={styles.categoryIcon} size={20} />
            <h2 className={styles.categoryTitle}>综合报告与系统备份</h2>
          </div>
          <div className={styles.cardContent}>
            <p className={styles.desc}>生成精美的月度整体运维 PDF 报告，或导出系统底层的全量 JSON 数据。</p>
            <div className={styles.actionList}>
              <button className={styles.downloadPdfBtn} onClick={handlePdfDownload}>
                <FileText size={16} /> 月度运维综合报告 (PDF)
              </button>
              {isAdmin && (
                <button className={styles.downloadJsonBtn} onClick={() => handleDownload('/reports/backup.json', 'lightops-backup')}>
                  <RefreshCw size={16} /> 系统全量数据备份 (JSON)
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
