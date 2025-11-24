import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { CoachActionRow } from '@/types';
import ActionSetList from './ActionSetList';

interface PlanDay {
  dayIndex: number;
  type: 'training' | 'rest';
  note: string;
  actionSets: ActionSet[];
}

interface ActionSet {
  actionId: string;
  setName: string;
  sets: number;
  reps: number;
  intensity: string;
  restSeconds: number;
}

interface PlanDayCardProps {
  day: PlanDay;
  dayIndex: number;
  actions: CoachActionRow[];
  onDayTypeChange: (index: number, type: 'training' | 'rest') => void;
  onRemoveDay: (index: number) => void;
  onNoteChange: (dayIndex: number, note: string) => void;
  onAddActionSet: (dayIndex: number) => void;
  onRemoveActionSet: (dayIndex: number, setIndex: number) => void;
  onActionSetChange: (
    dayIndex: number,
    setIndex: number,
    field: keyof ActionSet,
    value: string | number
  ) => void;
  saving: boolean;
  totalDays: number;
}

const PlanDayCard: React.FC<PlanDayCardProps> = ({
  day,
  dayIndex,
  actions,
  onDayTypeChange,
  onRemoveDay,
  onNoteChange,
  onAddActionSet,
  onRemoveActionSet,
  onActionSetChange,
  saving,
  totalDays
}) => {
  return (
    <Card className="border-primary-100 border-2">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-900">第 {day.dayIndex} 天</h3>
          <div className="flex gap-2">
            <Button
              label="训练日"
              className={`p-button-outlined ${day.type === 'training' ? '' : 'p-button-secondary'}`}
              onClick={() => onDayTypeChange(dayIndex, 'training')}
              disabled={saving}
            />
            <Button
              label="休息日"
              className={`p-button-outlined ${day.type === 'rest' ? '' : 'p-button-secondary'}`}
              onClick={() => onDayTypeChange(dayIndex, 'rest')}
              disabled={saving}
            />
          </div>
        </div>
        
        <Button
          icon="pi pi-trash"
          className="p-button-rounded p-button-text p-button-danger"
          onClick={() => onRemoveDay(dayIndex)}
          disabled={totalDays <= 1 || saving}
          tooltip="删除训练日"
        />
      </div>
      
      {day.type === 'training' ? (
        <>
          <div className="mb-4">
            <label className="block text-900 font-medium mb-2">备注</label>
            <InputText
              value={day.note}
              onChange={(e) => onNoteChange(dayIndex, e.target.value)}
              placeholder="训练日备注（可选）"
              className="w-full"
              disabled={saving}
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-900">动作组</h4>
              <Button 
                label="添加动作" 
                icon="pi pi-plus" 
                onClick={() => onAddActionSet(dayIndex)}
                disabled={saving}
                className="p-button-outlined"
              />
            </div>
            
            <ActionSetList
              actionSets={day.actionSets}
              actions={actions}
              dayIndex={dayIndex}
              onRemoveActionSet={onRemoveActionSet}
              onActionSetChange={onActionSetChange}
              saving={saving}
            />
          </div>
        </>
      ) : (
        <div className="py-4 text-center">
          <i className="pi pi-calendar-times text-600 text-2xl mb-2"></i>
          <p className="text-600">休息日 - 无需安排训练内容</p>
        </div>
      )}
    </Card>
  );
};

export default PlanDayCard;