import React from 'react';

const KnowledgeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900">
      {children}
    </div>
  );
};

export default KnowledgeLayout;
