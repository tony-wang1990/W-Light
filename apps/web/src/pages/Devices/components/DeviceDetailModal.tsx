import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Activity, Building, Cpu, MapPin, QrCode, Tag, X } from 'lucide-react';
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

export default function DeviceDetailModal({ device, onClose }: DeviceDetailModalProps) {
  const status = device.status?.toLowerCase() || 'unknown';
  const statusInfo = STATUS_MAP[status] || { label: '未知', color: '#9CA3AF' };
  const healthScore = Number(device.healthScore || 0);
  const healthColor = healthScore > 80 ? '#10B981' : healthScore > 60 ? '#F59E0B' : '#EF4444';
  const qrValue = device.qrCode || device.deviceNo || device.id;
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let mounted = true;
    if (!qrValue) {
      setQrDataUrl('');
      return;
    }

    QRCode.toDataURL(qrValue, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (mounted) setQrDataUrl(url);
      })
      .catch(() => {
        if (mounted) setQrDataUrl('');
      });

    return () => {
      mounted = false;
    };
  }, [qrValue]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.deviceIcon}>
              <Cpu size={24} color="#00A67E" />
            </div>
            <div>
              <h2 className={styles.deviceName}>{device.name}</h2>
              <span className={styles.deviceNo}>{device.deviceNo}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.statusRow}>
            <div className={styles.statusBadge} style={{ backgroundColor: statusInfo.color + '20', color: statusInfo.color }}>
              <Activity size={13} />
              {statusInfo.label}
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
            <div className={styles.infoItem}>
              <Tag size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>分类</div>
                <div className={styles.infoValue}>{device.category || '-'}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <MapPin size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>安装位置</div>
                <div className={styles.infoValue}>{device.location || '-'}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Building size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>品牌/厂商</div>
                <div className={styles.infoValue}>{device.manufacturer || '-'}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Cpu size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>型号</div>
                <div className={styles.infoValue}>{device.model || '-'}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Activity size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>最后巡检</div>
                <div className={styles.infoValue}>
                  {device.lastMaintainAt ? new Date(device.lastMaintainAt).toLocaleDateString('zh-CN') : '从未'}
                </div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Activity size={15} color="#6B7280" />
              <div>
                <div className={styles.infoLabel}>创建时间</div>
                <div className={styles.infoValue}>
                  {device.createdAt ? new Date(device.createdAt).toLocaleDateString('zh-CN') : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.qrSection}>
            <div className={styles.qrHeader}>
              <QrCode size={16} color="#374151" />
              <span>设备二维码</span>
            </div>
            {qrValue ? (
              <div className={styles.qrContent}>
                <div className={styles.qrCodeDisplay}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt={qrValue} className={styles.qrImage} />
                  ) : (
                    <QrCode size={96} color="#D1D5DB" />
                  )}
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
        </div>
      </div>
    </div>
  );
}
