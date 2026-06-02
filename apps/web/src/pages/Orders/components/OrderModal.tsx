import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import styles from './OrderModal.module.css';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderModal({ isOpen, onClose, onSuccess }: OrderModalProps) {
  const [formData, setFormData] = useState({
    faultDesc: '',
    category: '故障维修',
    priority: 'P2',
    deviceId: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        faultDesc: '',
        category: '故障维修',
        priority: 'P2',
        deviceId: '',
      });
      setErrorMsg('');
      
      // Fetch devices for the dropdown
      const fetchDevices = async () => {
        try {
          const res = await apiClient.get('/devices');
          setDevices(res.items || res || []);
        } catch (e) {
          console.error(e);
        }
      };
      fetchDevices();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      // Mock projectId for now, backend will use it
      const me = await apiClient.get('/auth/me');
      await apiClient.post('/orders', {
        ...formData,
        deviceId: formData.deviceId || undefined,
        projectId: me.projectIds?.[0] || '37bccf72-9b9b-4863-882a-da95a42f20d6', // dummy
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      setErrorMsg(error.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>新建维修工单</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          
          <div className={styles.formContent}>
            <div className={styles.formGroup}>
              <label>故障描述 <span style={{color: 'red'}}>*</span></label>
              <textarea 
                name="faultDesc" 
                value={formData.faultDesc} 
                onChange={handleChange} 
                required 
                placeholder="请详细描述故障现象..."
                rows={4}
              />
            </div>
            
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label>优先级</label>
                <select name="priority" value={formData.priority} onChange={handleChange}>
                  <option value="P0">P0 (特急)</option>
                  <option value="P1">P1 (紧急)</option>
                  <option value="P2">P2 (普通)</option>
                  <option value="P3">P3 (低)</option>
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>工单类型</label>
                <select name="category" value={formData.category} onChange={handleChange}>
                  <option value="故障维修">故障维修</option>
                  <option value="定期保养">定期保养</option>
                  <option value="设备安装">设备安装</option>
                  <option value="紧急抢修">紧急抢修</option>
                  <option value="巡检">巡检</option>
                </select>
              </div>
              
              <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
                <label>关联设备 (可选)</label>
                <select name="deviceId" value={formData.deviceId} onChange={handleChange}>
                  <option value="">-- 请选择关联设备 --</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.deviceNo} - {d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
            <button type="submit" className={styles.submitBtn} disabled={loading || !formData.faultDesc}>
              {loading ? '提交中...' : '确定派发'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
