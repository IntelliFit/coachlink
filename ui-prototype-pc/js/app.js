// Main Application Logic

const App = {
    init: () => {
        App.ensureRoleAccess();
        App.renderSidebar();
        App.renderHeader();
        App.highlightCurrentNav();
    },

    renderSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const path = window.location.pathname;
        const user = MockData.currentUser;
        const activeRole = user.role;
        const isAdmin = path.includes('/admin/') || activeRole === 'admin';
        const isCoach = !isAdmin && activeRole === 'coach';
        
        let menuItems = [];
        const messageLink = isAdmin ? '#' : 'chat.html';

        if (isAdmin) {
            menuItems = [
                { name: '成绩审核', icon: 'ClipboardCheck', link: 'review.html' },
                { name: '教练申请审核', icon: 'UserCheck', link: 'coach-applications.html' }
            ];
        } else if (isCoach) {
            menuItems = [
                { name: '概览', icon: 'LayoutDashboard', link: 'dashboard.html' },
                { name: '动作库', icon: 'Dumbbell', link: 'library.html' },
                { name: '模板库', icon: 'FileText', link: 'templates.html' },
                { name: '学员管理', icon: 'Users', link: 'clients.html' },
                { name: '教学内容', icon: 'BookOpen', link: 'content.html' }
            ];
        } else {
            // 学员端导航 - 移除教练申请和教练端入口，这些放到头像菜单
            menuItems = [
                { name: '我的训练', icon: 'Calendar', link: 'dashboard.html' },
                { name: '训练计划', icon: 'FileText', link: 'plan.html' },
                { name: '排行榜', icon: 'Trophy', link: 'leaderboard.html' },
                { name: '发现教练', icon: 'Search', link: 'discover-coaches.html' },
                { name: '个人档案', icon: 'User', link: 'profile.html' }
            ];
        }


        const canSwitchToCoach = (user.roles || []).includes('coach') && user.role !== 'coach';
        const canSwitchToStudent = (user.roles || []).includes('student') && user.role !== 'student';

        const navHtml = menuItems.map(item => {
            return `
                <a href="${item.link}" class="nav-item">
                    <i data-lucide="${item.icon}" class="nav-icon"></i>
                    <span>${item.name}</span>
                </a>
            `;
        }).join('');

        // 获取教练申请状态（仅学员端需要）
        const hasCoachRole = (user.roles || []).includes('coach');
        let coachApplicationStatus = null;
        if (user.role === 'student' && !hasCoachRole && typeof CoachApplicationService !== 'undefined') {
            const app = CoachApplicationService.getByUserId(user.id);
            coachApplicationStatus = app?.status || null;
        }
        
        // 生成教练申请菜单项（学员端）
        const getCoachApplicationMenuItem = () => {
            if (user.role !== 'student') return '';
            if (hasCoachRole) return ''; // 已有教练角色，不显示申请入口
            
            let label = '教练申请';
            let badge = '';
            if (coachApplicationStatus === 'pending') {
                label = '教练申请';
                badge = '<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">审核中</span>';
            } else if (coachApplicationStatus === 'rejected') {
                badge = '<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">未通过</span>';
            }
            
            return `
                <a href="coach-application.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                    <i data-lucide="Award" size="16"></i><span>${label}</span>${badge}
                </a>
            `;
        };

        sidebar.innerHTML = `
            <div class="sidebar-header" style="width:100%; justify-content: space-between;">
                <div style="display:flex; align-items:center; gap: var(--spacing-xl);">
                    <div class="logo">
                        <i data-lucide="Activity"></i>
                        CoachLink
                    </div>
                    <nav class="sidebar-nav">
                        ${navHtml}
                    </nav>
                </div>
                <div style="display:flex; align-items:center; gap: var(--spacing-md);">
                    <div class="user-profile" id="user-profile-trigger-nav" style="position: relative; cursor: pointer;">
                        <div class="text-right mr-2">
                            <div class="text-sm font-medium">${user.name}</div>
                            <div class="text-xs text-secondary">${user.role === 'admin' ? '管理员' : (user.role === 'coach' ? '专业教练' : '学员')}</div>
                        </div>
                        <div class="avatar">${user.avatar}</div>
                        <div id="user-menu-nav" style="display:none; position: absolute; right: 0; top: 100%; margin-top: 8px; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); min-width: 200px; z-index: 100;">
                            ${(user.role === 'coach' || user.role === 'student') ? `
                                <a href="${messageLink}" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="MessageSquare" size="16"></i><span>消息中心</span>
                                </a>
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                            ` : ''}
                            ${user.role === 'coach' ? `
                                <a href="my-homepage.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="Home" size="16"></i><span>我的主页</span>
                                </a>
                                <a href="pricing.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="DollarSign" size="16"></i><span>服务与定价</span>
                                </a>
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                            ` : ''}
                            ${user.role === 'student' ? `
                                <a href="subscription.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="CreditCard" size="16"></i><span>我的订阅</span>
                                </a>
                                ${getCoachApplicationMenuItem()}
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                            ` : ''}
                                ${canSwitchToCoach ? `
                                <button class="nav-item" data-role-switch="coach" style="display:flex; align-items:center; gap:8px; padding:10px 16px; background:none; border:none; width:100%; text-align:left; color: var(--primary-color); font-weight: 500;">
                                    <i data-lucide="Briefcase" size="16"></i><span>进入教练端</span>
                                    </button>
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                                ` : ''}
                                ${canSwitchToStudent ? `
                                <button class="nav-item" data-role-switch="student" style="display:flex; align-items:center; gap:8px; padding:10px 16px; background:none; border:none; width:100%; text-align:left; color: var(--primary-color); font-weight: 500;">
                                    <i data-lucide="GraduationCap" size="16"></i><span>进入学员端</span>
                                    </button>
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                            ` : ''}
                            <a href="../index.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; color: var(--danger-color);">
                                <i data-lucide="LogOut" size="16"></i><span>退出登录</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize Lucide icons
        lucide.createIcons();

        // Bind avatar dropdown in top navbar
        const triggerNav = sidebar.querySelector('#user-profile-trigger-nav');
        const menuNav = sidebar.querySelector('#user-menu-nav');
        if (triggerNav && menuNav) {
            triggerNav.addEventListener('click', (e) => {
                e.stopPropagation();
                menuNav.style.display = menuNav.style.display === 'none' ? 'block' : 'none';
                lucide.createIcons();
            });
            document.addEventListener('click', () => {
                if (menuNav.style.display !== 'none') menuNav.style.display = 'none';
            });
        }
        App.bindRoleSwitchers(sidebar);
    },

    renderHeader: () => {
        const header = document.getElementById('header');
        if (!header) return;

        const user = MockData.currentUser;
        const canSwitchToCoach = (user.roles || []).includes('coach') && user.role !== 'coach';
        const canSwitchToStudent = (user.roles || []).includes('student') && user.role !== 'student';
        const hasCoachRole = (user.roles || []).includes('coach');

        const messageLink = user.role === 'student' || user.role === 'coach' ? 'chat.html' : '#';
        
        // 获取教练申请状态（仅学员端需要）
        let coachApplicationStatus = null;
        if (user.role === 'student' && !hasCoachRole && typeof CoachApplicationService !== 'undefined') {
            const app = CoachApplicationService.getByUserId(user.id);
            coachApplicationStatus = app?.status || null;
        }
        
        // 生成教练申请菜单项（学员端）
        const getCoachApplicationMenuItem = () => {
            if (user.role !== 'student') return '';
            if (hasCoachRole) return ''; // 已有教练角色，不显示申请入口
            
            let label = '教练申请';
            let badge = '';
            if (coachApplicationStatus === 'pending') {
                badge = '<span style="background:#fef3c7;color:#92400e;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">审核中</span>';
            } else if (coachApplicationStatus === 'rejected') {
                badge = '<span style="background:#fee2e2;color:#b91c1c;font-size:10px;padding:2px 6px;border-radius:10px;margin-left:6px;">未通过</span>';
            }
            
            return `
                <a href="coach-application.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s;">
                    <i data-lucide="Award" size="16"></i><span>${label}</span>${badge}
                </a>
            `;
        };

        header.innerHTML = `
            <h2 class="text-lg font-semibold" id="page-title">页面标题</h2>
            <div class="flex items-center gap-lg">
                <a href="${messageLink}" class="relative p-2 text-secondary hover:text-primary transition-colors" title="消息中心">
                    <i data-lucide="Bell"></i>
                    <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </a>
                <div class="user-profile" id="user-profile-trigger" style="position: relative; cursor: pointer;">
                    <div class="text-right mr-2">
                        <div class="text-sm font-medium">${user.name}</div>
                        <div class="text-xs text-secondary">${user.role === 'admin' ? '管理员' : (user.role === 'coach' ? '专业教练' : '学员')}</div>
                    </div>
                    <div class="avatar">${user.avatar}</div>
                    <div id="user-menu" style="display:none; position: absolute; right: 0; top: 100%; margin-top: 8px; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); min-width: 200px; z-index: 100;">
                        ${(user.role === 'coach' || user.role === 'student') ? `
                            <a href="${messageLink}" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s;">
                                <i data-lucide="MessageSquare" size="16"></i><span>消息中心</span>
                            </a>
                            <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                        ` : ''}
                        ${user.role === 'coach' ? `
                            <a href="my-homepage.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s;">
                                <i data-lucide="Home" size="16"></i><span>我的主页</span>
                            </a>
                            <a href="pricing.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s;">
                                <i data-lucide="DollarSign" size="16"></i><span>服务与定价</span>
                            </a>
                            <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                        ` : ''}
                        ${user.role === 'student' ? `
                            <a href="subscription.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s;">
                                <i data-lucide="CreditCard" size="16"></i><span>我的订阅</span>
                            </a>
                            ${getCoachApplicationMenuItem()}
                            <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                        ` : ''}
                        ${canSwitchToCoach ? `
                            <button class="nav-item" data-role-switch="coach" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s; background:none; border:none; width:100%; text-align:left; color: var(--primary-color); font-weight: 500;">
                                <i data-lucide="Briefcase" size="16"></i><span>进入教练端</span>
                            </button>
                            <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                        ` : ''}
                        ${canSwitchToStudent ? `
                            <button class="nav-item" data-role-switch="student" style="display:flex; align-items:center; gap:8px; padding:10px 16px; transition: background 0.2s; background:none; border:none; width:100%; text-align:left; color: var(--primary-color); font-weight: 500;">
                                <i data-lucide="GraduationCap" size="16"></i><span>进入学员端</span>
                            </button>
                            <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                        ` : ''}
                        <a href="../index.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px; color: var(--danger-color); transition: background 0.2s;">
                            <i data-lucide="LogOut" size="16"></i><span>退出登录</span>
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Bind dropdown interactions
        const trigger = header.querySelector('#user-profile-trigger');
        const menu = header.querySelector('#user-menu');
        if (trigger && menu) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                lucide.createIcons();
            });
            document.addEventListener('click', () => {
                if (menu.style.display !== 'none') menu.style.display = 'none';
            });
        }
        App.bindRoleSwitchers(header);
    },

    highlightCurrentNav: () => {
        const currentPath = window.location.pathname.split('/').pop();
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            if (item.getAttribute('href') === currentPath) {
                item.classList.add('active');
                // Update page title based on active nav
                const titleEl = document.getElementById('page-title');
                if (titleEl) titleEl.textContent = item.querySelector('span').textContent;
            }
        });
    },

    ensureRoleAccess: () => {
        if (typeof UserService === 'undefined') return;
        const path = window.location.pathname;
        
        // 管理员页面不做角色校验
        if (path.includes('/admin/')) return;

        const requiredRole = path.includes('/coach/')
            ? 'coach'
            : path.includes('/student/')
            ? 'student'
            : null;

        if (!requiredRole) return;

        const user = UserService.getCurrentUser();
        const roles = user?.roles || [];
        const activeRole = UserService.getActiveRole();

        // 如果用户拥有所需角色，直接更新 activeRole 并放行
        if (roles.includes(requiredRole)) {
            if (activeRole !== requiredRole) {
                UserService.updateSession({ activeRole: requiredRole });
            }
            return; // 纯教练账号访问教练端，直接放行，不会触发申请流程
        }

        // 用户没有所需角色时的处理
        if (requiredRole === 'coach') {
            // 学员账号（没有 coach 角色）试图访问教练端
            // 重定向到学员端的教练申请页面
            const application = typeof CoachApplicationService !== 'undefined' 
                ? CoachApplicationService.getByUserId(user?.id) 
                : null;
            let message = '您还不是教练，请先提交申请。';
            if (application) {
                if (application.status === 'pending') {
                    message = '您的教练申请目前处于审核中，请耐心等待。';
                } else if (application.status === 'rejected') {
                    message = application.rejectionReason
                        ? `申请被拒绝：${application.rejectionReason}`
                        : '您的教练申请未通过，请根据反馈修改后重新提交。';
                }
            }
            alert(message);
            window.location.href = '../student/coach-application.html';
        } else if (requiredRole === 'student') {
            // 纯教练账号试图访问学员端，重定向到教练端
            alert('当前账号是纯教练账号，无法访问学员端。');
            window.location.href = '../coach/dashboard.html';
        } else {
            alert('当前账号无权访问该页面');
            window.location.href = '../index.html';
        }
    },

    bindRoleSwitchers: (root) => {
        if (!root || typeof RoleManager === 'undefined') return;
        root.querySelectorAll('[data-role-switch]').forEach(btn => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const role = btn.getAttribute('data-role-switch');
                RoleManager.switchRole(role);
            });
        });
    }
};

// Helper for icons since we don't have a bundler
// We will load lucide from CDN in the HTML files
