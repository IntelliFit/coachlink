// Main Application Logic

const App = {
    init: () => {
        App.renderSidebar();
        App.renderHeader();
        App.highlightCurrentNav();
    },

    renderSidebar: () => {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        // Determine if we are in coach or student view based on URL or simple check
        const isCoach = window.location.pathname.includes('/coach/');
        const isAdmin = window.location.pathname.includes('/admin/');
        const user = MockData.currentUser;
        
        let menuItems = [];
        const messageLink = isCoach ? 'chat.html' : (isAdmin ? '#' : 'chat.html');

        if (isAdmin) {
            menuItems = [
                { name: '成绩审核', icon: 'ClipboardCheck', link: 'review.html' },
                // Add more admin links here if needed
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
            menuItems = [
                { name: '我的训练', icon: 'Calendar', link: 'dashboard.html' },
                { name: '训练计划', icon: 'FileText', link: 'plan.html' },
                { name: '排行榜', icon: 'Trophy', link: 'leaderboard.html' },
                { name: '发现教练', icon: 'Search', link: 'discover-coaches.html' },
                { name: '个人档案', icon: 'User', link: 'profile.html' },
            ];
        }


        const navHtml = menuItems.map(item => `
            <a href="${item.link}" class="nav-item">
                <i data-lucide="${item.icon}" class="nav-icon"></i>
                <span>${item.name}</span>
            </a>
        `).join('');

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
                                <a href="../coach/my-homepage.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="Home" size="16"></i><span>我的主页</span>
                                </a>
                                <a href="../coach/pricing.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="DollarSign" size="16"></i><span>服务与定价</span>
                                </a>
                                <div style="height:1px; background: var(--color-border); margin: 4px 0;"></div>
                            ` : ''}
                            ${user.role === 'student' ? `
                                <a href="subscription.html" class="nav-item" style="display:flex; align-items:center; gap:8px; padding:10px 16px;">
                                    <i data-lucide="CreditCard" size="16"></i><span>我的订阅</span>
                                </a>
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
    },

    renderHeader: () => {
        const header = document.getElementById('header');
        if (!header) return;

        const user = MockData.currentUser; // In real app, get from auth

        const messageLink = user.role === 'student' || user.role === 'coach' ? 'chat.html' : '#';

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
                    <div id="user-menu" style="display:none; position: absolute; right: 0; top: 100%; margin-top: 8px; background: #fff; border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); min-width: 180px; z-index: 100;">
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
    }
};

// Helper for icons since we don't have a bundler
// We will load lucide from CDN in the HTML files
