import React, { useState } from 'react';
import { Dropdown, DropdownFilterEvent } from 'primereact/dropdown';
import { StudentInfoComponent } from './StudentInfoComponent';

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

    // 搜索学生（由于没有专门的学生搜索API，这里模拟实现）
    const searchStudents = async (searchText: string) => {
        if (!searchText.trim()) {
            setFilteredOptions([]);
            return;
        }

        setLoading(true);
        try {
            // 注意：当前项目中没有提供专门搜索学生的API
            // 这里只是模拟实现，实际项目中应该替换为真实的API调用
            // 模拟API调用延迟
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // 模拟搜索结果
            const mockStudents: StudentOption[] = [
                { name: '张三丰', id: '1', avatar_url: undefined },
                { name: '李小龙', id: '2', avatar_url: undefined },
                { name: '王大锤', id: '3', avatar_url: undefined },
                { name: '赵子龙', id: '4', avatar_url: undefined },
                { name: '钱学森', id: '5', avatar_url: undefined }
            ].filter(student => student.name.includes(searchText));
            
            setFilteredOptions(mockStudents);
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