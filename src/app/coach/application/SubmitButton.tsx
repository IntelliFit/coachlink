import React from 'react';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';

interface SubmitButtonProps {
    saving: boolean;
    onClick: () => void;
}
const SubmitButton: React.FC<SubmitButtonProps> = ({ saving, onClick }) => {
    const router = useRouter();

    return (
        <div className="mt-10 flex items-center justify-end gap-4 border-t border-surface-100 pt-6">
            <Button
                label="取消返回"
                icon="pi pi-angle-left"
                onClick={() => router.back()}
                className="p-button-text p-button-plain font-bold"
            />
            <Button
                label={saving ? "提交中..." : "确认并提交申请"}
                icon={saving ? "pi pi-spin pi-spinner" : "pi pi-check-circle"}
                onClick={onClick}
                disabled={saving}
                className="p-button-primary px-8 shadow-lg shadow-primary-200 active:scale-95 transition-all"
            />
        </div>
    );
};

export default SubmitButton;