import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, MonitorDown, Smartphone, TabletSmartphone } from 'lucide-react';
import { getApiBaseUrl } from '../../api/client';
import styles from '../CommonAdmin.module.css';

interface ClientItem {
  title: string;
  platform: string;
  description: string;
  href?: string;
  primary?: boolean;
  note: string;
}

function resolveServerAddress() {
  const configured = getApiBaseUrl();
  if (configured.startsWith('http')) return configured;
  if (window.location.protocol === 'file:') return 'http://服务器IP:3005/v1';
  return `${window.location.origin}/v1`;
}

export default function Clients() {
  const [copied, setCopied] = useState(false);
  const serverAddress = useMemo(resolveServerAddress, []);

  const clientItems: ClientItem[] = [
    {
      title: 'Android APP',
      platform: 'Android 手机/平板',
      description: '现场维修人员优先使用，支持扫码、离线队列、工单和工具箱。',
      href: '/downloads/w-light-latest.apk',
      primary: true,
      note: '服务器构建或上传 APK 后，此链接可直接下载。',
    },
    {
      title: 'iOS APP',
      platform: 'iPhone / iPad',
      description: '需要使用 Xcode/TestFlight 或企业签名发布，连接同一云端 API。',
      note: 'iOS 不能直接下载 APK，需用苹果签名流程生成安装包。',
    },
    {
      title: 'Windows 客户端',
      platform: 'Windows 10/11',
      description: 'Electron 桌面安装包，适合调度室和项目管理电脑长期使用。',
      href: '/downloads/W-Light-Setup-latest.exe',
      primary: true,
      note: '运行桌面打包脚本并上传后可下载。',
    },
    {
      title: 'Mac 客户端',
      platform: 'macOS Intel/Apple Silicon',
      description: 'Electron DMG 安装包，功能与 Web 管理端同步。',
      href: '/downloads/W-Light-latest.dmg',
      note: '需在 macOS 打包机生成并上传 DMG。',
    },
    {
      title: 'Linux 客户端',
      platform: 'Ubuntu/Debian 桌面',
      description: 'AppImage 形式交付，适合运维工作站。',
      href: '/downloads/W-Light-latest.AppImage',
      note: '需运行桌面打包脚本生成 Linux 包。',
    },
    {
      title: 'Web / PWA',
      platform: '浏览器安装',
      description: 'Chrome/Edge 可将当前 Web 控制台安装为桌面应用。',
      href: '/',
      note: '浏览器地址栏或菜单中选择“安装应用”。',
    },
  ];

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
          <p className={styles.pageSubtitle}>Android、iOS、Windows、Mac、Linux 和 Web/PWA 都连接同一套云端 API，数据统一同步。</p>
        </div>
        <div className={styles.actions}>
          <a className={styles.secondaryBtn} href="/downloads/" target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> 打开下载目录
          </a>
        </div>
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
        {clientItems.map(item => (
          <div className={styles.card} key={item.title}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>{item.title}</h2>
                <span className={styles.muted}>{item.platform}</span>
              </div>
              {item.title.includes('Android') || item.title.includes('iOS') ? (
                <Smartphone size={24} color="#00A67E" />
              ) : item.title.includes('Web') ? (
                <TabletSmartphone size={24} color="#2563EB" />
              ) : (
                <MonitorDown size={24} color="#7C3AED" />
              )}
            </div>
            <p className={styles.pageSubtitle}>{item.description}</p>
            <div className={styles.muted} style={{ marginTop: 12 }}>{item.note}</div>
            <div className={styles.actions} style={{ marginTop: 16 }}>
              {item.href ? (
                <a className={item.primary ? styles.primaryBtn : styles.secondaryBtn} href={item.href}>
                  <Download size={16} /> 下载/打开
                </a>
              ) : (
                <span className={styles.warningBadge} style={{ padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  需签名发布
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>打包与上传提示</h2>
        <div className={styles.list} style={{ marginTop: 12 }}>
          <div className={styles.copyBox}>
            <span>Android 打包</span>
            <strong>scripts/android-release.sh 或 scripts/android-release.ps1</strong>
          </div>
          <div className={styles.copyBox}>
            <span>Windows/Mac/Linux 桌面端打包</span>
            <strong>scripts/desktop-release.sh 或 scripts/desktop-release.ps1</strong>
          </div>
          <div className={styles.copyBox}>
            <span>服务器下载目录</span>
            <strong>/root/W-Light/deploy/downloads</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
