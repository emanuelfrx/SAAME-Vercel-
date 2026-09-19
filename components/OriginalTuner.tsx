import React, { useState, useMemo, useEffect } from 'react';
import { FontState } from '../types';
import { GlyphVisualizer } from './GlyphVisualizer';
import { Eye, Copy, Check } from 'lucide-react';

export const OriginalTuner: React.FC<{ font: FontState | null, selectedChar: string, onCharSelect: (char: string) => void }> = ({ font, selectedChar, onCharSelect }) => {
    const [inputChar, setInputChar] = useState<string>(selectedChar);
    const [copied, setCopied] = useState(false);

    const handleCopyUnicode = (char: string) => {
        const unicodeStr = `U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(unicodeStr).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                });
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = unicodeStr;
                textArea.style.position = "fixed";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            }
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    // Sync input local state
    useEffect(() => {
        setInputChar(selectedChar);
    }, [selectedChar]);
    
    // Calculate LSB/RSB dynamically from raw font data
    const metrics = useMemo(() => {
        if (!font || !font.fontObj) return { lsb: 0, rsb: 0 };
        const glyph = font.fontObj.charToGlyph(selectedChar);
        if (!glyph) return { lsb: 0, rsb: 0 };
        const box = glyph.getBoundingBox();
        return { 
            lsb: Math.round(box.x1), 
            rsb: Math.round(glyph.advanceWidth - box.x2) 
        };
    }, [font, selectedChar]);

    // Use consistent character list generation
    const availableChars = useMemo(() => {
        if (!font || !font.fontObj) return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');
        const chars = new Set<string>();
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('').forEach(c => chars.add(c));
        const numGlyphs = font.fontObj.glyphs.length;
        for (let i = 0; i < numGlyphs; i++) {
            const glyph = font.fontObj.glyphs.get(i);
            if (glyph.unicode) {
                const char = String.fromCodePoint(glyph.unicode);
                if (char && char.trim() !== '') chars.add(char);
            }
        }
        return Array.from(chars);
    }, [font]);

    return (
        <div className="dark:bg-zinc-900/50 bg-zinc-100/50 backdrop-blur rounded-[2rem] p-4 md:p-8 border dark:border-zinc-800 border-zinc-200 shadow-sm relative w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="flex items-center justify-between mb-8 pb-6 border-b dark:border-zinc-800 border-zinc-200">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                        <Eye className="w-5 h-5 dark:text-zinc-300 text-zinc-700" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black dark:text-white text-zinc-950 tracking-tighter leading-none mb-1">
                            FONTE ORIGINAL
                        </h2>
                        <p className="text-xs dark:text-zinc-400 text-zinc-600 uppercase font-black tracking-widest pb-[1px]">Visualização de Métricas</p>
                    </div>
                </div>
            </div>

            <div className="mb-6 p-4 rounded-xl dark:bg-zinc-900/50 bg-zinc-100/60 border dark:border-zinc-800 border-zinc-200 text-sm dark:text-zinc-400 text-zinc-600">
                <p><strong>Espaçamento (Side Bearings):</strong> As métricas LSB (Left Side Bearing) e RSB (Right Side Bearing) definem o espaço vazio nas laterais de cada caractere. Elas são fundamentais para garantir que o texto tenha um ritmo equilibrado e legibilidade ideal.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Visualizer Area */}
                <div className="dark:bg-zinc-900/40 bg-zinc-100/60 p-6 rounded-2xl border dark:border-zinc-800 border-zinc-200 shadow-inner min-h-[300px] flex flex-col">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4 p-3 dark:bg-zinc-900 bg-white rounded-xl border dark:border-zinc-800 border-zinc-200">
                        <div className="flex items-center gap-4">
                            <label className="text-xs font-black uppercase tracking-widest dark:text-zinc-400 text-zinc-600 whitespace-nowrap">ALTERAR GLIFO:</label>
                            <input 
                                type="text"
                                maxLength={1}
                                value={inputChar}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setInputChar(val);
                                    // Apenas atualize a visualização se for um glifo válido
                                    if (val && availableChars.includes(val)) {
                                        onCharSelect(val);
                                    }
                                }}
                                onFocus={(e) => e.target.select()}
                                className="bg-white dark:bg-zinc-950 border-2 dark:border-zinc-700 border-zinc-400 rounded-lg px-2 py-1 text-center text-lg font-black dark:text-white text-zinc-900 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none w-16 shadow-sm transition-all"
                                placeholder="Ex: H"
                            />
                        </div>
                        <button
                            onClick={() => handleCopyUnicode(selectedChar)}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-zinc-800 hover:scale-105 shadow-sm cursor-pointer"
                            title="Clique para copiar o Unicode deste glifo"
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5 text-zinc-950 dark:text-white" />
                                    <span className="text-zinc-950 dark:text-white font-bold">Copiado!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                                    <span>
                                        U+{selectedChar.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                    <div className="h-[320px] md:h-[360px] w-full shrink-0">
                        <GlyphVisualizer 
                            char={selectedChar} 
                            font={font} 
                            lsb={metrics.lsb} 
                            rsb={metrics.rsb} 
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t dark:border-zinc-800 border-zinc-200">
                        <div className="text-center p-3 rounded-xl dark:bg-zinc-900 bg-white border dark:border-zinc-800 border-zinc-200">
                            <div className="text-xs uppercase tracking-widest dark:text-zinc-400 text-zinc-500 font-bold mb-1">LSB (Origin)</div>
                            <div className="text-2xl font-mono font-bold text-zinc-950 dark:text-white">{metrics.lsb}</div>
                        </div>
                        <div className="text-center p-3 rounded-xl dark:bg-zinc-900 bg-white border dark:border-zinc-800 border-zinc-200">
                            <div className="text-xs uppercase tracking-widest dark:text-zinc-400 text-zinc-500 font-bold mb-1">RSB (Advance)</div>
                            <div className="text-2xl font-mono font-bold text-zinc-950 dark:text-white">{metrics.rsb}</div>
                        </div>
                    </div>
                </div>

                {/* Character Grid Selector */}
                <div className="dark:bg-zinc-900/40 bg-zinc-100/60 p-6 rounded-2xl border dark:border-zinc-800 border-zinc-200 shadow-inner">
                    <label className="text-xs dark:text-zinc-400 text-zinc-600 font-black uppercase tracking-widest mb-4 block">Seletor de Glifos</label>
                    <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2 h-96 overflow-y-auto custom-scrollbar p-1">
                        {availableChars.map(c => (
                            <button 
                                key={c} 
                                onClick={() => onCharSelect(c)} 
                                className={`aspect-square flex items-center justify-center rounded-lg text-base font-bold transition-all ${
                                    selectedChar === c 
                                    ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-md' 
                                    : 'dark:bg-zinc-800 bg-zinc-200 dark:text-zinc-300 text-zinc-800 dark:hover:bg-zinc-700 hover:bg-zinc-300'
                                }`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
