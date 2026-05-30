import React, { useState, useEffect, useCallback } from 'react';
import { Search, Filter, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { apiClient } from '../../api/client';
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

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | undefined>();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/devices');
      setDevices(res.items || res || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

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
    if (!window.confirm('确定要删除该设备吗？此操作不可恢复。')) return;
    try {
      await apiClient.delete(`/devices/${id}`);
      fetchDevices();
    } catch (err) {
      alert('删除失败');
    }
    setActiveMenuId(null);
  };

  const handleRowClick = (device: Device, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    setSelectedDevice(device);
  };

  const getStatusStyle = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'normal': return styles.statusOnline;
      case 'maintenance': return styles.statusMaintenance;
      case 'fault':
      case 'offline': return styles.statusOffline;
      default: return '';
    }
  };

  const getStatusText = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'normal': return '正常运行';
      case 'maintenance': return '报修中';
      case 'fault': return '故障';
      case 'offline': return '离线';
      default: return '未知';
    }
  };

  const filteredDevices = devices.filter(d =>
    (d.name || '').includes(searchTerm) ||
    (d.deviceNo || '').includes(searchTerm) ||
    (d.location || '').includes(searchTerm)
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>设备台账</h1>
          <p className={styles.pageSubtitle}>管理所有场馆设备、生成资产二维码与健康度跟踪。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.exportBtn}>导出台账</button>
          <button className={styles.addBtn} onClick={handleAddDevice}>
            <Plus size={18} />
            新增设备
          </button>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchBox}>
            <Search size={18} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="搜索设备编号 / 名称 / 位置..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className={styles.filterBtn}>
            <Filter size={16} /> 高级筛选
          </button>
        </div>

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
              ) : filteredDevices.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>暂无设备数据</td></tr>
              ) : filteredDevices.map(device => (
                <tr key={device.id} onClick={(e) => handleRowClick(device, e)} style={{ cursor: 'pointer' }}>
                  <td className={styles.cellId}>{device.deviceNo}</td>
                  <td className={styles.cellName}>{device.name}</td>
                  <td className={styles.cellCategory}>{device.category}</td>
                  <td>{device.location}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusStyle(device.status)}`}>
                      {getStatusText(device.status)}
                    </span>
                  </td>
                  <td>
                    <div className={styles.healthBar}>
                      <div 
                        className={styles.healthProgress} 
                        style={{ 
                          width: `${device.healthScore || 0}%`,
                          backgroundColor: (device.healthScore || 0) > 80 ? '#1EAE98' : ((device.healthScore || 0) > 60 ? '#F59E0B' : '#DC3545')
                        }} 
                      />
                    </div>
                    <span className={styles.healthText}>{device.healthScore || 0}分</span>
                  </td>
                  <td className={styles.cellDate}>{device.lastMaintainAt ? new Date(device.lastMaintainAt).toLocaleDateString() : '从未'}</td>
                  <td style={{ position: 'relative' }}>
                    <button 
                      className={styles.actionBtn}
                      onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === device.id ? null : device.id); }}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {activeMenuId === device.id && (
                      <div className={styles.dropdownMenu}>
                        <button onClick={(e) => { e.stopPropagation(); handleEditDevice(device); }}>
                          <Edit size={14} /> 编辑
                        </button>
                        <button className={styles.dangerBtn} onClick={(e) => { e.stopPropagation(); handleDeleteDevice(device.id); }}>
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
          <span className={styles.pageInfo}>共 {filteredDevices.length} 条记录</span>
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
    </div>
  );
}
