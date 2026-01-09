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
            <Menu model={items} popup ref={menu} id="add_item_menu" />
            <Button
                label="添加项目"
                icon="pi pi-plus"
                onClick={(event) => menu.current?.toggle(event)}
                aria-controls="add_item_menu"
                aria-haspopup
                disabled={disabled}
                className="p-button-sm p-button-outlined"
            />
        </>
    );
};
