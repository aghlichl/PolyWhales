"use client";

import { useState, useEffect } from 'react';

export type Theme = 'black' | 'blue' | 'violet' | 'teal' | 'gray';

export const THEMES: { id: Theme; label: string; color: string }[] = [
    { id: 'black', label: 'VOID', color: '#000000' },
    { id: 'blue', label: 'FROST', color: '#4AD7FF' },
    { id: 'violet', label: 'TOKYO', color: '#8B5CF6' },
    { id: 'teal', label: 'MINT', color: '#22E6C3' },
    { id: 'gray', label: 'SMOKE', color: '#9CA3AF' },
];

export function useTheme() {
    const [theme, setTheme] = useState<Theme>('black');

    useEffect(() => {
        // Load theme from localStorage on mount
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        if (savedTheme && THEMES.some(t => t.id === savedTheme)) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, []);

    const changeTheme = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('app-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    return { theme, changeTheme };
}
