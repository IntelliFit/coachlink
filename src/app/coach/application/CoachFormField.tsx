import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';

interface CoachFormFieldProps {
    id: string;
    name: string;
    label: string;
    value: string | number;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    onValueChange?: (e: InputNumberValueChangeEvent) => void;
    type?: 'text' | 'email' | 'number' | 'textarea';
    placeholder?: string;
    required?: boolean;
    rows?: number;
    min?: number;
    showButtons?: boolean;
    className?: string;
}

const CoachFormField: React.FC<CoachFormFieldProps> = ({
    id,
    name,
    label,
    value,
    onChange,
    onValueChange,
    type = 'text',
    placeholder = '',
    required = false,
    rows = 3,
    min = 0,
    showButtons = false,
    className = 'w-full'
}) => {
    const renderInput = () => {
        switch (type) {
            case 'textarea':
                return (
                    <InputTextarea
                        id={id}
                        name={name}
                        value={value as string}
                        onChange={onChange}
                        rows={rows}
                        className={className}
                        placeholder={placeholder}
                    />
                );
            case 'number':
                return (
                    <InputNumber
                        id={id}
                        name={name}
                        showButtons={showButtons}
                        value={value as number}
                        onValueChange={onValueChange}
                        className={className}
                        min={min}
                    />
                );
            case 'email':
                return (
                    <InputText
                        id={id}
                        name={name}
                        type="email"
                        value={value as string}
                        onChange={onChange}
                        className={className}
                        placeholder={placeholder}
                    />
                );
            default:
                return (
                    <InputText
                        id={id}
                        name={name}
                        value={value as string}
                        onChange={onChange}
                        className={className}
                        placeholder={placeholder}
                    />
                );
        }
    };

    return (
        <div className="md:col-span-2">
            <label htmlFor={id} className="block text-sm font-medium text-surface-900 mb-2">
                {label} {required && '*'}
            </label>
            {renderInput()}
        </div>
    );
};

export default CoachFormField;