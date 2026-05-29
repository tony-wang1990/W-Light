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
    partNo: '',
    name: '',
    category: '光源',
    specification: '',
    unit: '个',
    safeStock: 5,
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (part) {
        setFormData({
          partNo: part.partNo || '',
          name: part.name || '',
          category: part.category || '光源',
          specification: part.specification || '',
          unit: part.unit || '个',
          safeStock: part.safeStock || 5,
        });
      } else {
        setFormData({
          partNo: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
          name: '',
          category: '光源',
          specification: '',
          unit: '个',
          safeStock: 5,
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
      [name]: name === 'safeStock' ? Number(value) : value 
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
          projectId: me.projectIds?.[0] || '37bccf72-9b9b-4863-882a-da95a42f20d6'
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
              <label>备件编号</label>
              <input name="partNo" value={formData.partNo} onChange={handleChange} required />
            </div>
            <div className={styles.formGroup}>
              <label>备件名称</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="例如: 欧司朗 330W 灯泡" />
            </div>
            <div className={styles.formGroup}>
              <label>分类</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="光源">光源</option>
                <option value="线材">线材</option>
                <option value="配件">配件</option>
                <option value="五金">五金</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>规格参数</label>
              <input name="specification" value={formData.specification} onChange={handleChange} placeholder="例如: 330W 15R" />
            </div>
            <div className={styles.formGroup}>
              <label>单位</label>
              <input name="unit" value={formData.unit} onChange={handleChange} placeholder="例如: 个、米" required />
            </div>
            <div className={styles.formGroup}>
              <label>安全库存阈值</label>
              <input type="number" name="safeStock" value={formData.safeStock} onChange={handleChange} min={0} required />
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
