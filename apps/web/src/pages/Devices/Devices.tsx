import React, { useState } from 'react';
import { Search, Filter, Plus, QrCode, MoreHorizontal } from 'lucide-react';
import styles from './Devices.module.css';

// 模拟设备数据
const MOCK_DEVICES = Array.from({ length: 15 }).map((_, i) => ({
  id: `DEV-2026-${(i + 1).toString().padStart(4, '0')}`,
  name: i % 3 === 0 ? 'MA3 全尺寸控台' : i % 2 === 0 ? 'Martin MAC Viper Profile' : 'Claypaky Mythos 2',
  category: i % 3 === 0 ? '控制台' : '摇头灯',
  location: i % 2 === 0 ? '主舞台 A 区' : '观众席 B 区',
  status: i % 5 === 0 ? 'MAINTENANCE' : (i % 8 === 0 ? 'OFFLINE' : 'ONLINE'),
  lastInspect: '2026-05-28',
  health: 100 - (i * 2),
}));

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState('');

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'ONLINE': return styles.statusOnline;
      case 'MAINTENANCE': return styles.statusMaintenance;
      case 'OFFLINE': return styles.statusOffline;
      default: return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ONLINE': return '正常运行';
      case 'MAINTENANCE': return '报修中';
      case 'OFFLINE': return '离线';
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
              {MOCK_DEVICES.map(device => (
                <tr key={device.id}>
                  <td className={styles.cellId}>{device.id}</td>
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
                          width: `${device.health}%`,
                          backgroundColor: device.health > 80 ? '#1EAE98' : (device.health > 60 ? '#F59E0B' : '#DC3545')
                        }} 
                      />
                    </div>
                    <span className={styles.healthText}>{device.health}分</span>
                  </td>
                  <td className={styles.cellDate}>{device.lastInspect}</td>
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
