import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, getApiBaseUrl, setApiBaseUrl } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/errors';
import styles from './Login.module.css';

interface LoginResponse {
  accessToken: string;
  user: Parameters<ReturnType<typeof useAuthStore.getState>['setAuth']>[1];
}

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const submittedApiUrl = String(formData.get('apiUrl') || apiUrl).trim();
    const submittedPhone = String(formData.get('phone') || phone).trim();
    const submittedPassword = String(formData.get('password') || password);

    if (!submittedApiUrl || !submittedPhone || !submittedPassword) {
      setErrorMsg('请输入服务器地址、账号和密码');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      setApiUrl(submittedApiUrl);
      setPhone(submittedPhone);
      setPassword(submittedPassword);
      setApiBaseUrl(submittedApiUrl);
      const res = await apiClient.post<LoginResponse>('/auth/login', {
        phone: submittedPhone,
        password: submittedPassword,
      });
      useAuthStore.getState().setAuth(res.accessToken, res.user);
      setLoading(false);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      setErrorMsg(getErrorMessage(error, '登录失败，请检查账号、密码和服务器地址'));
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <section className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className={styles.brandHeader}>
            <div className={styles.logoBox}>
              <span className={styles.logoW}>W</span>
            </div>
            <div className={styles.brandInfo}>
              <span className={styles.brandKicker}>LIGHT OPS</span>
              <h1 className={styles.brandTitle}>W-Light</h1>
              <span className={styles.brandSubtitle}>文旅灯光运维控制台</span>
            </div>
          </div>

          <h2 className={styles.heroTitle}>把项目、设备、工单、巡检和备件收进一套控制台。</h2>
          <p className={styles.heroDesc}>
            面向文旅灯光现场，连接 Android APP、Web 和 Windows 客户端，所有数据同步到同一套云端后端。
          </p>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Orders</span>
              <h3>工单闭环</h3>
              <p>报修、派单、维修记录、备件消耗和验收归档集中管理。</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Devices</span>
              <h3>设备巡检</h3>
              <p>设备台账、二维码、巡检计划、异常转工单和维修历史联动。</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Toolbox</span>
              <h3>灯光工具</h3>
              <p>DMX、功率、BPM、LTC、光束角、压降和 Art-Net 地址随手可用。</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.rightPanel}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.loginLogoSmall}>W</div>
            <div className={styles.loginTitleGroup}>
              <h2 className={styles.loginTitle}>登录控制台</h2>
              <span className={styles.loginSubtitle}>连接 W-Light 云端运维服务</span>
            </div>
          </div>

          <form className={styles.loginForm} onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="apiUrl">服务器地址</label>
              <input
                id="apiUrl"
                name="apiUrl"
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                autoComplete="url"
                placeholder="https://你的域名/v1"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="phone">账号</label>
              <input
                id="phone"
                name="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="username"
                placeholder="请输入账号或手机号"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">密码</label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="请输入密码"
                required
              />
            </div>

            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录控制台'}
            </button>
          </form>
        </div>

        <div className={styles.footer}>© 2026 W-Light</div>
      </section>
    </div>
  );
}
