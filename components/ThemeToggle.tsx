import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Inicializa o state baseado na classe atual
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        }
    };

    return (
        <button 
            onClick={toggleTheme}
            className="fixed bottom-6 right-6 z-[9999] p-3 rounded-full dark:bg-zinc-900 bg-white border dark:border-zinc-750 border-zinc-300 shadow-xl hover:scale-105 active:scale-95 transition-all text-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            title={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
            aria-label={isDark ? "Mudar para Modo Claro" : "Mudar para Modo Escuro"}
        >
            {isDark ? (
                <Sun className="w-5 h-5 text-white" />
            ) : (
                <Moon className="w-5 h-5 text-black" />
            )}
        </button>
    );
};
