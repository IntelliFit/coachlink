'use client';

import React from 'react';

interface FooterLink {
    label: string;
    href: string;
}

interface FooterProps {
    companyName?: string;
    links?: FooterLink[];
}

const Footer: React.FC<FooterProps> = ({
    companyName = "北京智健启能",
    links = [
        { label: "服务商品", href: "/market" },
        { label: "技术文章", href: "/articles" },
        { label: "入驻流程", href: "/onboarding" },
        { label: "关于我们", href: "/about" },
        { label: "联系我们", href: "/contact" },
        { label: "用户服务协议", href: "/terms" },
        { label: "消费者权益保护", href: "/protection-of-consumer" },
        { label: "平台入驻协议", href: "/platform-agreement" },
        { label: "免责声明", href: "/disclaimer" },
    ],
}) => {
    return (
        <footer className="bg-surface-0 border-t border-surface-100 py-10 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-10">
            <div className="max-w-6xl mx-auto px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    
                    {/* 左侧：版权信息 */}
                    <div className="flex flex-col items-center md:items-start gap-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                            <span className="text-sm font-black text-surface-900 tracking-tight uppercase">
                                {companyName}
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mt-1">
                            &copy; 2025-{new Date().getFullYear()} 保留所有权利
                        </p>
                        {/** 备案号，不允许删除或修改 */}
                        <a 
                            href="https://beian.miit.gov.cn/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-surface-400 hover:text-primary-500 transition-colors mt-1"
                        >
                            京ICP备2025141637号-1
                        </a>
                    </div>

                    {/* 右侧：功能链接 */}
                    <nav className="flex flex-wrap items-center justify-center md:justify-end gap-x-8 gap-y-3">
                        {links.map((item, index) => (
                            <a
                                key={index}
                                href={item.href}
                                className="text-xs font-black text-surface-500 hover:text-primary-500 transition-all duration-300 relative group tracking-widest"
                            >
                                {item.label}
                                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary-500 transition-all duration-300 group-hover:w-full"></span>
                            </a>
                        ))}
                    </nav>

                </div>
                
                {/* 底部装饰线 (可选) */}
                <div className="mt-8 flex justify-center">
                    <div className="w-12 h-[1px] bg-surface-100"></div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;