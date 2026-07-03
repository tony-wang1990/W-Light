import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { DatabaseBackup, Download, RefreshCw, Upload } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from '../CommonAdmin.module.css';

interface OperationsSummary {
  range?: { startDate: string; endDate: string };
  overview: {
    totalOrders: number;
    faultOrders: number;
    closedOrders: number;
    activeOrders: number;
    overtimeOrders: number;
    totalRepairCost: number;
    deviceCount: number;
    closureRate: number;
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

function money(value?: number) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

export default function Reports() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
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

  const exportMonthlyOperations = () => {
    apiClient.download(`/reports/export/monthly-operations.xlsx?${queryString}`, `w-light-monthly-operations-${startDate}-${endDate}.xlsx`);
  };

  const downloadBackup = () => {
    apiClient.download('/reports/backup.json', `w-light-backup-${today()}.json`);
  };

  const openRestorePicker = () => {
    if (restoring) return;
    if (restoreInputRef.current) restoreInputRef.current.value = '';
    restoreInputRef.current?.click();
  };

  const handleRestoreBackup = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const overview = summary?.overview;
  const overviewCards = [
    { label: '工单总数', value: overview?.totalOrders ?? '-' },
    { label: '未闭环工单', value: overview?.activeOrders ?? '-' },
    { label: '闭环归档', value: overview?.closedOrders ?? '-' },
    { label: '闭环率', value: overview ? `${overview.closureRate}%` : '-' },
    { label: '超时工单', value: overview?.overtimeOrders ?? '-' },
    { label: '维修成本', value: overview ? money(overview.totalRepairCost) : '-' },
    { label: '设备故障率', value: overview ? `${overview.faultRateByDevices}%` : '-' },
    { label: '平均维修时长', value: overview ? `${overview.avgRepairHours}h` : '-' },
    { label: '平均响应时长', value: overview ? `${overview.avgResponseHours}h` : '-' },
  ];

  const suggestions = useMemo(() => {
    if (!summary) return ['正在读取运营数据。'];
    const items: string[] = [];
    if (summary.overview.closureRate < 90) items.push('闭环率低于 90%，建议优先检查派单、验收和逾期工单处理。');
    if (summary.overview.overtimeOrders > 0) items.push(`存在 ${summary.overview.overtimeOrders} 个超时工单，建议按人员和区域复盘响应时长。`);
    if (summary.overview.avgRepairHours > 24) items.push('平均维修时长超过 24 小时，建议建立高频备件包和疑难故障升级机制。');
    const topDevice = summary.repeatFaultDevices[0];
    if (topDevice) items.push(`${topDevice.device_no || topDevice.device_name} 出现重复故障，建议纳入重点巡检或替换评估。`);
    const topFault = summary.faultTypes[0];
    if (topFault && Number(topFault.count) > 0) items.push(`高频故障类型为 ${topFault.fault_type || '未分类'}，建议补充标准排查 SOP。`);
    if (items.length === 0) items.push('本周期关键指标稳定，可以继续沉淀维修记录和巡检数据。');
    return items;
  }, [summary]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>报表与数据</h1>
          <p className={styles.pageSubtitle}>集中查看故障率、维修时长、人员绩效、维修成本、备件消耗，并执行 Excel 导出和项目备份恢复。</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondaryBtn} onClick={loadReport} disabled={loading}>
            <RefreshCw size={16} /> 刷新
          </button>
          <button className={styles.primaryBtn} onClick={exportMonthlyOperations}>
            <Download size={16} /> 月度运营总表
          </button>
          <button className={styles.secondaryBtn} onClick={exportOrders}>
            <Download size={16} /> 工单明细
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
          {isAdmin && (
            <div className={styles.actions} style={{ alignSelf: 'flex-end' }}>
              <button className={styles.secondaryBtn} onClick={downloadBackup}>
                <DatabaseBackup size={16} /> 下载项目备份
              </button>
              <input ref={restoreInputRef} type="file" accept=".json,application/json" onChange={handleRestoreBackup} style={{ display: 'none' }} />
              <button className={styles.secondaryBtn} onClick={openRestorePicker} disabled={restoring}>
                <Upload size={16} /> {restoring ? '恢复中...' : '恢复备份'}
              </button>
            </div>
          )}
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

      <div className={styles.wideGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>运营建议</h2>
            <span className={styles.badge}>自动分析</span>
          </div>
          <div className={styles.list}>
            {suggestions.map((item, index) => (
              <div className={styles.copyBox} key={item}>
                <span>{index + 1}. {item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>当前统计范围</h2>
            <span className={styles.muted}>按工单创建时间</span>
          </div>
          <div className={styles.copyBox}>
            <span>{summary?.range?.startDate || startDate} 至 {summary?.range?.endDate || endDate}</span>
          </div>
        </div>
      </div>

      <div className={styles.grid}>
        <ReportList
          title="故障类型排行"
          subtitle="按工单统计"
          empty="暂无故障类型数据"
          rows={summary?.faultTypes || []}
          renderKey={row => row.fault_type || 'unclassified'}
          renderText={row => row.fault_type || '未分类'}
          renderValue={row => `${Number(row.count)} 次`}
        />

        <ReportList
          title="重复故障设备"
          subtitle="同周期多次故障"
          empty="暂无重复故障设备"
          rows={summary?.repeatFaultDevices || []}
          renderKey={(row, index) => `${row.device_no}-${row.device_name}-${index}`}
          renderText={row => `${row.device_no || '未编号'} · ${row.device_name || '未命名设备'}`}
          renderValue={row => `${Number(row.fault_count)} 次`}
        />

        <ReportList
          title="人员绩效"
          subtitle="完工/平均时长"
          empty="暂无人员绩效数据"
          rows={summary?.engineerPerformance || []}
          renderKey={(row, index) => `${row.engineer_name}-${index}`}
          renderText={row => row.engineer_name || '未命名工程师'}
          renderValue={row => `${Number(row.closed_orders)}/${Number(row.total_orders)} · ${(Number(row.avg_repair_hours) || 0).toFixed(1)}h`}
        />

        <ReportList
          title="备件消耗"
          subtitle="按出库统计"
          empty="暂无备件消耗数据"
          rows={summary?.partsConsumption || []}
          renderKey={(row, index) => `${row.part_name}-${index}`}
          renderText={row => row.part_name}
          renderValue={row => `${Number(row.consumed_quantity)} ${row.unit || ''}`}
        />
      </div>
    </div>
  );
}

function ReportList<T>({
  title,
  subtitle,
  empty,
  rows,
  renderKey,
  renderText,
  renderValue,
}: {
  title: string;
  subtitle: string;
  empty: string;
  rows: T[];
  renderKey: (row: T, index: number) => string;
  renderText: (row: T) => string;
  renderValue: (row: T) => string;
}) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className={styles.muted}>{subtitle}</span>
      </div>
      <div className={styles.list}>
        {rows.length ? rows.map((row, index) => (
          <div className={styles.copyBox} key={renderKey(row, index)}>
            <span>{renderText(row)}</span>
            <strong>{renderValue(row)}</strong>
          </div>
        )) : <div className={styles.empty}>{empty}</div>}
      </div>
    </div>
  );
}
