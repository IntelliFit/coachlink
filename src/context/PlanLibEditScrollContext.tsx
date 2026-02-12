'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface PlanLibEditScrollContextValue {
    scrolledDown: boolean;
    setScrolledDown: (v: boolean) => void;
}

const PlanLibEditScrollContext = createContext<PlanLibEditScrollContextValue>({
    scrolledDown: false,
    setScrolledDown: () => {},
});

export function PlanLibEditScrollProvider({ children }: { children: React.ReactNode }) {
    const [scrolledDown, setScrolledDown] = useState(false);
    return (
        <PlanLibEditScrollContext.Provider value={{ scrolledDown, setScrolledDown }}>
            {children}
        </PlanLibEditScrollContext.Provider>
    );
}

export function usePlanLibEditScroll() {
    return useContext(PlanLibEditScrollContext);
}
