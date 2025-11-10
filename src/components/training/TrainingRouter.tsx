import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import TrainingHub from './TrainingHub';

interface TrainingRouterProps {
  userId?: string;
}

const TrainingWrapper: React.FC = () => {
  const { trainingPlanId } = useParams<{ trainingPlanId: string }>();
  const userId = localStorage.getItem('current_user_id') || '';

  if (!trainingPlanId) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">未找到训练计划</h2>
        <p className="text-gray-600">请先生成一个训练计划</p>
      </div>
    );
  }

  return <TrainingHub userId={userId} trainingPlanId={trainingPlanId} />;
};

const TrainingRouter: React.FC<TrainingRouterProps> = ({ userId }) => {
  return (
    <Router>
      <Routes>
        <Route path="/training/:trainingPlanId" element={<TrainingWrapper />} />
      </Routes>
    </Router>
  );
};

export default TrainingRouter;