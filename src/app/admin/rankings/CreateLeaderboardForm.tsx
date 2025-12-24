'use client';

import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Calendar } from 'primereact/calendar';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';

interface CreateLeaderboardFormProps {
  onSuccess: () => void;
}

export default function CreateLeaderboardForm({ onSuccess }: CreateLeaderboardFormProps) {
  const { showToast } = useToastContext();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_at: null as Date | null,
    end_at: null as Date | null,
    rank_by_field: '',
    sort_order: 'desc',
    type: 'score',
    remarks: ''
  });
  
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const reqData = {
        ...formData,
        start_at: formData.start_at ? formData.start_at.toISOString() : undefined,
        end_at: formData.end_at ? formData.end_at.toISOString() : undefined
      };
      
      const result = await rankingService.createLeaderboard(reqData);
      
      if (result) {
        showToast({ 
          severity: 'success', 
          summary: '成功', 
          detail: '排行榜创建成功' 
        });
        onSuccess();
      } else {
        showToast({ 
          severity: 'error', 
          summary: '失败', 
          detail: '排行榜创建失败' 
        });
      }
    } catch (error) {
      console.error('创建排行榜失败:', error);
      showToast({ 
        severity: 'error', 
        summary: '失败', 
        detail: '排行榜创建失败' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { value: any; target: { name: string; value: any } }) => {
    const name = e.target.name || '';
    const value = e.value;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const sortOptions = [
    { label: '降序 (高到低)', value: 'desc' },
    { label: '升序 (低到高)', value: 'asc' }
  ];

  const typeOptions = [
    { label: '分数', value: 'score' },
    { label: '时间', value: 'time' },
    { label: '其他', value: 'other' }
  ];

  return (
    <Card className="border border-surface-200 shadow-none">
      <form onSubmit={handleSubmit} className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="field">
            <label htmlFor="title" className="block font-medium mb-2">标题 *</label>
            <InputText
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full"
              required
            />
          </div>
          
          <div className="field">
            <label htmlFor="rank_by_field" className="block font-medium mb-2">排名字段 *</label>
            <InputText
              id="rank_by_field"
              name="rank_by_field"
              value={formData.rank_by_field}
              onChange={handleChange}
              className="w-full"
              required
              placeholder="如: score, time, points"
            />
          </div>
        </div>
        
        <div className="field mb-4">
          <label htmlFor="description" className="block font-medium mb-2">描述</label>
          <InputTextarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full"
            rows={3}
            placeholder="排行榜的详细描述"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="field">
            <label htmlFor="start_at" className="block font-medium mb-2">开始时间</label>
            <Calendar
              id="start_at"
              name="start_at"
              value={formData.start_at}
              onChange={handleChange}
              className="w-full"
              showTime
              dateFormat="yy-mm-dd"
              hourFormat="24"
              placeholder="选择开始时间"
            />
          </div>
          
          <div className="field">
            <label htmlFor="end_at" className="block font-medium mb-2">结束时间</label>
            <Calendar
              id="end_at"
              name="end_at"
              value={formData.end_at}
              onChange={handleChange}
              className="w-full"
              showTime
              dateFormat="yy-mm-dd"
              hourFormat="24"
              placeholder="选择结束时间"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="field">
            <label htmlFor="sort_order" className="block font-medium mb-2">排序方式</label>
            <Dropdown
              id="sort_order"
              name="sort_order"
              value={formData.sort_order}
              onChange={handleChange}
              options={sortOptions}
              className="w-full"
            />
          </div>
          
          <div className="field">
            <label htmlFor="type" className="block font-medium mb-2">排行榜类型</label>
            <Dropdown
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              options={typeOptions}
              className="w-full"
            />
          </div>
          
          <div className="field">
            <label htmlFor="remarks" className="block font-medium mb-2">备注</label>
            <InputText
              id="remarks"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full"
              placeholder="备注信息"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="button" 
            label="重置" 
            severity="secondary" 
            outlined
            onClick={() => setFormData({
              title: '',
              description: '',
              start_at: null,
              end_at: null,
              rank_by_field: '',
              sort_order: 'desc',
              type: 'score',
              remarks: ''
            })}
          />
          <Button 
            type="submit" 
            label="创建排行榜" 
            icon="pi pi-plus"
            loading={submitting}
          />
        </div>
      </form>
    </Card>
  );
}