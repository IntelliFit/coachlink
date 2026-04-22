import React from 'react';

const KnowledgeLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
};

export default KnowledgeLayout;
