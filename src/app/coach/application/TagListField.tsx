import React, { useState } from 'react';
import { Chip } from 'primereact/chip';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

interface TagListFieldProps {
    label: string;
    tags: string[];
    onAdd: (tag: string) => void;
    onRemove: (index: number) => boolean;
    placeholder: string;
    colorClass: string;
}

const TagListField: React.FC<TagListFieldProps> = ({
    label,
    tags,
    onAdd,
    onRemove,
    placeholder,
    colorClass
}) => {
    const [newTag, setNewTag] = useState('');

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    const addTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            onAdd(newTag.trim());
            setNewTag('');
        }
    };

    return (
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-surface-900 mb-2">
                {label}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                    <Chip
                        key={index}
                        label={tag}
                        removable
                        onRemove={() => onRemove(index)}
                        className={colorClass}
                    />
                ))}
            </div>
            <div className="flex gap-2">
                <InputText
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1"
                    placeholder={placeholder}
                />
                <Button
                    icon="pi pi-plus"
                    onClick={addTag}
                    disabled={!newTag.trim()}
                />
            </div>
        </div>
    );
};

export default TagListField;