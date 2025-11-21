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
            <div class="sidebar-header">
                <div class="logo">
                    <i data-lucide="Activity"></i>
                    CoachLink
                </div>
                <nav class="sidebar-nav">
                    ${navHtml}
                </nav>
            </div>
            <div style="display: flex; align-items: center; gap: var(--spacing-md);">
                <div class="user-profile">
                    <div class="text-right mr-2">
                        <div class="text-sm font-medium">${user.name}</div>
                        <div class="text-xs text-secondary">${user.role === 'admin' ? '管理员' : (user.role === 'coach' ? '专业教练' : '学员')}</div>
                    </div>
                    <div class="avatar">${user.avatar}</div>
                </div>
                <a href="../index.html" class="nav-item text-danger">
                    <i data-lucide="LogOut" class="nav-icon"></i>
                    <span>退出</span>
                </a>
            </div>
        `;
        
        // Initialize Lucide icons
        lucide.createIcons();
    },

    renderHeader: () => {
        const header = document.getElementById('header');
        if (!header) return;

        const user = MockData.currentUser; // In real app, get from auth

        header.innerHTML = `
            <h2 class="text-lg font-semibold" id="page-title">页面标题</h2>
            <div class="user-profile">
                <div class="text-right mr-2">
                    <div class="text-sm font-medium">${user.name}</div>
                    <div class="text-xs text-secondary">${user.role === 'admin' ? '管理员' : (user.role === 'coach' ? '专业教练' : '学员')}</div>
                </div>
                <div class="avatar">${user.avatar}</div>
            </div>
        `;
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
