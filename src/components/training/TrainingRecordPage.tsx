import React, { useState, useEffect } from 'react';
import { Plus, Trophy, Calendar, BarChart3, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { EXERCISE_TYPES, TrainingRecord, PersonalBest, RecordType } from '../types/training';

interface TrainingRecordPageProps {
  userId: string;
  userName: string;
}

const TrainingRecordPage: React.FC<TrainingRecordPageProps> = ({ userId, userName }) => {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'add' | 'history'>('overview');

  // 新增记录表单
  const [newRecord, setNewRecord] = useState({
    exerciseId: '',
    recordType: 'reps' as RecordType,
    value: '',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  // 从本地存储加载数据
  useEffect(() => {
    loadRecords();
  }, [userId]);

  const loadRecords = () => {
    const stored = localStorage.getItem(`training_records_${userId}`);
    if (stored) {
      const loadedRecords = JSON.parse(stored);
      setRecords(loadedRecords);
      calculatePersonalBests(loadedRecords);
    }
  };

  const saveRecords = (newRecords: TrainingRecord[]) => {
    localStorage.setItem(`training_records_${userId}`, JSON.stringify(newRecords));
    setRecords(newRecords);
    calculatePersonalBests(newRecords);
  };

  const calculatePersonalBests = (allRecords: TrainingRecord[]) => {
    const bests: PersonalBest[] = [];
    
    EXERCISE_TYPES.forEach(exercise => {
      exercise.recordTypes.forEach(recordType => {
        const exerciseRecords = allRecords.filter(r => 
          r.exerciseId === exercise.id && r.recordType === recordType.type
        );
        
        if (exerciseRecords.length > 0) {
          // 对于所有类型都取最大值（包括总容量）
          const bestRecord = exerciseRecords.reduce((best, current) => {
            return current.value > best.value ? current : best;
          });

          bests.push({
            exerciseId: exercise.id,
            recordType: recordType.type,
            bestValue: bestRecord.value,
            achievedAt: bestRecord.date,
            recordId: bestRecord.id
          });
        }
      });
    });

    setPersonalBests(bests);
  };

  const handleAddRecord = () => {
    if (!newRecord.exerciseId || !newRecord.recordType || !newRecord.value) {
      alert('请填写完整信息');
      return;
    }

    const record: TrainingRecord = {
      id: Date.now().toString(),
      userId,
      exerciseId: newRecord.exerciseId,
      recordType: newRecord.recordType,
      value: parseFloat(newRecord.value),
      date: newRecord.date,
      note: newRecord.note,
      createdAt: new Date().toISOString()
    };

    const updatedRecords = [...records, record];
    saveRecords(updatedRecords);

    // 重置表单
    setNewRecord({
      exerciseId: '',
      recordType: 'reps' as RecordType,
      value: '',
      date: new Date().toISOString().split('T')[0],
      note: ''
    });

    setSelectedTab('overview');
    alert('记录添加成功！');
  };

  const handleDeleteRecord = (recordId: string) => {
    if (confirm('确定要删除这条记录吗？')) {
      const updatedRecords = records.filter(r => r.id !== recordId);
      saveRecords(updatedRecords);
    }
  };

  const getExerciseById = (id: string) => {
    return EXERCISE_TYPES.find(e => e.id === id);
  };

  const getRecordTypeInfo = (exerciseId: string, recordType: RecordType) => {
    const exercise = getExerciseById(exerciseId);
    if (!exercise) return null;
    return exercise.recordTypes.find(rt => rt.type === recordType);
  };

  const formatValue = (value: number, unit: string) => {
    return `${value}${unit}`;
  };

  const getRecentRecords = () => {
    return records
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  };

  const getRecordsByExercise = (exerciseId: string) => {
    return records
      .filter(r => r.exerciseId === exerciseId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getAvailableRecordTypes = () => {
    const exercise = getExerciseById(newRecord.exerciseId);
    return exercise?.recordTypes || [];
  };

  return (
    <div className="space-y-6">
      {/* 标签导航 */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              训练概览
            </button>
            <button
              onClick={() => setSelectedTab('add')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'add'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              添加记录
            </button>
            <button
              onClick={() => setSelectedTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                selectedTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              历史记录
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* 训练概览 */}
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              {/* 个人最佳成绩 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Trophy className="w-5 h-5 text-yellow-500 mr-2" />
                  个人最佳成绩
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {EXERCISE_TYPES.map(exercise => (
                    <div key={exercise.id} className="space-y-2">
                      <h4 className="font-medium text-gray-800 flex items-center">
                        <span className="text-lg mr-2">{exercise.icon}</span>
                        {exercise.name}
                      </h4>
                      {exercise.recordTypes.map(recordType => {
                        const best = personalBests.find(b => 
                          b.exerciseId === exercise.id && b.recordType === recordType.type
                        );
                        return (
                          <div key={recordType.type} className="bg-gray-50 rounded-lg p-3">
                            <div className="text-sm text-gray-600 mb-1">{recordType.name}</div>
                            {best ? (
                              <div>
                                <div className="text-lg font-bold text-blue-600">
                                  {formatValue(best.bestValue, recordType.unit)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(best.achievedAt).toLocaleDateString()}
                                </div>
                              </div>
                            ) : (
                              <div className="text-gray-400 text-sm">暂无记录</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* 最近记录 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 text-green-500 mr-2" />
                  最近训练
                </h3>
                {getRecentRecords().length > 0 ? (
                  <div className="space-y-3">
                    {getRecentRecords().map(record => {
                      const exercise = getExerciseById(record.exerciseId);
                      const recordTypeInfo = getRecordTypeInfo(record.exerciseId, record.recordType);
                      if (!exercise || !recordTypeInfo) return null;
                      
                      return (
                        <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{exercise.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900">
                                {exercise.name} - {recordTypeInfo.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {new Date(record.date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-blue-600">
                            {formatValue(record.value, recordTypeInfo.unit)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">还没有训练记录</p>
                    <button
                      onClick={() => setSelectedTab('add')}
                      className="mt-2 text-blue-600 hover:text-blue-700"
                    >
                      立即添加
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 添加记录 */}
          {selectedTab === 'add' && (
            <div className="max-w-md mx-auto space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Plus className="w-5 h-5 text-blue-500 mr-2" />
                添加训练记录
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    训练项目
                  </label>
                  <select
                    value={newRecord.exerciseId}
                    onChange={(e) => setNewRecord(prev => ({ 
                      ...prev, 
                      exerciseId: e.target.value,
                      recordType: 'reps' as RecordType // 重置记录类型
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">选择训练项目</option>
                    {EXERCISE_TYPES.map(exercise => (
                      <option key={exercise.id} value={exercise.id}>
                        {exercise.icon} {exercise.name}
                      </option>
                    ))}
                  </select>
                </div>

                {newRecord.exerciseId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      记录类型
                    </label>
                    <select
                      value={newRecord.recordType}
                      onChange={(e) => setNewRecord(prev => ({ 
                        ...prev, 
                        recordType: e.target.value as RecordType
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {getAvailableRecordTypes().map(recordType => (
                        <option key={recordType.type} value={recordType.type}>
                          {recordType.name} ({recordType.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    成绩
                    {newRecord.exerciseId && newRecord.recordType && (
                      <span className="text-gray-500 ml-1">
                        ({getRecordTypeInfo(newRecord.exerciseId, newRecord.recordType)?.unit})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newRecord.value}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, value: e.target.value }))}
                    placeholder="输入成绩"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    训练日期
                  </label>
                  <input
                    type="date"
                    value={newRecord.date}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    备注（可选）
                  </label>
                  <textarea
                    value={newRecord.note}
                    onChange={(e) => setNewRecord(prev => ({ ...prev, note: e.target.value }))}
                    placeholder="训练感受、重量组数等..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleAddRecord}
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  添加记录
                </button>
              </div>
            </div>
          )}

          {/* 历史记录 */}
          {selectedTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BarChart3 className="w-5 h-5 text-green-500 mr-2" />
                历史记录
              </h3>

              {records.length > 0 ? (
                <div className="space-y-6">
                  {EXERCISE_TYPES.map(exercise => {
                    const exerciseRecords = getRecordsByExercise(exercise.id);
                    if (exerciseRecords.length === 0) return null;

                    return (
                      <div key={exercise.id} className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                          <span className="text-lg mr-2">{exercise.icon}</span>
                          {exercise.name}
                          <span className="ml-2 text-sm text-gray-500">
                            ({exerciseRecords.length} 次记录)
                          </span>
                        </h4>
                        
                        <div className="space-y-2">
                          {exerciseRecords.map(record => {
                            const recordTypeInfo = getRecordTypeInfo(record.exerciseId, record.recordType);
                            if (!recordTypeInfo) return null;
                            
                            return (
                              <div key={record.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {recordTypeInfo.name}: {formatValue(record.value, recordTypeInfo.unit)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {new Date(record.date).toLocaleDateString()}
                                    {record.note && ` • ${record.note}`}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteRecord(record.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">还没有训练记录</p>
                  <button
                    onClick={() => setSelectedTab('add')}
                    className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    添加第一条记录
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrainingRecordPage; 