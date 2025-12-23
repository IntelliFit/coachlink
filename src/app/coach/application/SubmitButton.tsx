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
        <div className="mt-6 flex justify-end gap-3">
            <Button
                label="返回"
                icon="pi pi-arrow-left"
                onClick={() => router.back()}
                className="p-button-text"
            />
            <Button
                label={saving ? "提交中..." : "提交申请"}
                icon={saving ? "pi pi-spin pi-spinner" : "pi pi-send"}
                onClick={onClick}
                disabled={saving}
                className="p-button-primary"
            />
        </div>
    );
};

export default SubmitButton;