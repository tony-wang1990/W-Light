import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, QrCode, MoreHorizontal } from 'lucide-react';
import { apiClient } from '../../api/client';
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
}

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState('');
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await apiClient.get('/devices');
        // Backend returns standard response: { code: 200, data: { items: [], total: 0 } }
        setDevices(res.data.items || res.data || []);
      } catch (err) {
        console.error('Failed to fetch devices:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
  }, []);

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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>设备台账</h1>
          <p className={styles.pageSubtitle}>管理所有场馆设备、生成资产二维码与健康度跟踪。</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.secondaryBtn}>
            <QrCode size={16} /> 批量生成二维码
          </button>
          <button className={styles.primaryBtn}>
            <Plus size={16} /> 录入新设备
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
              ) : devices.map(device => (
                <tr key={device.id}>
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
                          width: `${device.healthScore}%`,
                          backgroundColor: device.healthScore > 80 ? '#1EAE98' : (device.healthScore > 60 ? '#F59E0B' : '#DC3545')
                        }} 
                      />
                    </div>
                    <span className={styles.healthText}>{device.healthScore}分</span>
                  </td>
                  <td className={styles.cellDate}>{device.lastMaintainAt ? new Date(device.lastMaintainAt).toLocaleDateString() : '从未'}</td>
                  <td>
                    <button className={styles.actionBtn}>
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>共 1,248 条记录，当前 1/84 页</span>
          <div className={styles.pageControls}>
            <button className={styles.pageBtn} disabled>上一页</button>
            <button className={styles.pageBtn}>下一页</button>
          </div>
        </div>
      </div>
    </div>
  );
}
