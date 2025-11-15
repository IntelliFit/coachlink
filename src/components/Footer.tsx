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
        { label: "隐私策略", href: "#" },
        { label: "服务条款", href: "#" },
        { label: "联系我们",  href: "#" },
    ],
}) => {
    return (
        <footer className="py-6 bg-surface border-t border-surface-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center">
                    <div className="mb-4 md:mb-0">
                        <p className="text-surface-600 text-sm">
                            &copy; {new Date().getFullYear()} {companyName}. All rights reserved.
                        </p>
                    </div>
                    <div className="flex space-x-6">
                        {links.map((item, index) => (
                            <a
                                key={index}
                                href={item.href}
                                className="text-surface-600 hover:text-primary-500 dark:hover:text-primary-400 text-sm transition-colors duration-200"
                            >
                                {item.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
