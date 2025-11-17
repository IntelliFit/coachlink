'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';

const CoachReviewsPanel: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <MessageCircle className="w-16 h-16 text-surface-400 mx-auto mb-4" />
        <p className="text-surface-600 text-lg">学员评价功能正在开发中...</p>
      </div>
    </div>
  );
};

export default CoachReviewsPanel;