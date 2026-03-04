import React from 'react';

const KnowledgeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-surface-50">
      <div className="max-w-7xl mx-auto py-2 sm:px-4 lg:px-6">
        <div className="px-0 py-2 sm:px-0">
          <div className="h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeLayout;
