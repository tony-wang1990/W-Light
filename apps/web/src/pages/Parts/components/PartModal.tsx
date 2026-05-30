import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import styles from './PartModal.module.css';

interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  part?: any; // If provided, edit mode
}

export default function PartModal({ isOpen, onClose, onSuccess, part }: PartModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    model: '',
    unit: '个',
    minStock: 5,
    supplier: '',
    supplierPhone: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (part) {
        setFormData({
          name: part.name || '',
          model: part.model || '',
          unit: part.unit || '个',
          minStock: part.minStock ?? 5,
          supplier: part.supplier || '',
          supplierPhone: part.supplierPhone || '',
        });
      } else {
        setFormData({
          name: '',
          model: '',
          unit: '个',
          minStock: 5,
          supplier: '',
          supplierPhone: '',
        });
      }
      setErrorMsg('');
    }
  }, [isOpen, part]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'minStock' ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const { apiClient } = await import('../../../api/client');
      if (part?.id) {
        await apiClient.put(`/parts/${part.id}`, formData);
      } else {
        const me = await apiClient.get('/auth/me');
        await apiClient.post('/parts', {
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
          <h2>{part ? '编辑备件' : '新增备件'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>备件名称 *</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="例如: 欧司朗 330W 灯泡" />
            </div>
            <div className={styles.formGroup}>
              <label>型号规格</label>
              <input name="model" value={formData.model} onChange={handleChange} placeholder="例如: 330W 15R" />
            </div>
            <div className={styles.formGroup}>
              <label>单位 *</label>
              <input name="unit" value={formData.unit} onChange={handleChange} placeholder="例如: 个、米" required />
            </div>
            <div className={styles.formGroup}>
              <label>安全库存阈值</label>
              <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} min={0} required />
            </div>
            <div className={styles.formGroup}>
              <label>供应商</label>
              <input name="supplier" value={formData.supplier} onChange={handleChange} placeholder="例如: 鑫海光电" />
            </div>
            <div className={styles.formGroup}>
              <label>供应商电话</label>
              <input name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} placeholder="例如: 13800138000" />
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
