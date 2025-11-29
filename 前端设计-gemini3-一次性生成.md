import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dumbbell, 
  Users, 
  Calendar, 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  Star, 
  Video, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  User, 
  TrendingUp, 
  Paperclip,
  Send,
  Layout,
  LogOut,
  Award,
  Trophy
} from 'lucide-react';

// --- Mock Data & Initial State ---

const INITIAL_EXERCISES = [
  { id: 1, name: '杠铃卧推', type: 'absolute', category: '胸部', videoUrl: '#', details: '双脚踩实，肩胛骨收紧，杠铃触胸后推起。' },
  { id: 2, name: '负重引体向上', type: 'relative', category: '背部', videoUrl: '#', details: '下巴过杠，核心收紧。' },
  { id: 3, name: '深蹲', type: 'absolute', category: '腿部', videoUrl: '#', details: '膝盖与脚尖方向一致，下蹲至大腿平行地面。' },
];

const INITIAL_CLIENTS = [
  { id: 101, name: '张三', tier: '高级版', status: 'active', joinDate: '2023-09-01', avatar: 'ZS', bodyWeight: 75, benchmarks: { bench: 100, squat: 140, deadlift: 180 } },
  { id: 102, name: '李四', tier: 'AI版', status: 'active', joinDate: '2023-10-15', avatar: 'LS', bodyWeight: 65, benchmarks: { bench: 60, squat: 80, deadlift: 100 } },
  { id: 103, name: '王五', tier: 'AI版', status: 'active', joinDate: '2023-11-01', avatar: 'WW', bodyWeight: 80, benchmarks: { bench: 120, squat: 160, deadlift: 200 } },
  { id: 104, name: '赵六', tier: '高级版', status: 'active', joinDate: '2023-11-05', avatar: 'ZL', bodyWeight: 70, benchmarks: { bench: 90, squat: 130, deadlift: 170 } },
];

const INITIAL_TEMPLATES = [
  { 
    id: 1, 
    name: '新手力量基础 (3天/周)', 
    description: '适合训练年限<1年的新手，以三大项为主。',
    schedule: [
      { day: 'Day 1', exercises: [{ exId: 1, sets: 5, reps: 5, rpe: 8, rest: '180s' }, { exId: 3, sets: 5, reps: 5, rpe: 8, rest: '180s' }] },
      { day: 'Day 2', exercises: [] }, // Rest
      { day: 'Day 3', exercises: [{ exId: 2, sets: 4, reps: 8, rpe: 8, rest: '120s' }] },
    ]
  }
];

const INITIAL_CHAT = [
  { id: 1, sender: 'client', text: '教练，我感觉今天的深蹲腰有点不舒服。', time: '10:00' },
  { id: 2, sender: 'coach', text: '有没有视频？发来看看。', time: '10:05' },
];

const INITIAL_LOGS = [
  { id: 1, date: '2023-11-01', exerciseName: '杠铃卧推', weight: 95, reps: 5, isPr: true, note: '终于突破了！' },
  { id: 2, date: '2023-11-03', exerciseName: '深蹲', weight: 135, reps: 3, isPr: false, note: '' },
  { id: 3, date: '2023-11-05', exerciseName: '杠铃卧推', weight: 100, reps: 1, isPr: true, note: '单次极限测试' },
];

// --- Utility Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-100 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", size = 'md', icon: Icon }) => {
  const baseStyle = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500",
    ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    outline: "border-2 border-blue-600 text-blue-600 hover:bg-blue-50"
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}>
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
};

