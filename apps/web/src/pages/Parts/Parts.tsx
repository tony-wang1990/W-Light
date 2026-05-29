import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import PartModal from './components/PartModal';
import PartLogModal from './components/PartLogModal';
import styles from './Parts.module.css';

interface Part {
  id: string;
  partNo: string;
  name: string;
  category: string;
  specification: string;
  unit: string;
  currentStock: number;
  safeStock: number;
}

export default function Parts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | undefined>();
  
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<'in'|'out'>('in');
  const [selectedPart, setSelectedPart] = useState<Part | undefined>();

  const fetchParts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/parts');
      setParts(res.items || res || []);
    } catch (err) {
      console.error('Failed to fetch parts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const handleAddPart = () => {
    setEditingPart(undefined);
    setIsPartModalOpen(true);
  };

  const handleEditPart = (part: Part) => {
    setEditingPart(part);
    setIsPartModalOpen(true);
  };

  const handleDeletePart = async (id: string) => {
    if (!window.confirm('确定要删除该备件吗？此操作不可恢复。')) return;
    try {
      await apiClient.delete(`/parts/${id}`);
      fetchParts();
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleStockOp = (part: Part, type: 'in' | 'out') => {
    setSelectedPart(part);
    setLogType(type);
    setIsLogModalOpen(true);
  };

  const filteredParts = parts.filter(p => 
    p.name.includes(searchTerm) || p.partNo.includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>备件库存管理</h1>
          <p className={styles.pageSubtitle}>实时追踪消耗品与核心部件的出入库，库存预警自动提示。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn}>导出明细</button>
          <button className={styles.addBtn} onClick={handleAddPart}>
            <Plus size={18} />
            新增备件
          </button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>备件总数 (种)</span>
          <h3 className={styles.statValue}>{parts.length}</h3>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>库存不足警告</span>
          <h3 className={styles.statValue} style={{ color: '#DC2626' }}>
            {parts.filter(p => p.currentStock < p.safeStock).length}
          </h3>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} color="#9CA3AF" />
            <input 
              type="text" 
              placeholder="搜索备件名称或编号..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>备件编号</th>
                <th>备件名称</th>
                <th>分类</th>
                <th>规格</th>
                <th>当前库存</th>
                <th>状态</th>
                <th>快捷操作</th>
                <th>管理</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>加载中...</td></tr>
              ) : filteredParts.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>暂无数据</td></tr>
              ) : filteredParts.map(part => {
                const isWarning = part.currentStock < part.safeStock;
                return (
                  <tr key={part.id}>
                    <td className={styles.cellCode}>{part.partNo}</td>
                    <td className={styles.cellMain}>
                      <strong>{part.name}</strong>
                    </td>
                    <td><span className={styles.tag}>{part.category}</span></td>
                    <td className={styles.cellMuted}>{part.specification || '-'}</td>
                    <td>
                      <strong style={{ fontSize: 16, color: isWarning ? '#DC2626' : '#111827' }}>
                        {part.currentStock}
                      </strong> <span className={styles.cellMuted}>{part.unit}</span>
                    </td>
                    <td>
                      {isWarning ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#DC2626', fontSize: 12, fontWeight: 500 }}>
                          <AlertTriangle size={14} /> 库存预警 (低于 {part.safeStock})
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontSize: 12, fontWeight: 500 }}>充足</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          className={styles.secondaryBtn} 
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => handleStockOp(part, 'in')}
                        >
                          <ArrowDownToLine size={14} color="#059669" /> 入库
                        </button>
                        <button 
                          className={styles.secondaryBtn} 
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => handleStockOp(part, 'out')}
                          disabled={part.currentStock <= 0}
                        >
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
