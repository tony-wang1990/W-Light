import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Edit,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { getErrorMessage } from '../../utils/errors';
import { useAuthStore } from '../../store/authStore';
import PartModal from './components/PartModal';
import PartLogModal from './components/PartLogModal';
import styles from './Parts.module.css';

interface Part {
  id: string;
  name: string;
  model: string;
  unit: string;
  stock: number;
  minStock: number;
  supplier?: string;
  supplierPhone?: string;
}

type PartListResponse = Part[] | { items?: Part[] };

function normalizeParts(res: PartListResponse) {
  return Array.isArray(res) ? res : res.items || [];
}

function downloadCsv(parts: Part[]) {
  const headers = ['备件名称', '型号规格', '当前库存', '安全库存', '单位', '供应商', '供应商电话', '状态'];
  const rows = parts.map(part => [
    part.name,
    part.model || '',
    String(part.stock ?? 0),
    String(part.minStock ?? 0),
    part.unit || '',
    part.supplier || '',
    part.supplierPhone || '',
    Number(part.stock || 0) < Number(part.minStock || 0) ? '库存预警' : '充足',
  ]);
  const csv = `\uFEFF${headers.join(',')}\n${rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `w-light-parts-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Parts() {
  const { user } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | undefined>();
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<'in' | 'out'>('in');
  const [selectedPart, setSelectedPart] = useState<Part | undefined>();

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('keyword', searchTerm.trim());
      const res = await apiClient.get<PartListResponse>(`/parts${params.toString() ? `?${params.toString()}` : ''}`);
      setParts(normalizeParts(res));
    } catch (err) {
      setError(getErrorMessage(err, '备件列表加载失败'));
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const stats = useMemo(() => {
    const lowStock = parts.filter(part => Number(part.stock || 0) < Number(part.minStock || 0)).length;
    const totalStock = parts.reduce((sum, part) => sum + Number(part.stock || 0), 0);
    return { lowStock, totalStock };
  }, [parts]);

  const handleAddPart = () => {
    setEditingPart(undefined);
    setIsPartModalOpen(true);
  };

  const handleEditPart = (part: Part) => {
    setEditingPart(part);
    setIsPartModalOpen(true);
  };

  const handleDeletePart = async (id: string) => {
    if (!window.confirm('确定删除该备件吗？此操作不可恢复。')) return;
    try {
      await apiClient.delete(`/parts/${id}`);
      fetchParts();
    } catch (err) {
      window.alert(getErrorMessage(err, '删除失败'));
    }
  };

  const handleStockOp = (part: Part, type: 'in' | 'out') => {
    setSelectedPart(part);
    setLogType(type);
    setIsLogModalOpen(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>备件库存管理</h1>
          <p className={styles.pageSubtitle}>实时追踪消耗品和核心部件的入库、出库、库存预警与工单消耗。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn} onClick={() => downloadCsv(parts)} disabled={parts.length === 0}>
            <Download size={18} /> 导出明细
          </button>
          {user?.role === 'admin' && (
            <button className={styles.addBtn} onClick={handleAddPart}>
              <Plus size={18} /> 新增备件
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: 12, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>备件种类</span>
          <h3 className={styles.statValue}>{parts.length}</h3>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>库存总量</span>
          <h3 className={styles.statValue}>{stats.totalStock}</h3>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>库存不足预警</span>
          <h3 className={styles.statValue} style={{ color: '#DC2626' }}>{stats.lowStock}</h3>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} color="#9CA3AF" />
            <input
              type="text"
              placeholder="搜索备件名称、型号或供应商..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>备件编号</th>
                <th>备件名称</th>
                <th>型号规格</th>
                <th>供应商</th>
                <th>当前库存</th>
                <th>状态</th>
                <th>快捷操作</th>
                <th>管理</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>加载中...</td></tr>
              ) : parts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无备件数据</td></tr>
              ) : parts.map(part => {
                const isWarning = Number(part.stock || 0) < Number(part.minStock || 0);
                return (
                  <tr key={part.id}>
                    <td className={styles.cellCode}>{part.id.substring(0, 8).toUpperCase()}</td>
                    <td className={styles.cellMain}><strong>{part.name}</strong></td>
                    <td className={styles.cellMuted}>{part.model || '-'}</td>
                    <td className={styles.cellMuted}>{part.supplier || '-'}</td>
                    <td>
                      <strong style={{ fontSize: 16, color: isWarning ? '#DC2626' : '#111827' }}>{part.stock}</strong>
                      <span className={styles.cellMuted}> {part.unit}</span>
                    </td>
                    <td>
                      {isWarning ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#DC2626', fontSize: 12, fontWeight: 600 }}>
                          <AlertTriangle size={14} /> 低于 {part.minStock}
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontSize: 12, fontWeight: 600 }}>充足</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.secondaryBtn} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleStockOp(part, 'in')}>
                          <ArrowDownToLine size={14} color="#059669" /> 入库
                        </button>
                        <button className={styles.secondaryBtn} style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => handleStockOp(part, 'out')} disabled={Number(part.stock || 0) <= 0}>
                          <ArrowUpFromLine size={14} color="#DC2626" /> 出库
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <button className={styles.actionBtn} style={{ background: 'none', color: '#6B7280' }} onClick={() => handleEditPart(part)}>
                          <Edit size={16} />
                        </button>
                        <button className={styles.actionBtn} style={{ background: 'none', color: '#DC2626' }} onClick={() => handleDeletePart(part.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <PartModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSuccess={fetchParts}
        part={editingPart}
      />

      <PartLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onSuccess={fetchParts}
        part={selectedPart}
        type={logType}
      />
    </div>
  );
}