const Badge = ({ children, type = 'neutral' }) => {
  const styles = {
    neutral: "bg-slate-100 text-slate-600",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    premium: "bg-purple-100 text-purple-700",
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[type]}`}>{children}</span>;
};

// --- Main Application ---

export default function CoachClientSystem() {
  // Global State
  const [userRole, setUserRole] = useState('coach'); // 'coach' | 'client'
  const [currentView, setCurrentView] = useState('dashboard');
  
  // Data State
  const [exercises, setExercises] = useState(INITIAL_EXERCISES);
  const [templates, setTemplates] = useState(INITIAL_TEMPLATES);
  const [clients, setClients] = useState(INITIAL_CLIENTS);
  const [chatLogs, setChatLogs] = useState(INITIAL_CHAT);
  const [trainingLogs, setTrainingLogs] = useState(INITIAL_LOGS);

  // Role Toggle Helper (For Demo)
  const toggleRole = () => {
    const newRole = userRole === 'coach' ? 'client' : 'coach';
    setUserRole(newRole);
    setCurrentView(newRole === 'coach' ? 'dashboard' : 'my_plan');
  };

  // --- Render Views Based on State ---

  const renderContent = () => {
    if (userRole === 'coach') {
      switch (currentView) {
        case 'dashboard': return <CoachDashboard clients={clients} />;
        case 'assets': return <CoachAssets exercises={exercises} setExercises={setExercises} templates={templates} setTemplates={setTemplates} />;
        case 'clients': return <ClientList clients={clients} setCurrentView={setCurrentView} />;
        case 'chat': return <ChatSystem role="coach" messages={chatLogs} setMessages={setChatLogs} />;
        default: return <CoachDashboard clients={clients} />;
      }
    } else {
      // Client Views
      switch (currentView) {
        case 'my_plan': return <ClientExecutionView exercises={exercises} logs={trainingLogs} setLogs={setTrainingLogs} />;
        case 'profile': return <ClientProfile user={clients[0]} logs={trainingLogs} />;
        case 'chat': return <ChatSystem role="client" messages={chatLogs} setMessages={setChatLogs} trainingLogs={trainingLogs} />;
        case 'leaderboard': return <LeaderboardView clients={clients} />; // Added missing case
        default: return <ClientExecutionView exercises={exercises} logs={trainingLogs} setLogs={setTrainingLogs} />;
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col md:flex-row">
      {/* Mobile Navigation Toggle (Simplified) */}
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col md:h-screen sticky top-0 z-10">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <Dumbbell className="w-6 h-6" />
            <span>IronCoach AI</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            当前视角: <span className="font-bold text-slate-800">{userRole === 'coach' ? '教练端' : '学员端'}</span>
          </div>
          <button 
            onClick={toggleRole}
            className="mt-2 text-xs text-blue-500 underline hover:text-blue-700 cursor-pointer"
          >
            切换演示角色
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {userRole === 'coach' ? (
            <>
              <NavItem icon={Layout} label="仪表盘" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
              <NavItem icon={Users} label="我的学员" active={currentView === 'clients'} onClick={() => setCurrentView('clients')} />
              <NavItem icon={Dumbbell} label="教学资产库" active={currentView === 'assets'} onClick={() => setCurrentView('assets')} />
              <NavItem icon={MessageSquare} label="消息中心" active={currentView === 'chat'} onClick={() => setCurrentView('chat')} />
              <NavItem icon={Settings} label="服务与定价" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} />
            </>
          ) : (
            <>
              <NavItem icon={CheckCircle} label="今日训练" active={currentView === 'my_plan'} onClick={() => setCurrentView('my_plan')} />
              <NavItem icon={User} label="我的档案" active={currentView === 'profile'} onClick={() => setCurrentView('profile')} />
              <NavItem icon={MessageSquare} label="联系教练" active={currentView === 'chat'} onClick={() => setCurrentView('chat')} />
              <NavItem icon={Award} label="排行榜" active={currentView === 'leaderboard'} onClick={() => setCurrentView('leaderboard')} />
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm w-full px-4 py-2 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
      active 
        ? 'bg-blue-50 text-blue-700' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`}
  >
    <Icon className={`w-5 h-5 mr-3 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
    {label}
  </button>
);

// --- Feature Components ---

// 1. Coach Dashboard
const CoachDashboard = ({ clients }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">下午好，王教练 👋</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="活跃学员" value={clients.length} trend="+2 本周" icon={Users} color="blue" />
        <StatCard title="本月收入" value="¥12,450" trend="+15% 环比" icon={TrendingUp} color="emerald" />
        <StatCard title="待处理计划" value="3" trend="需要关注" icon={Calendar} color="amber" />
      </div>

      {/* Todo List (Feature 3.1) */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-4">待办事项</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-sm text-amber-900">学员 <strong>张三 (高级版)</strong> 的新周期计划需要制定</span>
            </div>
            <Button size="sm" variant="secondary">去处理</Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm text-slate-700">3位新学员的问卷已提交，系统已自动匹配模板</span>
            </div>
            <Button size="sm" variant="ghost">查看详情</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

const StatCard = ({ title, value, trend, icon: Icon, color }) => {
  const colors = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold mt-1 text-slate-900">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs font-medium text-slate-400 mt-3">{trend}</p>
    </Card>
  );
};

// 2. Coach Assets (Library & Templates)
const CoachAssets = ({ exercises, setExercises, templates, setTemplates }) => {
  const [activeTab, setActiveTab] = useState('exercises');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">教学资产库</h2>
        <Button icon={Plus}>{activeTab === 'exercises' ? '新建动作' : '新建模板'}</Button>
      </div>

      <div className="flex border-b border-slate-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'exercises' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          onClick={() => setActiveTab('exercises')}
        >
          动作库 ({exercises.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'templates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
          onClick={() => setActiveTab('templates')}
        >
          训练模板 ({templates.length})
        </button>
      </div>

      {activeTab === 'exercises' ? (
        <div className="grid gap-4">
          {exercises.map(ex => (
            <Card key={ex.id} className="p-4 flex items-center justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900">{ex.name}</h4>
                  <Badge>{ex.category}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-1 line-clamp-1">{ex.details}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" icon={Video}>演示</Button>
                <Button size="sm" variant="ghost" icon={Edit2}>编辑</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(tpl => (
            <Card key={tpl.id} className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">{tpl.name}</h4>
                  <p className="text-sm text-slate-500 mt-1">{tpl.description}</p>
                </div>
                <Button variant="outline" size="sm">应用模板</Button>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-2">
                {tpl.schedule.map((day, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="font-bold w-12 text-slate-700">{day.day}:</span>
                    <span className="text-slate-600">
                      {day.exercises.length > 0 
                        ? day.exercises.map(e => `${exercises.find(x => x.id === e.exId)?.name}`).join(', ') 
                        : '休息日'}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// 3. Client Execution View (The "Plan Experience")
const ClientExecutionView = ({ exercises, logs, setLogs }) => {
  // Mock Current Workout Data (derived from a template)
  const todayWorkout = [
    { id: 's1', exId: 1, targetWeight: 100, targetReps: 5, setType: 'warmup' },
    { id: 's2', exId: 1, targetWeight: 100, targetReps: 5, setType: 'working' },
    { id: 's3', exId: 1, targetWeight: 100, targetReps: 5, setType: 'working' },
    { id: 's4', exId: 3, targetWeight: 140, targetReps: 5, setType: 'working' },
  ];

  const [completedSets, setCompletedSets] = useState({});

  const handleComplete = (setId) => {
    setCompletedSets(prev => ({ ...prev, [setId]: true }));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Day 1 - 力量基础</h2>
          <p className="text-sm text-slate-500">第3周 / 共8周</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-blue-600">今日完成度</p>
          <div className="w-24 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${(Object.keys(completedSets).length / todayWorkout.length) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Group by Exercise Name manually for this demo */}
        <ExerciseGroup 
          name="杠铃卧推" 
          exerciseId={1} 
          sets={todayWorkout.filter(s => s.exId === 1)} 
          completedSets={completedSets}
          onComplete={handleComplete}
          exercises={exercises}
        />
        <ExerciseGroup 
          name="深蹲" 
          exerciseId={3} 
          sets={todayWorkout.filter(s => s.exId === 3)} 
          completedSets={completedSets}
          onComplete={handleComplete}
          exercises={exercises}
        />
      </div>
    </div>
  );
};

const ExerciseGroup = ({ name, exerciseId, sets, completedSets, onComplete, exercises }) => {
  const exerciseInfo = exercises.find(e => e.id === exerciseId);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900">{name}</h3>
          <button onClick={() => setShowInfo(!showInfo)} className="text-blue-600 hover:bg-blue-50 p-1 rounded">
            <Video className="w-4 h-4" />
          </button>
        </div>
        <button className="text-xs text-slate-500 underline">+ 添加一组</button>
      </div>
      
      {showInfo && (
        <div className="p-4 bg-blue-50 text-sm text-blue-800 border-b border-blue-100">
          <strong>动作要点：</strong> {exerciseInfo.details}
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {sets.map((set, idx) => (
          <SetRow 
            key={set.id} 
            set={set} 
            index={idx} 
            isCompleted={completedSets[set.id]} 
            onComplete={() => onComplete(set.id)} 
          />
        ))}
      </div>
    </Card>
  );
};

const SetRow = ({ set, index, isCompleted, onComplete }) => {
  const [weight, setWeight] = useState(set.targetWeight);
  const [reps, setReps] = useState(set.targetReps);
  const [rpe, setRpe] = useState('');
  const [isPr, setIsPr] = useState(false);

  if (isCompleted) {
    return (
      <div className="p-4 flex items-center justify-between bg-emerald-50/50">
        <div className="flex items-center gap-4">
          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs font-bold">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">{weight}kg x {reps}次</span>
            {isPr && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">🏆 新纪录</span>}
            <p className="text-xs text-slate-500">RPE: {rpe || '-'} • 视频已上传</p>
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onComplete}>修改</Button>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 min-w-[80px]">
        <span className="text-xs font-bold text-slate-400">SET {index + 1}</span>
        <span className="text-xs px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{set.setType === 'warmup' ? '热身' : '正式'}</span>
      </div>

      <div className="flex items-center gap-2 flex-1">
        <div className="flex flex-col">
           <label className="text-[10px] text-slate-400 uppercase">Kg</label>
           <input 
             type="number" 
             value={weight} 
             onChange={(e) => setWeight(e.target.value)}
             className="w-16 border border-slate-300 rounded px-2 py-1 text-sm font-bold text-center" 
           />
        </div>
        <span className="text-slate-300 text-lg">×</span>
        <div className="flex flex-col">
           <label className="text-[10px] text-slate-400 uppercase">Reps</label>
           <input 
             type="number" 
             value={reps} 
             onChange={(e) => setReps(e.target.value)}
             className="w-14 border border-slate-300 rounded px-2 py-1 text-sm font-bold text-center" 
           />
        </div>
        <div className="flex flex-col ml-2">
           <label className="text-[10px] text-slate-400 uppercase">RPE</label>
           <input 
             type="number" 
             placeholder="-" 
             value={rpe}
             onChange={(e) => setRpe(e.target.value)}
             className="w-12 border border-slate-300 rounded px-2 py-1 text-sm text-center" 
           />
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0">
         <button 
           onClick={() => setIsPr(!isPr)} 
           className={`p-2 rounded transition-colors ${isPr ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-400'}`}
           title="标记为进步组/PR"
         >
           <Star className={`w-5 h-5 ${isPr ? 'fill-current' : ''}`} />
         </button>
         <button className="p-2 text-slate-300 hover:text-blue-500">
           <Video className="w-5 h-5" />
         </button>
         <Button size="sm" onClick={onComplete}>完成</Button>
      </div>
    </div>
  );
};

