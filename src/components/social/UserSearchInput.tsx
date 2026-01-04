import React, { useState, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import { Search } from 'lucide-react';
import { useDebounce } from 'primereact/hooks';

interface UserSearchInputProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    loading?: boolean;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({ 
    onSearch, 
    placeholder = "搜索用户昵称或ID...",
    loading = false
}) => {
    const [value, setValue] = useState('');
    
    // 手动实现 debounce，因为 primereact hooks可能有版本问题或不想引入额外依赖
    useEffect(() => {
        const timer = setTimeout(() => {
            if (value.trim()) {
                onSearch(value.trim());
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [value, onSearch]);

    return (
        <div className="relative w-full">
            <span className="p-input-icon-left w-full">
                <i className={`${loading ? 'pi pi-spin pi-spinner' : 'pi pi-search'}`} />
                <InputText 
                    value={value} 
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl pl-10 py-3 bg-surface-50 border-0 focus:ring-2 focus:ring-primary-500" // Tailwind based styling
                />
            </span>
        </div>
    );
};
