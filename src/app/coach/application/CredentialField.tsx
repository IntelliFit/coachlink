import React, { useState } from 'react';
import { Chip } from 'primereact/chip';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

interface Credential {
    name: string;
    url?: string;
}

interface CredentialFieldProps {
    credentials: Credential[];
    onAdd: (credential: Credential) => void;
    onRemove: (index: number) => boolean;
    onUpdate: (index: number, field: keyof Credential, value: string) => void;
}

const CredentialField: React.FC<CredentialFieldProps> = ({
    credentials,
    onAdd,
    onRemove,
    onUpdate
}) => {
    const [newCredential, setNewCredential] = useState<Credential>({ name: '', url: '' });

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCredential();
        }
    };

    const addCredential = () => {
        if (newCredential.name.trim()) {
            onAdd({ ...newCredential });
            setNewCredential({ name: '', url: '' });
        }
    };

    return (
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-surface-900 mb-2">
                资质证书
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
                {credentials.map((credential, index) => (
                    <Chip
                        key={index}
                        label={`${credential.name}${credential.url ? `` : ''}`}
                        removable
                        onRemove={() => onRemove(index)}
                        className="bg-blue-100 text-blue-700"
                    />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <InputText
                    value={newCredential.name}
                    onChange={(e) => setNewCredential({ ...newCredential, name: e.target.value })}
                    placeholder="证书名称"
                />
                <div className="flex gap-2">
                    <InputText
                        value={newCredential.url || ''}
                        onChange={(e) => setNewCredential({ ...newCredential, url: e.target.value })}
                        placeholder="证书链接（可选）"
                        className="flex-1"
                        onKeyDown={handleKeyPress}
                    />
                    <Button
                        icon="pi pi-plus"
                        onClick={addCredential}
                        disabled={!newCredential.name.trim()}
                    />
                </div>
            </div>
        </div>
    );
};

export default CredentialField;