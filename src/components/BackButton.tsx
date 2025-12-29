'use client';

import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';

export default function BackButton() {
    const router = useRouter();

    return (
        <Button
            label="返回"
            icon="pi pi-arrow-left"
            className="p-button-text p-button-secondary"
            onClick={() => router.back()}
        />
    );
}