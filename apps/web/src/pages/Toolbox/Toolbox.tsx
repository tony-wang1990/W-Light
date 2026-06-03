import { useState, useRef, useEffect } from 'react';
import { Activity, Cpu } from 'lucide-react';
import styles from './Toolbox.module.css';

export default function Toolbox() {
  // --- BPM State ---
  const [bpm, setBpm] = useState<number>(0);
  const tapsRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = () => {
    const now = Date.now();
    const taps = tapsRef.current;

    if (taps.length > 0 && now - taps[taps.length - 1] > 2000) {
      tapsRef.current = [];
    }

    tapsRef.current.push(now);
    
    if (tapsRef.current.length >= 2) {
      // Calculate average interval
      const intervals = [];
      for (let i = 1; i < tapsRef.current.length; i++) {
        intervals.push(tapsRef.current[i] - tapsRef.current[i - 1]);
      }
      
      // Keep only last 8 taps for rolling average
      if (tapsRef.current.length > 8) {
        tapsRef.current.shift();
      }

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      setBpm(calculatedBpm);
    }

    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapsRef.current = [];
    }, 3000);
  };

  const handleResetBpm = () => {
    tapsRef.current = [];
    setBpm(0);
  };

  // --- DMX State ---
  const [address, setAddress] = useState<string>('1');
  const [dipSwitches, setDipSwitches] = useState<boolean[]>(Array(10).fill(false));

  const calculateDip = (addr: number) => {
    const dips = Array(10).fill(false);
    if (addr < 1 || addr > 512) return dips;
    
    const temp = addr;
    for (let i = 0; i < 9; i++) {
      if ((temp & (1 << i)) !== 0) {
        dips[i] = true;
      }
    }
    return dips;
  };

  useEffect(() => {
    const num = parseInt(address, 10);
    if (!isNaN(num) && num >= 1 && num <= 512) {
      setDipSwitches(calculateDip(num));
    } else {
      setDipSwitches(Array(10).fill(false));
    }
  }, [address]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>专业工具箱</h1>
        <p className={styles.pageSubtitle}>快速测算灯光控制核心参数，网页版与手机端功能一致。</p>
      </div>

      <div className={styles.grid}>
        {/* BPM Tapper */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox}>
              <Activity size={20} />
            </div>
            <div>
              <h3>BPM 测速打拍</h3>
              <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>点击按钮测算现场音乐节奏</p>
            </div>
          </div>
          
          <div className={styles.bpmDisplay}>
            <div className={styles.bpmValue}>{bpm || '---'}</div>
            <div className={styles.bpmLabel}>BPM</div>
          </div>

          <button className={styles.tapBtn} onClick={handleTap}>
            TAP (点击打拍)
          </button>
          
          <button className={styles.resetBtn} onClick={handleResetBpm}>
            重置
          </button>
        </div>

        {/* DMX Calculator */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.iconBox} style={{ backgroundColor: '#FEE2E2', color: '#EF4444' }}>
              <Cpu size={20} />
            </div>
            <div>
              <h3>DMX 拨码计算器</h3>
              <p className={styles.pageSubtitle} style={{ marginTop: 4 }}>输入起始地址，获取拨码开关图示</p>
            </div>
          </div>

          <div className={styles.dmxForm}>
            <div className={styles.formGroup}>
              <label>DMX 起始地址 (1-512)</label>
              <input 
                type="number" 
                min="1" 
                max="512" 
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
              />
            </div>
          </div>

          <div className={styles.dmxResult}>
            <h4>拨码开关图示 (1=ON)</h4>
            <div className={styles.dipSwitches}>
              {dipSwitches.map((isOn, index) => (
                <div key={index} className={styles.dipSwitch}>
                  <div className={`${styles.dipToggle} ${isOn ? styles.on : ''}`}>
                    <div className={styles.dipNob}></div>
                  </div>
                  <span className={styles.dipLabel}>{index + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#64748B', textAlign: 'center' }}>
              计算原理：二进制算法（第 n 位拨码代表 2^(n-1)）
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
