import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Activity, AlertTriangle, Building, CheckCircle, Clock, Cpu, MapPin, QrCode, Tag, X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import styles from './DeviceDetailModal.module.css';

interface DeviceDetail {
  id: string;
  deviceNo?: string;
  name?: string;
  category?: string;
  location?: string;
  status?: string;
  healthScore?: number | string;
  lastMaintainAt?: string | Date | null;
  model?: string;
  manufacturer?: string;
  qrCode?: string;
  createdAt?: string | Date | null;
}

interface WorkOrderBrief {
  id: string;
  orderNo: string;
  status: string;
  priority: string;
  faultDesc: string;
  createdAt: string;
  closedAt?: string;
  assignee?: { name?: string };
}

interface DeviceDetailModalProps {
  device: DeviceDetail;
  onClose: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: '正常运行', color: '#10B981' },
  maintenance: { label: '维修中', color: '#F59E0B' },
  fault: { label: '故障', color: '#EF4444' },
  offline: { label: '离线', color: '#6B7280' },
};

const ORDER_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待派单', color: '#F59E0B' },
  assigned: { label: '已派单', color: '#3B82F6' },
  processing: { label: '处理中', color: '#8B5CF6' },
  suspended: { label: '已挂起', color: '#6B7280' },
  reviewing: { label: '待验收', color: '#0EA5E9' },
  closed: { label: '已完成', color: '#10B981' },
  rejected: { label: '已取消', color: '#EF4444' },
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: '#EF4444', P1: '#F97316', P2: '#F59E0B', P3: '#6B7280',
};

type Tab = 'info' | 'history';

export default function DeviceDetailModal({ device, onClose }: DeviceDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const status = device.status?.toLowerCase() || 'unknown';
  const statusInfo = STATUS_MAP[status] || { label: '未知', color: '#9CA3AF' };
  const healthScore = Number(device.healthScore || 0);
  const healthColor = healthScore > 80 ? '#10B981' : healthScore > 60 ? '#F59E0B' : '#EF4444';
  const qrValue = device.qrCode || device.deviceNo || device.id;
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [orders, setOrders] = useState<WorkOrderBrief[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!qrValue) { setQrDataUrl(''); return; }
    QRCode.toDataURL(qrValue, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (mounted) setQrDataUrl(url); })
      .catch(() => { if (mounted) setQrDataUrl(''); });
    return () => { mounted = false; };
  }, [qrValue]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    setOrdersLoading(true);
    apiClient.get<{ items?: WorkOrderBrief[] } | WorkOrderBrief[]>(`/orders?deviceId=${device.id}&pageSize=50`)
      .then((res) => {
        const items = Array.isArray(res) ? res : res.items || [];
        setOrders(items);
      })
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [activeTab, device.id]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.deviceIcon}><Cpu size={24} color="#00A67E" /></div>
            <div>
              <h2 className={styles.deviceName}>{device.name}</h2>
              <span className={styles.deviceNo}>{device.deviceNo}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>

        {/* Tab 切换 */}
        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${activeTab === 'info' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('info')}
          >设备信息</button>
          <button
            className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('history')}
          >维修历史</button>
        </div>

        <div className={styles.body}>
          {activeTab === 'info' && (
            <>
              <div className={styles.statusRow}>
                <div className={styles.statusBadge} style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}>
                  <Activity size={13} />{statusInfo.label}
                </div>
                <div className={styles.healthInfo}>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>健康度</span>
                  <div className={styles.healthBar}>
                    <div className={styles.healthFill} style={{ width: `${healthScore}%`, backgroundColor: healthColor }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: healthColor }}>{healthScore}分</span>
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}><Tag size={15} color="#6B7280" /><div><div className={styles.infoLabel}>分类</div><div className={styles.infoValue}>{device.category || '-'}</div></div></div>
                <div className={styles.infoItem}><MapPin size={15} color="#6B7280" /><div><div className={styles.infoLabel}>安装位置</div><div className={styles.infoValue}>{device.location || '-'}</div></div></div>
                <div className={styles.infoItem}><Building size={15} color="#6B7280" /><div><div className={styles.infoLabel}>品牌/厂商</div><div className={styles.infoValue}>{device.manufacturer || '-'}</div></div></div>
                <div className={styles.infoItem}><Cpu size={15} color="#6B7280" /><div><div className={styles.infoLabel}>型号</div><div className={styles.infoValue}>{device.model || '-'}</div></div></div>
                <div className={styles.infoItem}><Activity size={15} color="#6B7280" /><div><div className={styles.infoLabel}>最后巡检</div><div className={styles.infoValue}>{device.lastMaintainAt ? new Date(device.lastMaintainAt).toLocaleDateString('zh-CN') : '从未'}</div></div></div>
                <div className={styles.infoItem}><Activity size={15} color="#6B7280" /><div><div className={styles.infoLabel}>创建时间</div><div className={styles.infoValue}>{device.createdAt ? new Date(device.createdAt).toLocaleDateString('zh-CN') : '-'}</div></div></div>
              </div>

              <div className={styles.qrSection}>
                <div className={styles.qrHeader}><QrCode size={16} color="#374151" /><span>设备二维码</span></div>
                {qrValue ? (
                  <div className={styles.qrContent}>
                    <div className={styles.qrCodeDisplay}>
                      {qrDataUrl ? <img src={qrDataUrl} alt={qrValue} className={styles.qrImage} /> : <QrCode size={96} color="#D1D5DB" />}
                    </div>
                    <div className={styles.qrCodeText}>
                      <div className={styles.qrCodeLabel}>二维码数据</div>
                      <div className={styles.qrCodeValue}>{qrValue}</div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.qrEmpty}>
                    <QrCode size={36} color="#D1D5DB" />
                    <p>暂无二维码信息</p>
                    <span>设备 ID：{device.id?.substring(0, 16)}...</span>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className={styles.timeline}>
              {ordersLoading ? (
                <div className={styles.timelineEmpty}>加载中...</div>
              ) : orders.length === 0 ? (
                <div className={styles.timelineEmpty}>
                  <CheckCircle size={32} color="#10B981" />
                  <p>该设备暂无维修记录</p>
                </div>
              ) : (
                orders.map((order, idx) => {
                  const os = ORDER_STATUS_MAP[order.status] || { label: order.status, color: '#6B7280' };
                  const isClosed = order.status === 'closed';
                  return (
                    <div key={order.id} className={styles.timelineItem}>
                      <div className={styles.timelineDot} style={{ backgroundColor: isClosed ? '#10B981' : '#F59E0B' }}>
                        {isClosed ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      </div>
                      {idx < orders.length - 1 && <div className={styles.timelineLine} />}
                      <div className={styles.timelineCard}>
                        <div className={styles.timelineCardTop}>
                          <span className={styles.timelineOrderNo}>{order.orderNo}</span>
                          <span className={styles.timelinePriority} style={{ color: PRIORITY_COLORS[order.priority] || '#6B7280' }}>{order.priority}</span>
                          <span className={styles.timelineStatus} style={{ color: os.color, backgroundColor: os.color + '15' }}>{os.label}</span>
                        </div>
                        <p className={styles.timelineFault}>{order.faultDesc || '无故障描述'}</p>
                        <div className={styles.timelineMeta}>
                          <Clock size={12} />
                          <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                          {order.assignee?.name && <><span>·</span><span>负责：{order.assignee.name}</span></>}
                          {order.closedAt && <><span>·</span><span>完成：{new Date(order.closedAt).toLocaleDateString('zh-CN')}</span></>}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
