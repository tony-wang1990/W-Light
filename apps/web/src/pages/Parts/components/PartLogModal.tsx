import React, { useState, useEffect } from 'react';
import { X, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import styles from './PartModal.module.css';

interface PartLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  part: any; // The part being operated on
  type: 'in' | 'out';
}

export default function PartLogModal({ isOpen, onClose, onSuccess, part, type }: PartLogModalProps) {
  const [formData, setFormData] = useState({
    quantity: 1,
    note: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        quantity: 1,
        note: type === 'in' ? '采购入库' : '领料出库',
      });
      setErrorMsg('');
    }
  }, [isOpen, type]);

  if (!isOpen || !part) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'quantity' ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'out' && formData.quantity > part.stock) {
      setErrorMsg('库存不足！当前库存只有 ' + part.stock);
      return;
    }
    
    setLoading(true);
    setErrorMsg('');
    try {
      const { apiClient } = await import('../../../api/client');
      // Get current user for operatorId
      const me = await apiClient.get('/auth/me');
      // POST /spare-parts/logs with correct opType: 'inbound' or 'outbound'
      await apiClient.post('/spare-parts/logs', {
        partId: part.id,
        opType: type === 'in' ? 'inbound' : 'outbound',
        quantity: formData.quantity,
        note: formData.note,
        operatorId: me.id,
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      // Fallback: try direct inbound/outbound endpoints
      try {
        const { apiClient } = await import('../../../api/client');
        await apiClient.post(`/parts/${part.id}/${type === 'in' ? 'inbound' : 'outbound'}`, {
          quantity: formData.quantity,
          note: formData.note,
        });
        onSuccess();
        onClose();
      } catch (err2: any) {
        setErrorMsg(error.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {type === 'in' ? <ArrowDownToLine color="#00A67E" /> : <ArrowUpFromLine color="#DC2626" />}
            <h2>{type === 'in' ? '备件入库' : '备件出库'}</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}
          
          <div style={{ padding: '24px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 16 }}>{part.name}</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, color: '#6B7280' }}>
              <span>型号: {part.model || '无'}</span>
              <span>当前库存: <strong style={{color: type === 'out' ? '#DC2626' : '#111827'}}>{part.stock} {part.unit}</strong></span>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>操作数量 ({part.unit})</label>
              <input 
                type="number" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleChange} 
                min={1} 
                max={type === 'out' ? part.stock : undefined}
                required 
              />
            </div>
            <div className={styles.formGroup} style={{ gridColumn: 'span 2' }}>
              <label>备注说明</label>
              <input 
                name="note" 
                value={formData.note} 
                onChange={handleChange} 
                placeholder="请输入说明，例如：用于A区主舞台光束灯维修" 
                required 
              />
            </div>
          </div>
          
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>取消</button>
            <button 
              type="submit" 
              className={styles.submitBtn} 
              style={{ backgroundColor: type === 'out' ? '#DC2626' : '#00A67E' }}
              disabled={loading || formData.quantity <= 0}
            >
              {loading ? '提交中...' : `确认${type === 'in' ? '入库' : '出库'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
