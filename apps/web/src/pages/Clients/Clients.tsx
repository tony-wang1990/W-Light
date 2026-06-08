import { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Monitor, Smartphone, TabletSmartphone } from 'lucide-react';
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
      href: 'https://github.com/tony-wang1990/W-Light/releases/latest/download/w-light-latest.apk',
      primary: true,
      note: '通过 GitHub Releases 自动构建并提供下载。',
    },
    {
      title: 'Windows 客户端',
      platform: 'Windows 10/11',
      description: 'Electron 桌面安装包，适合调度室和项目管理电脑长期使用。',
      href: 'https://github.com/tony-wang1990/W-Light/releases/latest/download/W-Light-Setup-latest.exe',
      primary: true,
      note: '通过 GitHub Releases 自动构建并提供下载。',
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
                <Monitor size={24} color="#7C3AED" />
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


    </div>
  );
}
