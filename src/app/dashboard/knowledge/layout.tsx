import React from 'react';

const KnowledgeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeLayout;
