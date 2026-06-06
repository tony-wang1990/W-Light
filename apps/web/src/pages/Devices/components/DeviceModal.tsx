import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { getErrorMessage } from '../../../utils/errors';
import styles from './DeviceModal.module.css';

interface DeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  device?: any;
}

const emptyForm = {
  deviceNo: '',
  name: '',
  category: '灯具',
  manufacturer: '',
  model: '',
  location: '',
  status: 'normal',
  qrCode: '',
};

export default function DeviceModal({ isOpen, onClose, onSuccess, device }: DeviceModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (device) {
      setFormData({
        deviceNo: device.deviceNo || '',
        name: device.name || '',
        category: device.category || '灯具',
        manufacturer: device.manufacturer || '',
        model: device.model || '',
        location: device.location || '',
        status: device.status || 'normal',
        qrCode: device.qrCode || '',
      });
    } else {
      setFormData({
        ...emptyForm,
        deviceNo: `DEV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      });
    }
    setErrorMsg('');
  }, [isOpen, device]);

  if (!isOpen) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const payload = {
        ...formData,
        qrCode: formData.qrCode.trim() || formData.deviceNo,
      };
      if (device?.id) {
        await apiClient.put(`/devices/${device.id}`, payload);
      } else {
        await apiClient.post('/devices', payload);
      }
      onSuccess();
      onClose();
    } catch (error) {
      setErrorMsg(getErrorMessage(error, '保存设备失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{device ? '编辑设备' : '新增设备'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
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
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="例如：主舞台光束灯 01" />
            </div>
            <div className={styles.formGroup}>
              <label>分类</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="灯具">灯具</option>
                <option value="控台">控台</option>
                <option value="配电">配电</option>
                <option value="网络">网络</option>
                <option value="音频">音频</option>
                <option value="视频">视频</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>运行状态</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="normal">正常运行</option>
                <option value="maintenance">维修中</option>
                <option value="fault">故障</option>
                <option value="offline">离线</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>品牌/厂商</label>
              <input name="manufacturer" value={formData.manufacturer} onChange={handleChange} placeholder="例如：MA / Martin" />
            </div>
            <div className={styles.formGroup}>
              <label>型号</label>
              <input name="model" value={formData.model} onChange={handleChange} placeholder="例如：MAC Viper" />
            </div>
            <div className={styles.formGroup}>
              <label>所在位置</label>
              <input name="location" value={formData.location} onChange={handleChange} placeholder="例如：主舞台上场门 TRUSS A" />
            </div>
            <div className={styles.formGroup}>
              <label>二维码内容</label>
              <input name="qrCode" value={formData.qrCode} onChange={handleChange} placeholder="留空则使用设备编号" />
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
