'use client';

import React from 'react';

interface BodyMapModeSwitchProps {
  mode: 'screening' | 'training';
  onChange: (mode: 'screening' | 'training') => void;
}

export default function BodyMapModeSwitch({ mode, onChange }: BodyMapModeSwitchProps) {
  return (
    <div className="flex bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
      <button
        type="button"
        onClick={() => onChange('screening')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          mode === 'screening'
            ? 'bg-surface-900 text-surface-0 shadow-md'
            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
        }`}
      >
        筛查模式
      </button>
      <button
        type="button"
        onClick={() => onChange('training')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          mode === 'training'
            ? 'bg-surface-900 text-surface-0 shadow-md'
            : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
        }`}
      >
        训练模式
      </button>
    </div>
  );
}
