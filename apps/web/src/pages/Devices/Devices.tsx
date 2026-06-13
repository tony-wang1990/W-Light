import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Edit,
  Filter,
  MoreHorizontal,
  Plus,
  Printer,
  QrCode as QrCodeIcon,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import { useAuthStore } from '../../store/authStore';
import DeviceModal from './components/DeviceModal';
import DeviceDetailModal from './components/DeviceDetailModal';
import styles from './Devices.module.css';

interface Device {
  id: string;
  deviceNo: string;
  name: string;
  category: string;
  location: string;
  status: string;
  healthScore: number;
  lastMaintainAt: string | null;
  model?: string;
  manufacturer?: string;
  qrCode?: string;
  projectId?: string;
}

interface QrLabel {
  device: Device;
  dataUrl: string;
}

type DeviceListResponse = Device[] | { items?: Device[] };

const CATEGORY_OPTIONS = ['', '灯具', '控台', '配电', '网络', '音频', '视频', '其他'];
const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'normal', label: '正常运行' },
  { value: 'maintenance', label: '维修中' },
  { value: 'fault', label: '故障' },
  { value: 'offline', label: '离线' },
];

function normalizeDevices(res: DeviceListResponse) {
  return Array.isArray(res) ? res : res.items || [];
}

function escapeHtml(value: string | undefined) {
  return (value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function statusText(status: string) {
  switch (status?.toLowerCase()) {
    case 'normal': return '正常运行';
    case 'maintenance': return '维修中';
    case 'fault': return '故障';
    case 'offline': return '离线';
    default: return '未知';
  }
}

function cellText(row: Record<string, unknown>, key: string) {
  const value = row[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

export default function Devices() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [qrLabels, setQrLabels] = useState<QrLabel[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('keyword', searchTerm.trim());
      if (category) params.set('category', category);
      if (status) params.set('status', status);
      const res = await apiClient.get<DeviceListResponse>(`/devices${params.toString() ? `?${params.toString()}` : ''}`);
      setDevices(normalizeDevices(res));
    } catch (err) {
      setError(getErrorMessage(err, '设备列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [category, searchTerm, status]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const statusCounts = useMemo(() => {
    return devices.reduce<Record<string, number>>((acc, device) => {
      acc[device.status || 'unknown'] = (acc[device.status || 'unknown'] || 0) + 1;
      return acc;
    }, {});
  }, [devices]);

  const handleAddDevice = () => {
    setEditingDevice(undefined);
    setIsModalOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsModalOpen(true);
    setActiveMenuId(null);
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('确定删除该设备吗？此操作不可恢复。')) return;
    try {
      await apiClient.delete(`/devices/${id}`);
      fetchDevices();
    } catch (err) {
      window.alert(getErrorMessage(err, '删除失败'));
    }
    setActiveMenuId(null);
  };

  const handleRowClick = (device: Device, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    setSelectedDevice(device);
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (rows.length === 0) { window.alert('Excel 文件没有数据，请检查格式'); return; }
      const devices = rows.map(row => ({
        deviceNo: cellText(row, '设备编号') || cellText(row, 'deviceNo'),
        name: cellText(row, '设备名称') || cellText(row, 'name'),
        category: cellText(row, '类型') || cellText(row, 'category') || '其他',
        location: cellText(row, '安装位置') || cellText(row, 'location'),
        manufacturer: cellText(row, '品牌厂商') || cellText(row, 'manufacturer'),
        model: cellText(row, '型号') || cellText(row, 'model'),
      }));
      const result = await apiClient.post<{ imported: number; errors: string[] }>('/devices/batch-import', { devices });
      setImportResult(result);
      fetchDevices();
    } catch (err) {
      window.alert(getErrorMessage(err, '导入失败，请检查 Excel 格式'));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const getStatusStyle = (deviceStatus: string) => {
    switch (deviceStatus?.toLowerCase()) {
      case 'normal': return styles.statusOnline;
      case 'maintenance': return styles.statusMaintenance;
      case 'fault':
      case 'offline': return styles.statusOffline;
      default: return '';
    }
  };

  const handleGenerateQrLabels = async () => {
    if (devices.length === 0) {
      window.alert('暂无可生成二维码的设备');
      return;
    }

    setIsGeneratingQr(true);
    try {
      const labels = await Promise.all(devices.map(async (device) => {
        const qrValue = device.qrCode || device.deviceNo || device.id;
        const dataUrl = await QRCode.toDataURL(qrValue, {
          width: 192,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        return { device: { ...device, qrCode: qrValue }, dataUrl };
      }));
      setQrLabels(labels);
    } catch (err) {
      window.alert(getErrorMessage(err, '二维码生成失败'));
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handlePrintQrLabels = () => {
    const printWindow = window.open('', '_blank', 'width=960,height=720');
    if (!printWindow) {
      window.alert('浏览器阻止了打印窗口，请允许弹窗后重试。');
      return;
    }

    const labelHtml = qrLabels.map(({ device, dataUrl }) => `
      <section class="label">
        <img src="${dataUrl}" alt="${escapeHtml(device.deviceNo)}" />
        <div class="meta">
          <strong>${escapeHtml(device.deviceNo)}</strong>
          <span>${escapeHtml(device.name)}</span>
          <small>${escapeHtml(device.location || device.category)}</small>
        </div>
      </section>
    `).join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>W-Light 设备二维码标签</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 16px; font-family: Arial, "Microsoft YaHei", sans-serif; color: #111827; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
            .label { min-height: 136px; border: 1px solid #111827; border-radius: 8px; padding: 10px; display: flex; gap: 10px; align-items: center; break-inside: avoid; }
            img { width: 96px; height: 96px; flex: 0 0 auto; }
            .meta { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
            strong { font-size: 15px; font-family: Consolas, monospace; word-break: break-all; }
            span { font-size: 14px; font-weight: 600; }
            small { font-size: 12px; color: #4B5563; }
            @media print { body { padding: 0; } .grid { gap: 8px; } .label { border-color: #000; } }
          </style>
        </head>
        <body><main class="grid">${labelHtml}</main></body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const hasFilter = Boolean(searchTerm.trim() || category || status);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>设备台账</h1>
          <p className={styles.pageSubtitle}>管理现场设备、二维码标签、安装位置、健康度和运行状态。</p>
        </div>
        <div className={styles.headerActions}>
          {user?.role === 'admin' && (
            <>
              <input ref={importInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportExcel} />
              <button className={styles.exportBtn} onClick={() => importInputRef.current?.click()} title="支持列：设备编号、设备名称、类型、安装位置、品牌厂商、型号">
                <Upload size={18} /> Excel导入
              </button>
              <button className={styles.exportBtn} onClick={handleGenerateQrLabels} disabled={isGeneratingQr || devices.length === 0}>
                <QrCodeIcon size={18} /> {isGeneratingQr ? '生成中...' : '批量二维码'}
              </button>
              <button className={styles.addBtn} onClick={handleAddDevice}>
                <Plus size={18} /> 新增设备
              </button>
            </>
          )}
        </div>
      </div>

      {importResult && (
        <div style={{ padding: '12px 16px', borderRadius: 8, background: importResult.errors.length ? '#FEF3C7' : '#ECFDF5', border: `1px solid ${importResult.errors.length ? '#F59E0B' : '#10B981'}`, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>✅ 成功导入 <strong>{importResult.imported}</strong> 台设备{importResult.errors.length > 0 ? `，${importResult.errors.length} 条失败` : ''}</span>
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>✕</button>
        </div>
      )}

      {error && <div style={{ padding: 12, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="搜索设备编号 / 名称 / 位置..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <button className={styles.filterBtn} onClick={() => setShowFilter(!showFilter)}>
            <Filter size={16} /> {hasFilter ? '筛选中' : '高级筛选'}
          </button>
        </div>

        {showFilter && (
          <div className={styles.toolbar} style={{ paddingTop: 0 }}>
            <select className={styles.filterBtn as string} value={category} onChange={event => setCategory(event.target.value)}>
              {CATEGORY_OPTIONS.map(option => <option key={option || 'all'} value={option}>{option || '全部分类'}</option>)}
            </select>
            <select className={styles.filterBtn as string} value={status} onChange={event => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map(option => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
            {hasFilter && (
              <button className={styles.filterBtn} onClick={() => { setSearchTerm(''); setCategory(''); setStatus(''); }}>
                <X size={14} /> 清除
              </button>
            )}
            <span style={{ color: '#6B7280', fontSize: 12 }}>
              正常 {statusCounts.normal || 0} · 维修 {statusCounts.maintenance || 0} · 故障 {statusCounts.fault || 0} · 离线 {statusCounts.offline || 0}
            </span>
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>设备编号</th>
                <th>设备名称</th>
                <th>分类</th>
                <th>安装位置</th>
                <th>运行状态</th>
                <th>健康度</th>
                <th>最后巡检</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center' }}>加载中...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>暂无设备数据</td></tr>
              ) : devices.map(device => (
                <tr key={device.id} onClick={(event) => handleRowClick(device, event)} style={{ cursor: 'pointer' }}>
                  <td className={styles.cellId}>{device.deviceNo}</td>
                  <td className={styles.cellName}>{device.name}</td>
                  <td className={styles.cellCategory}>{device.category}</td>
                  <td>{device.location}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusStyle(device.status)}`}>
                      {statusText(device.status)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.healthBar}>
                      <div
                        className={styles.healthProgress}
                        style={{
                          width: `${device.healthScore || 0}%`,
                          backgroundColor: (device.healthScore || 0) > 80 ? '#1EAE98' : ((device.healthScore || 0) > 60 ? '#F59E0B' : '#DC3545'),
                        }}
                      />
                    </div>
                    <span className={styles.healthText}>{device.healthScore || 0}分</span>
                  </td>
                  <td className={styles.cellDate}>{device.lastMaintainAt ? new Date(device.lastMaintainAt).toLocaleDateString('zh-CN') : '从未'}</td>
                  <td style={{ position: 'relative' }}>
                    <button
                      className={styles.actionBtn}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveMenuId(activeMenuId === device.id ? null : device.id);
                      }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeMenuId === device.id && (
                      <div className={styles.dropdownMenu}>
                        <button onClick={(event) => { event.stopPropagation(); handleEditDevice(device); }}>
                          <Edit size={14} /> 编辑
                        </button>
                        <button className={styles.dangerBtn} onClick={(event) => { event.stopPropagation(); handleDeleteDevice(device.id); }}>
                          <Trash2 size={14} /> 删除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.pagination}>
          <span className={styles.pageInfo}>共 {devices.length} 条记录</span>
        </div>
      </div>

      {isModalOpen && (
        <DeviceModal
          isOpen={isModalOpen}
          device={editingDevice}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchDevices();
          }}
        />
      )}

      {selectedDevice && (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}

      {qrLabels.length > 0 && (
        <div className={styles.qrModalOverlay}>
          <div className={styles.qrModal}>
            <div className={styles.qrModalHeader}>
              <div>
                <h2>设备二维码标签</h2>
                <p>共 {qrLabels.length} 台设备，可打印后贴到设备或点位旁。</p>
              </div>
              <button className={styles.closeQrBtn} onClick={() => setQrLabels([])}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.qrModalActions}>
              <button className={styles.addBtn} onClick={handlePrintQrLabels}>
                <Printer size={18} /> 打印标签
              </button>
            </div>
            <div className={styles.qrLabelGrid}>
              {qrLabels.map(({ device, dataUrl }) => (
                <div className={styles.qrLabel} key={device.id}>
                  <img src={dataUrl} alt={device.deviceNo} className={styles.qrImage} />
                  <div className={styles.qrLabelMeta}>
                    <strong>{device.deviceNo}</strong>
                    <span>{device.name}</span>
                    <small>{device.location || device.category}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
