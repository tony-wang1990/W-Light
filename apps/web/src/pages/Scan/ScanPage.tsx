import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertCircle, CheckCircle, Cpu, MapPin, Tag } from 'lucide-react';

interface DeviceInfo {
  id: string;
  deviceNo: string;
  name: string;
  category?: string;
  location?: string;
  status: string;
  healthScore?: number;
  manufacturer?: string;
  model?: string;
  warrantyExpire?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: '正常运行', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  maintenance: { label: '维修中', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  fault: { label: '故障', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  offline: { label: '离线', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
};

export default function ScanPage() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 从 localStorage 读取服务器地址
  const serverUrl = (() => {
    try {
      const stored = localStorage.getItem('api_base_url');
      return stored ? stored.replace(/\/+$/, '') : '';
    } catch { return ''; }
  })();

  useEffect(() => {
    if (!qrCode) { setError('无效的二维码'); setLoading(false); return; }
    if (!serverUrl) { setError('请先在 App 中配置服务器地址'); setLoading(false); return; }

    fetch(`${serverUrl}/public/devices/scan/${encodeURIComponent(qrCode)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('设备未找到');
        return res.json();
      })
      .then((data) => { setDevice(data); setLoading(false); })
      .catch((err) => { setError(err.message || '查询失败'); setLoading(false); });
  }, [qrCode, serverUrl]);

  const statusInfo = STATUS_MAP[device?.status?.toLowerCase() || ''] || { label: '未知', color: '#9CA3AF', bg: '#F3F4F6' };
  const healthScore = Number(device?.healthScore || 0);
  const healthColor = healthScore > 80 ? '#10B981' : healthScore > 60 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Logo */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #00C896, #0EA5E9)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: 'white' }}>W</div>
        <div style={{ fontSize: 13, color: '#6B7280' }}>W-Light 设备信息卡</div>
      </div>

      <div style={{ width: '100%', maxWidth: 380, background: 'white', borderRadius: 20, boxShadow: '0 4px 32px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: 14 }}>查询设备信息中...</div>
          </div>
        )}

        {error && (
          <div style={{ padding: '48px 32px', textAlign: 'center' }}>
            <AlertCircle size={40} color="#EF4444" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 8 }}>查询失败</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>{error}</div>
          </div>
        )}

        {device && (
          <>
            {/* 状态条 */}
            <div style={{ background: statusInfo.color, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={14} color="white" />
              <span style={{ color: 'white', fontWeight: 600, fontSize: 13 }}>{statusInfo.label}</span>
            </div>

            {/* 设备主信息 */}
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,200,150,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Cpu size={22} color="#00C896" />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{device.name}</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#6B7280', background: '#F3F4F6', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>{device.deviceNo}</div>
                </div>
              </div>

              {/* 健康度 */}
              <div style={{ marginTop: 20, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: '#6B7280' }}>设备健康度</span>
                  <span style={{ fontWeight: 700, color: healthColor }}>{healthScore} 分</span>
                </div>
                <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${healthScore}%`, background: healthColor, borderRadius: 4, transition: 'width 0.6s' }} />
                </div>
              </div>
            </div>

            {/* 详细信息 */}
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {device.category && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                  <Tag size={15} color="#6B7280" />
                  <div><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>设备类型</div><div style={{ fontSize: 14, fontWeight: 500 }}>{device.category}</div></div>
                </div>
              )}
              {device.location && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                  <MapPin size={15} color="#6B7280" />
                  <div><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>安装位置</div><div style={{ fontSize: 14, fontWeight: 500 }}>{device.location}</div></div>
                </div>
              )}
              {device.manufacturer && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                  <Cpu size={15} color="#6B7280" />
                  <div><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>品牌/型号</div><div style={{ fontSize: 14, fontWeight: 500 }}>{device.manufacturer}{device.model ? ` · ${device.model}` : ''}</div></div>
                </div>
              )}
              {device.warrantyExpire && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                  <CheckCircle size={15} color="#6B7280" />
                  <div><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 2 }}>质保到期</div><div style={{ fontSize: 14, fontWeight: 500 }}>{new Date(device.warrantyExpire).toLocaleDateString('zh-CN')}</div></div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: '#9CA3AF' }}>W-Light · 文旅灯光运维一体化平台</div>
    </div>
  );
}
