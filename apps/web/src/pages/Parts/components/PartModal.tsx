import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiClient } from '../../../api/client';
import { getErrorMessage } from '../../../utils/errors';
import styles from './PartModal.module.css';

interface PartFormSource {
  id?: string;
  name?: string;
  model?: string;
  unit?: string;
  minStock?: number | string;
  supplier?: string;
  supplierPhone?: string;
}

interface PartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  part?: PartFormSource;
}

const emptyForm = {
  name: '',
  model: '',
  unit: '件',
  minStock: 5,
  supplier: '',
  supplierPhone: '',
};

export default function PartModal({ isOpen, onClose, onSuccess, part }: PartModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setFormData(part ? {
      name: part.name || '',
      model: part.model || '',
      unit: part.unit || '件',
      minStock: Number(part.minStock ?? 5),
      supplier: part.supplier || '',
      supplierPhone: part.supplierPhone || '',
    } : emptyForm);
    setErrorMsg('');
  }, [isOpen, part]);

  if (!isOpen) return null;

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'minStock' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      if (part?.id) {
        await apiClient.put(`/parts/${part.id}`, formData);
      } else {
        await apiClient.post('/parts', formData);
      }
      onSuccess();
      onClose();
    } catch (error) {
      setErrorMsg(getErrorMessage(error, '保存备件失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{part ? '编辑备件' : '新增备件'}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>备件名称 *</label>
              <input name="name" value={formData.name} onChange={handleChange} required placeholder="例如：光束灯灯泡" />
            </div>
            <div className={styles.formGroup}>
              <label>型号规格</label>
              <input name="model" value={formData.model} onChange={handleChange} placeholder="例如：330W 15R" />
            </div>
            <div className={styles.formGroup}>
              <label>单位 *</label>
              <input name="unit" value={formData.unit} onChange={handleChange} placeholder="例如：件、米、套" required />
            </div>
            <div className={styles.formGroup}>
              <label>安全库存阈值</label>
              <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} min={0} required />
            </div>
            <div className={styles.formGroup}>
              <label>供应商</label>
              <input name="supplier" value={formData.supplier} onChange={handleChange} placeholder="供应商名称" />
            </div>
            <div className={styles.formGroup}>
              <label>供应商电话</label>
              <input name="supplierPhone" value={formData.supplierPhone} onChange={handleChange} placeholder="例如：13800138000" />
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
