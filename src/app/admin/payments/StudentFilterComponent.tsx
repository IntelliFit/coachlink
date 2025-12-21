import React, { useState } from 'react';
import { Dropdown, DropdownFilterEvent } from 'primereact/dropdown';
import { StudentInfoComponent } from './StudentInfoComponent';
import { userService } from '@/app/service/userService';

interface StudentFilterComponentProps {
    options: any;
}

interface StudentOption {
    name: string;
    id: string;
    avatar_url?: string;
}

export const StudentFilterComponent: React.FC<StudentFilterComponentProps> = ({ options }) => {
    const [filteredOptions, setFilteredOptions] = useState<StudentOption[]>([]);
    const [loading, setLoading] = useState(false);

    // 搜索学生
    const searchStudents = async (searchText: string) => {
        if (!searchText.trim()) {
            setFilteredOptions([]);
            return;
        }

        setLoading(true);
        try {
            // 使用userService.getAllUsers API进行搜索
            const res = await userService.getAllUsers({
                search: searchText,
                page: 1,
                limit: 100
            });

            if (res && res.users) {
                const students: StudentOption[] = res.users.map(user => ({
                    name: user.nickname || user.full_name || '未知用户',
                    id: user.user_id,
                    avatar_url: user.avatar_url || undefined
                }));
                setFilteredOptions(students);
            } else {
                setFilteredOptions([]);
            }
        } catch (error) {
            console.error('搜索学生失败:', error);
            setFilteredOptions([]);
        } finally {
            setLoading(false);
        }
    };

    // 处理搜索输入变化
    const handleFilterChange = (e: DropdownFilterEvent) => {
        searchStudents(e.filter);
    };

    // 自定义选项模板
    const itemTemplate = (option: StudentOption) => {
        return (
            <div className="flex items-center space-x-3">
                <StudentInfoComponent profile={{
                    nickname: option.name,
                    avatar_url: option.avatar_url
                } as any} />
            </div>
        );
    };

    // 自定义值模板
    const valueTemplate = (option: StudentOption | null) => {
        if (!option) {
            return <span>选择学员</span>;
        }

        return (
            <div className="flex items-center space-x-3">
                <StudentInfoComponent profile={{
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
            placeholder="搜索并选择学员"
            className="p-column-filter w-full"
            showClear
            filter
            filterBy="name"
            loading={loading}
            itemTemplate={itemTemplate}
            valueTemplate={valueTemplate}
            emptyMessage="未找到学员"
            emptyFilterMessage="未找到匹配的学员"
        />
    );
};