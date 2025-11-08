'use client';

import "primereact/resources/primereact.css";
import { Toast, ToastMessage } from "primereact/toast";
import React, {
    createContext,
    useContext,
    useRef,
    useCallback,
    ReactNode,
    MutableRefObject
} from "react";

type ToastContextType = {
    showToast: (options: ToastMessage | ToastMessage[]) => void;
};

// 创建上下文
const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastContextProviderProps {
    children: ReactNode;
}

// 包装 Provider
export const ToastContextProvider: React.FC<ToastContextProviderProps> = ({ children }) => {
    const toastRef = useRef<Toast | null>(null);

    const showToast = useCallback((options: ToastMessage | ToastMessage[]) => {
        toastRef.current?.show(options);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {/* PrimeReact 的 Toast */}
            <Toast 
                ref={toastRef} 
                position="top-right"
            />
            {children}
        </ToastContext.Provider>
    );
};

// Hook 用于获取上下文
export const useToastContext = (): ToastContextType => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error("useToastContext 必须在 ToastContextProvider 中使用");
    }

    return context;
};