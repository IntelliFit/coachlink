import React, { useRef } from 'react';
import { Button } from 'primereact/button';
import { Menu } from 'primereact/menu';
import { ItemType } from '@/types';

interface PolymorphicItemMenuProps {
    onAdd: (type: ItemType) => void;
    disabled?: boolean;
}

export const PolymorphicItemMenu: React.FC<PolymorphicItemMenuProps> = ({ onAdd, disabled }) => {
    const menu = useRef<Menu>(null);

    const items = [
        {
            label: '力量训练',
            icon: 'pi pi-bolt',
            command: () => onAdd('STRENGTH')
        },
        {
            label: '有氧运动',
            icon: 'pi pi-heart',
            command: () => onAdd('CARDIO')
        },
        {
            label: '饮食建议',
            icon: 'pi pi-apple',
            command: () => onAdd('DIET')
        },
        {
            label: '习惯打卡',
            icon: 'pi pi-check-circle',
            command: () => onAdd('HABIT')
        }
    ];

    return (
        <>
            <Menu
                model={items}
                popup
                ref={menu}
                id="add_item_menu"
                // 这里的 pt 属性可以让你直接注入 Tailwind 来优化 PrimeReact 原生菜单
                pt={{
                    root: { className: 'border-none shadow-xl rounded-[20px] p-2 bg-surface/90 backdrop-blur-md' },
                    menuitem: { className: 'rounded-[12px] overflow-hidden mb-1' },
                    action: { className: 'hover:bg-surface-50 p-3 transition-all' },
                    label: { className: 'text-[13px] font-bold text-surface-700 tracking-tight' },
                    icon: { className: 'text-primary-500 mr-3 text-sm' }
                }}
            />

            <button
                onClick={(event) => menu.current?.toggle(event)}
                disabled={disabled}
                className="
                    flex items-center gap-2 px-4 py-2 
                    bg-surface border border-surface-200 rounded-[14px]
                    
                    text-[12px] font-black text-surface-700 tracking-tight
                    
                    transition-all duration-200 active:scale-[0.95]
                    hover:border-primary-300 hover:text-primary-600 hover:shadow-sm
                    disabled:opacity-40 disabled:cursor-not-allowed
                "
            >
                <i className="pi pi-plus text-[10px] font-bold" />
                <span>添加项目</span>
            </button>
        </>
    );
};
