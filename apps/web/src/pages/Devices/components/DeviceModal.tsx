import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import styles from './DeviceModal.module.css';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device?: any; // If provided, it's edit mode
}

export default function DeviceModal({ isOpen, onClose, onSuccess, device }: DeviceModalProps) {
  const [formData, setFormData] = useState({
    deviceNo: '',
    name: '',
    category: '灯具',
    manufacturer: '',
    model: '',
    location: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (device) {
        setFormData({
          deviceNo: device.deviceNo || '',
          name: device.name || '',
          category: device.category || '灯具',
          manufacturer: device.manufacturer || '',
          model: device.model || '',
          location: device.location || '',
        });
      } else {
        setFormData({
          deviceNo: `DEV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          name: '',
          category: '灯具',
          manufacturer: '',
          model: '',
          location: '',
        });
      }
      setErrorMsg('');
    }
  }, [isOpen, device]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (device?.id) {
        await apiClient.put(`/devices/${device.id}`, formData);
      } else {
        const me = await apiClient.get('/auth/me');
        await apiClient.post('/devices', {
          ...formData,
          projectId: me.projectIds?.[0] || '37bccf72-9b9b-4863-882a-da95a42f20d6',
        });
      }
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
          <h2>{device ? '编辑设备' : '新增设备'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>设备编号</label>
              <input name="deviceNo" value={formData.deviceNo} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label>设备名称</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="例如: MA3 全尺寸控台" />
            </div>
            <div className={styles.formGroup}>
              <label>分类</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="灯具">灯具</option>
                <option value="控台">控台</option>
                <option value="配电">配电</option>
                <option value="音频">音频</option>
                <option value="视频">视频</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>品牌/厂商</label>
              <input name="manufacturer" value={formData.manufacturer} onChange={handleChange} placeholder="例如: MA/Martin" />
            </div>
            <div className={styles.formGroup}>
              <label>型号</label>
              <input name="model" value={formData.model} onChange={handleChange} placeholder="例如: V1" />
            </div>
            <div className={styles.formGroup}>
              <label>所在位置</label>
              <input name="location" value={formData.location} onChange={handleChange} placeholder="例如: 主舞台" />
            </div>
          </div>
          
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? '提交中...' : '确定'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
