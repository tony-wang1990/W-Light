import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import styles from './Login.module.css';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone || !password) return;
    
    setLoading(true);
    setErrorMsg('');
    try {
      // ==== 临时演示模式 ====
      if (phone === 'admin' && password === 'admin') {
        setTimeout(() => {
          setLoading(false);
          navigate('/dashboard');
        }, 500);
        return;
      }
      // ====================

      const res = await apiClient.post('/auth/login', { phone, password });
      useAuthStore.getState().setAuth(res.data.accessToken, res.data.user);
      setLoading(false);
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || '登录失败，请检查后台服务是否已启动');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Left side: Branding & Features */}
      <div className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className={styles.header}>
            <div className={styles.logoBox}>
              <span className={styles.logoW}>W</span>
            </div>
            <div className={styles.brandInfo}>
              <span className={styles.brandTitleSmall}>WANG DETECTIVE</span>
              <h1 className={styles.brandTitle}>W-Light</h1>
              <span className={styles.brandSubtitle}>Operations Command Center</span>
            </div>
          </div>

          <h2 className={styles.heroTitle}>
            把 项目、设备、工单、<br />
            人员、巡检和备件能力收进一个控制台。
          </h2>
          <p className={styles.heroDesc}>
            面向文旅灯光项目管理场景，强调真实操作、可追溯、可协同。
          </p>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Orders</span>
              <h3>工单与调度</h3>
              <p>故障报修、派单状态、维修步骤录入与进度集中管理。</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Devices</span>
              <h3>设备与巡检</h3>
              <p>设备台账、保修状态、健康打分和日常巡检计划一查百通。</p>
            </div>
            <div className={styles.featureCard}>
              <span className={styles.featureTag}>Toolbox</span>
              <h3>专业工具箱</h3>
              <p>打拍测速、DMX测算、照度与功率设计与现场中心联动。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className={styles.rightPanel}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <div className={styles.loginLogoSmall}>W</div>
            <div className={styles.loginTitleGroup}>
              <h2 className={styles.loginTitle}>登录控制台</h2>
              <span className={styles.loginSubtitle}>W-Light 资源与运维管理</span>
            </div>
          </div>

          <form className={styles.loginForm} onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="phone">账号</label>
              <input
                id="phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号 (如: 13800000001)"
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">密码</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码 (如: admin)"
                required
              />
            </div>

            {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
            
            <button 
              type="submit" 
              className={styles.submitBtn} 
              disabled={loading || !phone || !password}
            >
              {loading ? '登录中...' : '登录控制台'}
            </button>
          </form>
        </div>

        <div className={styles.footer}>
          © 2026 W-Light · 关灯
        </div>
      </div>
    </div>
  );
}
