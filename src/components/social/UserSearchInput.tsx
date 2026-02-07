import React, { useState, useEffect } from 'react';
import { InputText } from 'primereact/inputtext';
import { Search, Loader2 } from 'lucide-react';

interface UserSearchInputProps {
    onSearch: (query: string) => void;
    placeholder?: string;
    loading?: boolean;
}

export const UserSearchInput: React.FC<UserSearchInputProps> = ({ 
    onSearch, 
    placeholder = "搜索用户昵称或 ID",
    loading = false
}) => {
    const [value, setValue] = useState('');
    
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
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400">
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <Search className="w-5 h-5" />
                )}
            </div>
            <InputText 
                value={value} 
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className="w-full h-12 rounded-2xl border border-surface-200 bg-surface-0 pl-12 pr-4 text-sm font-semibold text-surface-800 placeholder:text-surface-400 focus:outline-none focus:border-primary-300 focus:ring-2 focus:ring-primary-100 transition-all"
            />
        </div>
    );
};
