import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Monitor, RefreshCw, Smartphone, TabletSmartphone } from 'lucide-react';
import { getApiBaseUrl, getServerOrigin } from '../../api/client';
import styles from '../CommonAdmin.module.css';

interface ClientMetadata {
  target?: string;
  file?: string;
  version?: string;
  sourceArtifact?: string;
  builtAt?: string;
  publishedAt?: string;
  commit?: string;
  sha256?: string;
  sizeBytes?: number;
  minSdk?: number;
  signing?: string;
}

interface ClientItem {
  key: string;
  title: string;
  platform: string;
  description: string;
  href?: string;
  checksumHref?: string;
  metadataHref?: string;
  primary?: boolean;
  note: string;
  changelog: string[];
}

interface ClientDownloadStatus {
  state: 'checking' | 'available' | 'missing' | 'error';
  metadata?: ClientMetadata;
  checkedAt?: string;
  message?: string;
}

function resolveServerAddress() {
  const configured = getApiBaseUrl();
  if (configured.startsWith('http')) return configured;
  if (window.location.protocol === 'file:') return 'http://服务器IP:3005/v1';
  return `${window.location.origin}/v1`;
}

function resolveDownloadHref(path: string) {
  if (!path.startsWith('/')) return path;
  return `${getServerOrigin()}${path}`;
}