// 4. Client Profile & Progress
const ClientProfile = ({ user, logs }) => {
  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 flex flex-col md:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
          {user.avatar}
        </div>
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
            <Badge type="premium">{user.tier}</Badge>
          </div>
          <p className="text-slate-500 mt-1">已坚持训练 45 天 • 体重 {user.bodyWeight}kg</p>
          <div className="flex gap-4 mt-4 justify-center md:justify-start">
            <div className="text-center">
              <p className="text-xs text-slate-400">卧推 1RM</p>
              <p className="font-bold text-slate-900">{user.benchmarks.bench}kg</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">深蹲 1RM</p>
              <p className="font-bold text-slate-900">{user.benchmarks.squat}kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Chart Mockup */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">进步趋势 (预估1RM)</h3>
          <select className="text-sm border-slate-200 rounded-md">
            <option>杠铃卧推</option>
            <option>深蹲</option>
          </select>
        </div>
        <div className="h-48 flex items-end justify-between gap-2 px-2">
          {[60, 65, 65, 70, 72, 75, 80, 85, 82, 90, 95, 100].map((val, i) => (
            <div key={i} className="w-full bg-blue-100 rounded-t hover:bg-blue-200 transition-colors relative group">
              <div 
                className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all" 
                style={{ height: `${val}%` }} 
              ></div>
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {val}kg
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2 px-2">
          <span>12周前</span>
          <span>今天</span>
        </div>
      </Card>

      {/* Timeline of PRs */}
      <div>
        <h3 className="font-bold text-lg mb-4">高光时刻 (Timeline)</h3>
        <div className="space-y-4">
          {logs.filter(l => l.isPr).map(log => (
            <div key={log.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 border-2 border-white shadow-sm z-10">
                  <Award className="w-4 h-4" />
                </div>
                <div className="w-0.5 h-full bg-slate-200 -mt-1"></div>
              </div>
              <Card className="flex-1 p-4 mb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-slate-400">{log.date}</p>
                    <h4 className="font-bold text-slate-900">{log.exerciseName} 新纪录!</h4>
                    <p className="text-lg font-bold text-blue-600 mt-1">{log.weight}kg x {log.reps}</p>
                  </div>
                  {log.note && (
                    <div className="bg-slate-50 p-2 rounded text-xs text-slate-600 italic max-w-[150px]">
                      "{log.note}"
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 5. Context-Aware Chat
const ChatSystem = ({ role, messages, setMessages, trainingLogs }) => {
  const [inputText, setInputText] = useState('');
  const [showContextPicker, setShowContextPicker] = useState(false);

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMsg = {
      id: Date.now(),
      sender: role,
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, newMsg]);
    setInputText('');
    
    // Simulate AI Reply for Coach
    if (role === 'client') {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'coach',
          text: '收到，我稍后看一下你的视频。',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }, 1000);
    }
  };

  const handleAttachLog = (log) => {
    const contextMsg = {
      id: Date.now(),
      sender: role,
      type: 'context',
      data: log,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages([...messages, contextMsg]);
    setShowContextPicker(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-900">
          {role === 'coach' ? '学员: 张三' : '王教练'}
        </h3>
        <Badge type={role === 'coach' ? 'premium' : 'success'}>
          {role === 'coach' ? '高级版' : '在线'}
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === role ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] ${msg.sender === role ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'} rounded-2xl px-4 py-2 shadow-sm`}>
              {msg.type === 'context' ? (
                <div className="bg-white/10 rounded p-2 mb-1 border border-white/20">
                  <div className="flex items-center gap-2 text-xs font-bold mb-1 opacity-90">
                    <Video className="w-3 h-3" />
                    训练记录引用
                  </div>
                  <p className="text-sm font-bold">{msg.data.exerciseName}</p>
                  <p className="text-xs opacity-80">{msg.data.date} • {msg.data.weight}kg x {msg.data.reps}</p>
                </div>
              ) : (
                <p className="text-sm">{msg.text}</p>
              )}
              <p className={`text-[10px] mt-1 text-right ${msg.sender === role ? 'text-blue-100' : 'text-slate-400'}`}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white border-t border-slate-200">
        {/* Context Picker */}
        {showContextPicker && trainingLogs && (
          <div className="absolute bottom-20 left-4 right-4 md:left-auto md:right-auto md:w-80 bg-white shadow-xl rounded-xl border border-slate-200 p-3 z-20 max-h-60 overflow-y-auto">
            <p className="text-xs font-bold text-slate-500 mb-2">选择一条记录发送:</p>
            <div className="space-y-2">
              {trainingLogs.map(log => (
                <button 
                  key={log.id} 
                  onClick={() => handleAttachLog(log)}
                  className="w-full text-left p-2 hover:bg-slate-50 rounded border border-slate-100 text-xs"
                >
                  <span className="font-bold text-slate-800">{log.exerciseName}</span>
                  <span className="ml-2 text-slate-500">{log.weight}kg x {log.reps}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button 
            onClick={() => setShowContextPicker(!showContextPicker)}
            className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
            title="引用训练记录"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..." 
            className="flex-1 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button 
            onClick={handleSend}
            className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ClientList = ({ clients, setCurrentView }) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-slate-900">学员管理</h2>
    <div className="grid gap-4">
      {clients.map(client => (
        <Card key={client.id} className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
              {client.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900">{client.name}</h3>
                <Badge type={client.tier === '高级版' ? 'premium' : 'neutral'}>{client.tier}</Badge>
              </div>
              <p className="text-sm text-slate-500">加入时间: {client.joinDate}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCurrentView('chat')}>发消息</Button>
            <Button size="sm" variant="outline">调整计划</Button>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

// --- Leaderboard View (New Feature) ---
const LeaderboardView = ({ clients }) => {
  const [filter, setFilter] = useState('bench'); // 'bench' | 'squat' | 'deadlift'

  const getTitle = () => {
    switch(filter) {
      case 'bench': return '卧推排行榜';
      case 'squat': return '深蹲排行榜';
      case 'deadlift': return '硬拉排行榜';
      default: return '排行榜';
    }
  };

  // Sort clients based on the selected filter
  const sortedClients = [...clients].sort((a, b) => b.benchmarks[filter] - a.benchmarks[filter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-500" />
          训练排行榜
        </h2>
        <div className="flex bg-white rounded-lg p-1 border border-slate-200">
          {['bench', 'squat', 'deadlift'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                filter === type ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {type === 'bench' ? '卧推' : type === 'squat' ? '深蹲' : '硬拉'}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-slate-50 p-4 border-b border-slate-100 grid grid-cols-12 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div className="col-span-2 text-center">排名</div>
          <div className="col-span-6">用户</div>
          <div className="col-span-4 text-right">成绩 (KG)</div>
        </div>
        <div className="divide-y divide-slate-100">
          {sortedClients.map((client, index) => (
            <div key={client.id} className="p-4 grid grid-cols-12 items-center hover:bg-slate-50 transition-colors">
              <div className="col-span-2 flex justify-center">
                {index < 3 ? (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                    index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-300' : 'bg-amber-600'
                  }`}>
                    {index + 1}
                  </div>
                ) : (
                  <span className="font-bold text-slate-400 text-lg">{index + 1}</span>
                )}
              </div>
              <div className="col-span-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm">
                  {client.avatar}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{client.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    {client.tier === '高级版' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>}
                    {client.tier}
                  </div>
                </div>
              </div>
              <div className="col-span-4 text-right font-mono font-bold text-lg text-blue-600">
                {client.benchmarks[filter]}
              </div>
            </div>
          ))}
          
          <div className="p-4 text-center text-sm text-slate-400 bg-slate-50/50 italic">
            更多用户正在赶来...
          </div>
        </div>
      </Card>
    </div>
  );
};