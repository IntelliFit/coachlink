import React, { useState } from 'react';
import { Dropdown, DropdownFilterEvent } from 'primereact/dropdown';
import { CoachInfoComponent } from './CoachInfoComponent';
import { coachService } from '@/app/service/coachService';
import { GetAllCoachesResponseDto } from '@/app/api/coach/get-all-coaches/entity';

interface CoachFilterComponentProps {
    options: any;
}

interface CoachOption {
    name: string;
    id: string;
    avatar_url?: string;
}

export const CoachFilterComponent: React.FC<CoachFilterComponentProps> = ({ options }) => {
    const [filteredOptions, setFilteredOptions] = useState<CoachOption[]>([]);
    const [loading, setLoading] = useState(false);

    // 搜索教练
    const searchCoaches = async (searchText: string) => {
        if (!searchText.trim()) {
            setFilteredOptions([]);
            return;
        }

        setLoading(true);
        try {
            const res: GetAllCoachesResponseDto | null = await coachService.getAllCoaches({
                search: searchText,
                page: 1,
                limit: 100
            });

            if (res && res.coaches) {
                const coaches: CoachOption[] = res.coaches.map(coach => ({
                    name: coach.name,
                    id: coach.id,
                    avatar_url: coach.avatar_url || undefined
                }));
                setFilteredOptions(coaches);
            } else {
                setFilteredOptions([]);
            }
        } catch (error) {
            console.error('搜索教练失败:', error);
            setFilteredOptions([]);
        } finally {
            setLoading(false);
        }
    };

    // 处理搜索输入变化
    const handleFilterChange = (e: DropdownFilterEvent) => {        
        searchCoaches(e.filter);
    };

    // 自定义选项模板
    const itemTemplate = (option: CoachOption) => {
        return (
            <div className="flex items-center space-x-3">
                <CoachInfoComponent profile={{
                    nickname: option.name,
                    avatar_url: option.avatar_url
                } as any} />
            </div>
        );
    };

    // 自定义值模板
    const valueTemplate = (option: CoachOption | null) => {
        if (!option) {
            return <span>选择教练</span>;
        }

        return (
            <div className="flex items-center space-x-3">
                <CoachInfoComponent profile={{
                    nickname: option.name,
                    avatar_url: option.avatar_url
                } as any} />
            </div>
        );
    };

    return (
        <Dropdown
            value={options.value}
            options={filteredOptions}
            onChange={(e) => {
                options.filterApplyCallback(e.value);
            }}
            onFilter={handleFilterChange}
            optionLabel="name"
            placeholder="搜索并选择教练"
            className="p-column-filter w-full"
            showClear
            filter
            filterBy="name"
            loading={loading}
            itemTemplate={itemTemplate}
            valueTemplate={valueTemplate}
            emptyMessage="未找到教练"
            emptyFilterMessage="未找到匹配的教练"
        />
    );
};