function formatBytes(value?: number) {
  if (!value) return '未知大小';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function buildDateNote(metadata?: ClientMetadata) {
  if (!metadata?.builtAt || !metadata?.publishedAt || metadata.builtAt === metadata.publishedAt) return '';
  return ` · 构建 ${formatDate(metadata.builtAt)}`;
}

function statusBadge(status?: ClientDownloadStatus) {
  if (!status || status.state === 'checking') return <span className={styles.badge}>检查中</span>;
  if (status.state === 'available') return <span className={`${styles.badge} ${styles.successBadge}`}>可下载</span>;
  if (status.state === 'missing') return <span className={`${styles.badge} ${styles.warningBadge}`}>未同步</span>;
  return <span className={`${styles.badge} ${styles.dangerBadge}`}>检查失败</span>;
}

export default function Clients() {
  const [copied, setCopied] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ClientDownloadStatus>>({});
  const serverAddress = useMemo(resolveServerAddress, []);

  const clientItems: ClientItem[] = useMemo(() => [
    {
      key: 'android',
      title: 'Android APP',
      platform: 'Android 手机/平板',
      description: '现场维修人员优先使用，支持扫码、离线队列、工单和工具箱。',
      href: '/downloads/w-light-latest.apk',
      checksumHref: '/downloads/w-light-latest.apk.sha256',
      metadataHref: '/downloads/w-light-android.json',
      primary: true,
      note: '内部自用直接分发 APK；服务器上存在 deploy/downloads/w-light-latest.apk 后即可下载。',
      changelog: ['连接同一套云端 API，手机端与 Web/Windows 数据同步', '保留离线工具箱能力，适合现场无网时使用', '公司内部使用可直接下载安装包，不需要上架应用商店'],
    },
    {
      key: 'windows',
      title: 'Windows 客户端',
      platform: 'Windows 10/11',
      description: 'Electron 桌面安装包，适合调度室和项目管理电脑长期使用。',
      href: '/downloads/W-Light-Setup-latest.exe',
      checksumHref: '/downloads/W-Light-Setup-latest.exe.sha256',
      metadataHref: '/downloads/w-light-desktop.json',
      primary: true,
      note: '内部自用直接分发 EXE；服务器上存在 deploy/downloads/W-Light-Setup-latest.exe 后即可下载。',
      changelog: ['独立窗口启动 Web 控制台，不再依赖浏览器标签页', '默认连接服务器 /v1 API，和手机端共享数据', '公司内部电脑可直接下载安装包，未签名时按 Windows 提示继续安装'],
    },
    {
      key: 'web',
      title: 'Web / PWA',
      platform: '浏览器安装',
      description: 'Chrome/Edge 可将当前 Web 控制台安装为桌面应用。',
      href: '/',
      primary: false,
      note: '无需安装包，浏览器地址栏或菜单中选择“安装应用”。',
      changelog: ['无需下载客户端，适合临时电脑快速访问', '与 Android 和 Windows 共用同一套云端数据', '服务器升级后刷新页面即可使用新版本'],
    },
  ], []);

  const refreshStatus = useCallback(async () => {
    setStatuses(Object.fromEntries(clientItems.map(item => [item.key, { state: 'checking' as const }])));
    await Promise.all(clientItems.map(async (item) => {
      if (!item.href || item.key === 'web') {
        setStatuses(prev => ({
          ...prev,
          [item.key]: { state: 'available', checkedAt: new Date().toISOString(), message: 'Web 控制台在线可用' },
        }));
        return;
      }

      try {
        let metadata: ClientMetadata | undefined;
        if (item.metadataHref) {
          const metadataResponse = await fetch(resolveDownloadHref(item.metadataHref), { cache: 'no-store' });
          if (metadataResponse.ok) metadata = await metadataResponse.json() as ClientMetadata;
        }

        const downloadHref = resolveDownloadHref(metadata?.file ? `/downloads/${metadata.file}` : item.href);
        const response = await fetch(downloadHref, { method: 'HEAD', cache: 'no-store' });
        setStatuses(prev => ({
          ...prev,
          [item.key]: {
            state: response.ok ? 'available' : 'missing',
            metadata,
            checkedAt: new Date().toISOString(),
            message: response.ok ? '安装包已同步到服务器' : `服务器未找到安装包，HTTP ${response.status}`,
          },
        }));
      } catch (err) {
        setStatuses(prev => ({
          ...prev,
          [item.key]: {
            state: 'error',
            checkedAt: new Date().toISOString(),
            message: err instanceof Error ? err.message : '无法检查下载状态',
          },
        }));
      }
    }));
  }, [clientItems]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const copyServerAddress = async () => {
    try {
      await navigator.clipboard.writeText(serverAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('复制服务器地址', serverAddress);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>客户端下载中心</h1>
          <p className={styles.pageSubtitle}>当前维护 Android APP、Windows 客户端和 Web/PWA，所有客户端连接同一套云端 API，数据统一同步。</p>
        </div>
        <button className={styles.secondaryBtn} onClick={refreshStatus}>
          <RefreshCw size={16} /> 重新检查
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2 className={styles.cardTitle}>客户端登录服务器地址</h2>
            <p className={styles.pageSubtitle}>手机 APP 和桌面客户端首次登录时填写下面这个地址。</p>
          </div>
          <span className={styles.badge}>API</span>
        </div>
        <div className={styles.copyBox}>
          <span>{serverAddress}</span>
          <button className={styles.secondaryBtn} onClick={copyServerAddress}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {clientItems.map(item => {
          const status = statuses[item.key];
          const metadata = status?.metadata;
          const downloadHref = item.href
            ? resolveDownloadHref(metadata?.file ? `/downloads/${metadata.file}` : item.href)
            : undefined;
          const checksumHref = item.checksumHref
            ? resolveDownloadHref(metadata?.file ? `/downloads/${metadata.file}.sha256` : item.checksumHref)
            : undefined;
          const isAvailable = status?.state === 'available';

          return (
            <div className={styles.card} key={item.key}>
              <div className={styles.cardHeader}>
                <div>
                  <h2 className={styles.cardTitle}>{item.title}</h2>
                  <span className={styles.muted}>{item.platform}</span>
                </div>
                {item.key === 'android' ? (
                  <Smartphone size={24} color="#00A67E" />
                ) : item.key === 'web' ? (
                  <TabletSmartphone size={24} color="#2563EB" />
                ) : (
                  <Monitor size={24} color="#7C3AED" />
                )}
              </div>

              <p className={styles.pageSubtitle}>{item.description}</p>
              <div className={styles.actions} style={{ marginTop: 12 }}>
                {statusBadge(status)}
                <span className={styles.muted}>版本：{metadata?.version || metadata?.commit || '内部测试版'}</span>
                <span className={styles.muted}>包内代码：{metadata?.commit || '未记录'}</span>
                <span className={styles.muted}>大小：{formatBytes(metadata?.sizeBytes)}</span>
              </div>
              <div className={styles.muted} style={{ marginTop: 8 }}>
                发布时间：{formatDate(metadata?.publishedAt || metadata?.builtAt)}{buildDateNote(metadata)}{metadata?.sha256 ? ` · SHA256 ${metadata.sha256.slice(0, 12)}...` : ''}
              </div>

              <div style={{ marginTop: 12 }}>
                <h3 className={styles.cardTitle} style={{ fontSize: 14 }}>更新说明</h3>
                <div className={styles.list} style={{ marginTop: 8 }}>
                  {item.changelog.map(line => <span className={styles.muted} key={line}>• {line}</span>)}
                </div>
              </div>

              <div className={styles.muted} style={{ marginTop: 12 }}>{item.note}</div>
              {status?.message && <div className={styles.muted} style={{ marginTop: 8 }}>状态：{status.message}</div>}

              <div className={styles.actions} style={{ marginTop: 16 }}>
                <a
                  className={item.primary ? styles.primaryBtn : styles.secondaryBtn}
                  href={isAvailable ? downloadHref : undefined}
                  aria-disabled={!isAvailable}
                  onClick={event => {
                    if (!isAvailable) event.preventDefault();
                  }}
                >
                  <Download size={16} /> {item.key === 'web' ? '打开 Web 控制台' : isAvailable ? '下载安装包' : '服务器未同步'}
                </a>
                {checksumHref && (
                  <a
                    className={styles.secondaryBtn}
                    href={isAvailable ? checksumHref : undefined}
                    aria-disabled={!isAvailable}
                    onClick={event => {
                      if (!isAvailable) event.preventDefault();
                    }}
                  >
                    校验 SHA256
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
