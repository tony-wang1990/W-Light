import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DatabaseBackup, Download, RefreshCw, Upload } from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

interface OperationsSummary {
  range?: { startDate: string; endDate: string };
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

interface RestoreResult {
  warnings: string[];
  tables: Record<string, { received: number; accepted: number; skipped: number }>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function sumRestore(result: RestoreResult, field: 'accepted' | 'skipped') {
  return Object.values(result.tables).reduce((sum, table) => sum + table[field], 0);
}

export default function Reports() {
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState('');
  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    return params.toString();
  }, [endDate, startDate]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.get<OperationsSummary>(`/reports/operations-summary?${queryString}`);
      setSummary(data);
    } catch (err) {
      setError(getErrorMessage(err, '报表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const exportOrders = () => {
    apiClient.download(`/reports/export/orders.xlsx?${queryString}`, `w-light-orders-${startDate}-${endDate}.xlsx`);
  };

  const downloadBackup = () => {
    apiClient.download('/reports/backup.json', `w-light-backup-${today()}.json`);
  };

  const openRestorePicker = () => {
    if (restoring) return;
    if (restoreInputRef.current) restoreInputRef.current.value = '';
    restoreInputRef.current?.click();
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setError('');
    try {
      const payload = JSON.parse(await file.text());
      const preflight = await apiClient.post<RestoreResult>('/reports/backup/restore?dryRun=true', payload);
      const accepted = sumRestore(preflight, 'accepted');
      const skipped = sumRestore(preflight, 'skipped');
      const warningText = preflight.warnings.length ? `\n\n提示：${preflight.warnings.join('；')}` : '';
      const confirmed = window.confirm(
        `将向当前项目恢复 ${accepted} 条数据${skipped ? `，跳过 ${skipped} 条` : ''}。相同 ID 会合并覆盖，不会删除现有数据。${warningText}\n\n确认继续？`,
      );
      if (!confirmed) return;

      const result = await apiClient.post<RestoreResult>('/reports/backup/restore', payload);
      window.alert(`备份恢复完成，共处理 ${sumRestore(result, 'accepted')} 条数据。`);
      loadReport();
    } catch (err) {
      const message = getErrorMessage(err, '备份恢复失败，请确认 JSON 文件格式和当前账号权限');
      setError(message);
      window.alert(message);
    } finally {
      setRestoring(false);
      event.target.value = '';
    }
  };

  const overviewCards = [
    { label: '总工单', value: summary?.overview.totalOrders ?? '-' },
    { label: '故障工单', value: summary?.overview.faultOrders ?? '-' },
    { label: '闭环归档', value: summary?.overview.closedOrders ?? '-' },
    { label: '超时工单', value: summary?.overview.overtimeOrders ?? '-' },
    { label: '工单故障率', value: summary ? `${summary.overview.faultRateByOrders}%` : '-' },
    { label: '平均维修时长', value: summary ? `${summary.overview.avgRepairHours}h` : '-' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>报表与数据</h1>
          <p className={styles.pageSubtitle}>集中查看故障率、维修时长、人员绩效、备件消耗，并执行 Excel 导出和项目备份恢复。</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={loadReport} disabled={loading}>
            <RefreshCw size={16} /> 刷新
          </button>
          <button className={styles.primaryBtn} onClick={exportOrders}>
            <Download size={16} /> 导出 Excel
          </button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.card}>
        <div className={styles.toolbar}>
          <div className={styles.formGroup} style={{ width: 180 }}>
            <label>开始日期</label>
            <input className={styles.input} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
          </div>
          <div className={styles.formGroup} style={{ width: 180 }}>
            <label>结束日期</label>
            <input className={styles.input} type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
          <div className={styles.actions} style={{ alignSelf: 'flex-end' }}>
            <button className={styles.secondaryBtn} onClick={downloadBackup}>
              <DatabaseBackup size={16} /> 下载项目备份
            </button>
            <input ref={restoreInputRef} type="file" accept=".json,application/json" onChange={handleRestoreBackup} style={{ display: 'none' }} />
            <button className={styles.secondaryBtn} onClick={openRestorePicker} disabled={restoring}>
              <Upload size={16} /> {restoring ? '恢复中...' : '恢复备份'}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        {overviewCards.map(card => (
          <div className={styles.card} key={card.label}>
            <span className={styles.muted}>{card.label}</span>
            <strong className={styles.statValue}>{loading ? '-' : card.value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>故障类型排行</h2>
            <span className={styles.muted}>按工单统计</span>
          </div>
          <div className={styles.list}>
            {summary?.faultTypes.length ? summary.faultTypes.map(row => (
              <div className={styles.copyBox} key={row.fault_type}>
                <span>{row.fault_type || '未分类'}</span>
                <strong>{Number(row.count)} 次</strong>
              </div>
            )) : <div className={styles.empty}>暂无故障类型数据</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>重复故障设备</h2>
            <span className={styles.muted}>同周期多次故障</span>
          </div>
          <div className={styles.list}>
            {summary?.repeatFaultDevices.length ? summary.repeatFaultDevices.map(row => (
              <div className={styles.copyBox} key={`${row.device_no}-${row.device_name}`}>
                <span>{row.device_no || '未编号'} · {row.device_name || '未命名设备'}</span>
                <strong>{Number(row.fault_count)} 次</strong>
              </div>
            )) : <div className={styles.empty}>暂无重复故障设备</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>人员绩效</h2>
            <span className={styles.muted}>完工/平均时长</span>
          </div>
          <div className={styles.list}>
            {summary?.engineerPerformance.length ? summary.engineerPerformance.map(row => (
              <div className={styles.copyBox} key={row.engineer_name || Math.random()}>
                <span>{row.engineer_name || '未命名工程师'}</span>
                <strong>{Number(row.closed_orders)}/{Number(row.total_orders)} · {(Number(row.avg_repair_hours) || 0).toFixed(1)}h</strong>
              </div>
            )) : <div className={styles.empty}>暂无人员绩效数据</div>}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>备件消耗</h2>
            <span className={styles.muted}>按出库统计</span>
          </div>
          <div className={styles.list}>
            {summary?.partsConsumption.length ? summary.partsConsumption.map(row => (
              <div className={styles.copyBox} key={row.part_name}>
                <span>{row.part_name}</span>
                <strong>{Number(row.consumed_quantity)} {row.unit || ''}</strong>
              </div>
            )) : <div className={styles.empty}>暂无备件消耗数据</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
