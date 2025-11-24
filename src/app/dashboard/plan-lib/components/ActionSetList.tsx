import React from 'react';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { CoachActionRow } from '@/types';

interface ActionSet {
  actionId: string;
  setName: string;
  sets: number;
  reps: number;
  intensity: string;
  restSeconds: number;
}

interface ActionSetListProps {
  actionSets: ActionSet[];
  actions: CoachActionRow[];
  dayIndex: number;
  onRemoveActionSet: (dayIndex: number, setIndex: number) => void;
  onActionSetChange: (
    dayIndex: number,
    setIndex: number,
    field: keyof ActionSet,
    value: string | number
  ) => void;
  saving: boolean;
}

const ActionSetList: React.FC<ActionSetListProps> = ({
  actionSets,
  actions,
  dayIndex,
  onRemoveActionSet,
  onActionSetChange,
  saving
}) => {
  if (actionSets.length === 0) {
    return (
      <div className="text-center py-4 bg-surface-100 rounded-border">
        <p className="text-600">该训练日暂无动作</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actionSets.map((set, setIndex) => (
        <div key={setIndex} className="p-3 border-round border-1 surface-border">
          <div className="flex justify-between items-start mb-3">
            <h5 className="font-medium text-900">动作 #{setIndex + 1}</h5>
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-text p-button-danger"
              onClick={() => onRemoveActionSet(dayIndex, setIndex)}
              disabled={saving}
              tooltip="删除动作"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-900 text-sm mb-1">动作 *</label>
              <Dropdown
                value={set.actionId}
                options={actions.map(action => ({
                  label: action.name,
                  value: action.id
                }))}
                onChange={(e) => onActionSetChange(dayIndex, setIndex, 'actionId', e.value)}
                placeholder="选择动作"
                filter
                className="w-full"
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="block text-900 text-sm mb-1">组数</label>
              <InputText
                value={set.sets.toString()}
                type="number"
                min="1"
                onChange={(e) => onActionSetChange(dayIndex, setIndex, 'sets', parseInt(e.target.value) || 0)}
                className="w-full"
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="block text-900 text-sm mb-1">次数</label>
              <InputText
                value={set.reps.toString()}
                type="number"
                min="1"
                onChange={(e) => onActionSetChange(dayIndex, setIndex, 'reps', parseInt(e.target.value) || 0)}
                className="w-full"
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="block text-900 text-sm mb-1">强度</label>
              <InputText
                value={set.intensity}
                onChange={(e) => onActionSetChange(dayIndex, setIndex, 'intensity', e.target.value)}
                placeholder="例如: RPE8, 20kg"
                className="w-full"
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="block text-900 text-sm mb-1">组间休息(秒)</label>
              <InputText
                value={set.restSeconds.toString()}
                type="number"
                min="0"
                onChange={(e) => onActionSetChange(dayIndex, setIndex, 'restSeconds', parseInt(e.target.value) || 0)}
                className="w-full"
                disabled={saving}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActionSetList;