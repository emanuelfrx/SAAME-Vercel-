
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SousaSettings, SousaGroups, FontState } from '../types';
import { generateAdhesionText, getCharMetrics } from '../services/fontService';
import { Settings2, RotateCcw, ChevronDown, ChevronUp, Layers, Edit2, Copy, Check } from 'lucide-react';
import { GlyphVisualizer } from './GlyphVisualizer';
import { TheoreticalTooltip } from './TheoreticalTooltip';
import { useDebounce } from './useDebounce';

interface SousaTunerProps {
  settings: SousaSettings;
  onSettingsChange: (newSettings: SousaSettings) => void;
  fontFamily: string;
  font: FontState | null;
  selectedChar: string;
  onCharSelect: (char: string) => void;
}

// --- NEW COMPONENT: LiveTestWord for Sousa ---
// Handles CSS Margin compensation for immediate feedback
interface LiveTestWordProps {
  word: string;
  fontFamily: string;
  font: FontState | null;
  settings: SousaSettings;
  targetChar?: string;
}

const LiveTestWord: React.FC<LiveTestWordProps> = React.memo(({ word, fontFamily, font, settings, targetChar }) => {
    const chars = word.split('');
    const upm = font?.metrics.unitsPerEm || 1000;
    
    return (
        <div 
            className="text-3xl md:text-4xl tracking-normal transition-colors text-center whitespace-nowrap overflow-x-auto custom-scrollbar w-full pb-2 mb-1" 
            style={{ fontFamily: `'${fontFamily}'` }}
        >
            {chars.map((char, i) => {
                // 1. Get Base Truth (Current Font File)
                const baseMetrics = (font && font.fontObj) ? getCharMetrics(font.fontObj, char) : { lsb: 0, rsb: 0 };
                
                // 2. Get Live Truth (Local Settings)
                let targetLsb = baseMetrics.lsb;
                let targetRsb = baseMetrics.rsb;

                // Priority: Overrides > Masters
                if (settings.overrides[char]) {
                     targetLsb = settings.overrides[char].lsb;
                     targetRsb = settings.overrides[char].rsb;
                } else if (['n', 'o', 'H', 'O'].includes(char)) {
                    const master = settings[char as keyof Pick<SousaSettings, 'n'|'o'|'H'|'O'>];
                    targetLsb = master.lsb;
                    targetRsb = master.rsb;
                }
                
                // 3. Diff
                const deltaL = targetLsb - baseMetrics.lsb;
                const deltaR = targetRsb - baseMetrics.rsb;

                // 4. CSS Compensation
                const style = {
                    marginLeft: `${deltaL / upm}em`,
                    marginRight: `${deltaR / upm}em`,
                    display: 'inline-block'
                };

                const isTarget = char === targetChar;
                return (
                    <span 
                        key={i} 
                        style={style}
                        className="text-black dark:text-white font-normal relative z-10"
                    >
                        {char}
                    </span>
                );
            })}
        </div>
    );
});

// Reusable Block Component similar to MetricTuner's TunerBlock
interface SousaBlockProps {
    char: 'n' | 'o' | 'H' | 'O';
    title: string;
    contextWords: string[];
    settings: SousaSettings;
    onUpdate: (char: 'n' | 'o' | 'H' | 'O', side: 'lsb' | 'rsb', val: number) => void;
    font: FontState | null;
    fontFamily: string;
}

const SousaMasterBlock: React.FC<SousaBlockProps> = React.memo(({ char, title, contextWords, settings, onUpdate, font, fontFamily }) => {
    // Explicitly access LSB and RSB from settings to ensure binding to state
    const currentLsb = settings[char].lsb;
    const currentRsb = settings[char].rsb;

    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');

    // React state for custom words of each block, loaded/saved in localStorage if needed
    const [localWords, setLocalWords] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`saame_sousa_${char}_words`);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error(e);
        }
        return contextWords;
    });

    const handleWordsChange = (newWords: string[]) => {
        setLocalWords(newWords);
        try {
            localStorage.setItem(`saame_sousa_${char}_words`, JSON.stringify(newWords));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <section className="dark:bg-zinc-900/40 bg-zinc-100/60 p-3 md:p-5 rounded-2xl border-l-4 border-black dark:border-white border dark:border-zinc-800 border-zinc-200 shadow-sm transition-transform hover:translate-x-1">
            <div className="flex justify-between items-center mb-3 md:mb-6">
                <div className="flex flex-col">
                    <h3 className="font-black text-zinc-950 dark:text-white text-xs md:text-sm uppercase tracking-[0.2em]">{title}</h3>
                    <div className="h-0.5 w-8 bg-zinc-400 dark:bg-zinc-600 mt-1 rounded-full" />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-6 order-2 lg:order-1">
                    <div className="space-y-4">
                        {/* LSB Control */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs md:text-sm dark:text-white text-zinc-950 font-bold">
                                    Side Bearing Esquerdo
                                    <span className="hidden md:inline">
                                        <TheoreticalTooltip content="Espaço lateral esquerdo. Controla a distância em relação ao caractere anterior." />
                                    </span>
                                </label>
                                <input 
                                    type="number"
                                    value={currentLsb}
                                    onChange={(e) => onUpdate(char, 'lsb', Number(e.target.value))}
                                    className="w-24 dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded px-2 py-1 h-10 text-right text-xl font-bold text-zinc-950 dark:text-white focus:border-black dark:focus:border-white outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                                    aria-label={`Valor numérico para Side Bearing Esquerdo ${title}`}
                                />
                            </div>
                            <input 
                                type="range" min="-50" max="300" value={currentLsb} 
                                onChange={(e) => onUpdate(char, 'lsb', Number(e.target.value))}
                                className="w-full accent-black dark:accent-white h-1.5 dark:bg-zinc-800 bg-zinc-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
                                aria-label={`Slider para Side Bearing Esquerdo ${title}`}
                            />
                        </div>

                        {/* RSB Control */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs md:text-sm dark:text-white text-zinc-950 font-bold">
                                    Side Bearing Direita
                                    <span className="hidden md:inline">
                                        <TheoreticalTooltip content="Espaço lateral direito. Garante o equilíbrio rítmico no fluxo de leitura contínua." />
                                    </span>
                                </label>
                                <input 
                                    type="number"
                                    value={currentRsb}
                                    onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                    className="w-24 dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded px-2 py-1 h-10 text-right text-xl font-bold text-zinc-950 dark:text-white focus:border-black dark:focus:border-white outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                                    aria-label={`Valor numérico para Side Bearing Direito ${title}`}
                                />
                            </div>
                            <input 
                                type="range" min="-50" max="300" value={currentRsb} 
                                onChange={(e) => onUpdate(char, 'rsb', Number(e.target.value))}
                                className="w-full accent-black dark:accent-white h-1.5 dark:bg-zinc-800 bg-zinc-300 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
                                aria-label={`Slider para Side Bearing Direito ${title}`}
                            />
                        </div>
                    </div>
                
                {/* Text Preview (Live) editable */}
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-4 md:p-5 mt-2 flex flex-col justify-center min-h-[110px] shrink-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {isEditing ? (
                        <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                            <input 
                                type="text"
                                value={editValue}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEditValue(val);
                                    const wordsList = val.split(/[\s,]+/).filter(Boolean);
                                    handleWordsChange(wordsList);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        setIsEditing(false);
                                    }
                                }}
                                onBlur={() => setIsEditing(false)}
                                autoFocus
                                className="text-center bg-transparent border-none outline-none font-mono text-base text-zinc-900 dark:text-zinc-100 border-b border-dashed border-zinc-400 dark:border-zinc-600 py-1 w-full max-w-xs focus:ring-0"
                                placeholder="Ex: nnnn, nonn"
                            />
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-mono uppercase tracking-widest font-black">Enter para salvar</p>
                        </div>
                    ) : (
                        <div 
                            className="text-center py-1 cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                            onClick={() => {
                                setEditValue(localWords.join(', '));
                                setIsEditing(true);
                            }}
                            title="Clique para editar sequência"
                        >
                            <div className="w-full">
                                {localWords.map((w, index) => (
                                    <LiveTestWord key={index} word={w} fontFamily={fontFamily} font={font} settings={settings} targetChar={char as string} />
                                ))}
                            </div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-1 rounded">
                                <Edit2 className="w-3 h-3" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Visualizer */}
            <div className="h-[320px] md:h-[360px] w-full order-1 lg:order-2 flex flex-col">
                <GlyphVisualizer 
                    char={char} 
                    font={font} 
                    lsb={settings[char].lsb} 
                    rsb={settings[char].rsb} 
                    method="SOUSA"
                />
            </div>
            </div>
        </section>
    );
});

export const SousaTuner: React.FC<SousaTunerProps> = ({ settings, onSettingsChange, fontFamily, font, selectedChar, onCharSelect }) => {
  // CRITICAL FIX: Local state ensures sliders don't stick due to parent re-render latency
  const [localSettings, setLocalSettings] = useState<SousaSettings>(settings);
  const [showGroups, setShowGroups] = useState(false);
  const [overrideChar, setOverrideChar] = useState<string>(selectedChar);
  const [inputOverrideChar, setInputOverrideChar] = useState<string>(selectedChar);
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

  // Debounce settings before passing them up
  const debouncedLocalSettings = useDebounce(localSettings, 400);

  // Sync with shared selectedChar
  useEffect(() => {
    setOverrideChar(selectedChar);
  }, [selectedChar]);

  // Sync input local state
  useEffect(() => {
    setInputOverrideChar(overrideChar);
  }, [overrideChar]);

  // Sync prop changes to local state
  useEffect(() => {
    if (JSON.stringify(settings) !== JSON.stringify(localSettings)) {
        setLocalSettings(settings);
    }
  }, [settings]);

  // Propagate debounced changes
  useEffect(() => {
    onSettingsChange(debouncedLocalSettings);
  }, [debouncedLocalSettings]);

  // --- Handlers ---

  const handleGroupChange = (groupKey: keyof SousaGroups, value: string) => {
    const chars = value.split('').filter(c => c.trim() !== '');
    const uniqueChars = Array.from(new Set(chars));
    const newSettings = {
        ...localSettings,
        groups: {
            ...localSettings.groups,
            [groupKey]: uniqueChars
        }
    };
    setLocalSettings(newSettings);
  };

  const handleMasterChange = (char: 'n'|'o'|'H'|'O', side: 'lsb'|'rsb', val: number) => {
      const newSettings = {
          ...localSettings,
          [char]: { ...localSettings[char], [side]: val }
      };
      setLocalSettings(newSettings);
  };

  // --- Dynamic Character List Generation ---
  const availableChars = useMemo(() => {
    if (!font || !font.fontObj) {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split('');
    }
    const uniqueChars = new Set<string>();
    // Priority chars
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split('').forEach(c => uniqueChars.add(c));
    
    // Scan font
    const numGlyphs = font.fontObj.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
        const glyph = font.fontObj.glyphs.get(i);
        if (glyph.unicode) {
            try {
                const char = String.fromCodePoint(glyph.unicode);
                if (char && char.trim() !== '') uniqueChars.add(char);
            } catch (e) {}
        }
    }
    return Array.from(uniqueChars);
  }, [font]);

  // --- Detailed Tuning Logic ---

  const getCharGroupStatus = (char: string) => {
      const g = localSettings.groups;
      if (g.group1.includes(char)) return "Grupo 1 (Relacional)";
      if (g.group2.includes(char)) return "Grupo 2 (Semi)";
      if (g.group3.includes(char)) return "Grupo 3 (Visual)";
      if (g.upperGroup1.includes(char)) return "Grupo Superior 1 (Relacional)";
      if (g.upperGroup2.includes(char)) return "Grupo Superior 2 (Semi)";
      if (g.upperGroup3.includes(char)) return "Grupo Superior 3 (Visual)";
      return "Sem Grupo (Ajuste Visual)";
  };

  const getCurrentMetric = (side: 'lsb' | 'rsb') => {
     // 1. Explicit Override in local state?
     if (localSettings.overrides[overrideChar] && localSettings.overrides[overrideChar][side] !== undefined && localSettings.overrides[overrideChar][side] !== null) {
         return localSettings.overrides[overrideChar][side]!;
     }
     
     // 2. Fallback: Read actual metric from processed font
     if (font && font.fontObj) {
         const glyph = font.fontObj.charToGlyph(overrideChar);
         if (glyph) {
             const box = glyph.getBoundingBox();
             if (side === 'lsb') return Math.round(box.x1);
             if (side === 'rsb') return Math.round(glyph.advanceWidth - box.x2);
         }
     }
     return 0;
  };

  const hasOverride = useMemo(() => {
      return !!localSettings.overrides[overrideChar];
  }, [localSettings.overrides, overrideChar]);

  const updateOverride = (side: 'lsb' | 'rsb', val: number) => {
      const current = localSettings.overrides[overrideChar] || { lsb: null, rsb: null };
      
      // If setting one side, ensure the other side preserves its current state (derived or overridden)
      let otherSideVal = side === 'lsb' ? current.rsb : current.lsb;
      if (otherSideVal === null) {
          otherSideVal = getCurrentMetric(side === 'lsb' ? 'rsb' : 'lsb');
      }

      const newOverride = {
          lsb: side === 'lsb' ? val : otherSideVal,
          rsb: side === 'rsb' ? val : otherSideVal
      };

      const newSettings = {
          ...localSettings,
          overrides: {
              ...localSettings.overrides,
              [overrideChar]: newOverride
          }
      };
      setLocalSettings(newSettings);
  };

  const resetOverride = () => {
      const newOverrides = { ...localSettings.overrides };
      delete newOverrides[overrideChar];
      const newSettings = { ...localSettings, overrides: newOverrides };
      setLocalSettings(newSettings);
  };

  // Generate test context based on char case and group
  const overrideContext = useMemo(() => {
     const isUpper = overrideChar.toUpperCase() === overrideChar && overrideChar.toLowerCase() !== overrideChar;
     const group = isUpper ? localSettings.groups.upperGroup1 : localSettings.groups.group1;
     return [generateAdhesionText(overrideChar, group)];
  }, [overrideChar, localSettings.groups]);

  // Transient override text state
  const [overrideWordsState, setOverrideWordsState] = useState<Record<string, string[]>>({});

  // Reset custom words to force fallback to standard dynamic template on selection change
  useEffect(() => {
      setOverrideWordsState({});
  }, [overrideChar]);

  const [isOverrideEditing, setIsOverrideEditing] = useState(false);
  const [overrideEditValue, setOverrideEditValue] = useState('');

  const currentOverrideWords = overrideWordsState[overrideChar] || overrideContext;

  const handleOverrideWordsChange = (words: string[]) => {
      setOverrideWordsState({ [overrideChar]: words });
  };

  // Derived values for inputs come from local state logic now
  const currentLsb = getCurrentMetric('lsb');
  const currentRsb = getCurrentMetric('rsb');

  return (
    <div className="dark:bg-zinc-900/50 bg-zinc-100/50 backdrop-blur rounded-[2rem] p-4 md:p-8 border dark:border-zinc-800 border-zinc-200 shadow-sm relative w-full h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 md:mb-8 pb-3 md:pb-6 border-b dark:border-zinc-800 border-zinc-200 z-10 -mx-2 px-4">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-zinc-900 dark:text-zinc-100" />
            </div>
            <div>
                <h2 className="text-2xl md:text-3xl font-black dark:text-white text-zinc-950 tracking-tighter leading-none mb-1">
                    MÉTODO SOUSA
                </h2>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 uppercase font-black tracking-widest pb-[1px]">Miguel Sousa & Fernando Mello</p>
                    <TheoreticalTooltip content="Desenvolvido por Miguel Sousa, este método organiza os glifos em três grupos por semelhança formal. Ele utiliza a herança de mestres (como 'l' e 'o') mas mantém a flexibilidade para o ajuste visual onde a forma é única." />
                </div>
            </div>
        </div>
      </div>

      <div className="space-y-8 pb-10">

        {/* --- 1. Topology Configuration (Collapsible) --- */}
        <div className="dark:bg-zinc-900/40 bg-zinc-100/60 border dark:border-zinc-800 border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <button 
                onClick={() => setShowGroups(!showGroups)}
                className="w-full flex items-center justify-between p-4 dark:bg-zinc-900 bg-zinc-200/80 dark:hover:bg-zinc-800 hover:bg-zinc-300/80 transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-inset"
                aria-expanded={showGroups}
                aria-controls="groups-configuration"
            >
                <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-zinc-900 dark:text-zinc-100" />
                    <span className="font-semibold dark:text-zinc-200 text-zinc-800 text-sm md:text-base">
                        Configuração de Grupos (Miguel Sousa)
                        <span className="hidden md:inline">
                            <TheoreticalTooltip content="As letras são agrupadas por relações de herança e necessidade de ajuste visual. O Grupo 1 é puramente relacional, o Grupo 2 é híbrido e o Grupo 3 é totalmente visual." />
                        </span>
                    </span>
                </div>
                {showGroups ? <ChevronUp className="w-4 h-4 dark:text-zinc-400 text-zinc-600"/> : <ChevronDown className="w-4 h-4 dark:text-zinc-400 text-zinc-600"/>}
            </button>
            
            {showGroups && (
                <div id="groups-configuration" className="p-4 space-y-6 border-t dark:border-zinc-800 border-zinc-200 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Lowercase Groups */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold dark:text-zinc-400 text-zinc-600 uppercase tracking-wider border-b dark:border-zinc-800 border-zinc-200 pb-1">Minúsculas (Miguel Sousa)</h4>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">1º Grupo (Relações de Herança: b, d, q...)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.group1.join('')}
                                    onChange={(e) => handleGroupChange('group1', e.target.value)}
                                    aria-label="Caracteres do 1º Grupo de Minúsculas"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">2º Grupo (Híbrido: r, f, t...)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.group2.join('')}
                                    onChange={(e) => handleGroupChange('group2', e.target.value)}
                                    aria-label="Caracteres do 2º Grupo de Minúsculas"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold dark:text-zinc-400 text-zinc-600 mb-1">3º Grupo (Visual: s, x, z...)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.group3.join('')}
                                    onChange={(e) => handleGroupChange('group3', e.target.value)}
                                    aria-label="Caracteres do 3º Grupo de Minúsculas"
                                />
                            </div>
                        </div>

                        {/* Uppercase Groups */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-bold dark:text-zinc-400 text-zinc-600 uppercase tracking-wider border-b dark:border-zinc-800 border-zinc-200 pb-1">Maiúsculas (Fernando Mello)</h4>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">1º Grupo (B D E F H I N O Q)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.upperGroup1.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup1', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1">2º Grupo (C G J K L P R)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.upperGroup2.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup2', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold dark:text-zinc-400 text-zinc-600 mb-1">3º Grupo (A M S T U V W X Y Z)</label>
                                <textarea 
                                    className="w-full dark:bg-zinc-900 bg-white border dark:border-zinc-700 border-zinc-300 rounded p-2 dark:text-white text-zinc-900 font-mono text-sm h-16 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                                    value={localSettings.groups.upperGroup3.join('')}
                                    onChange={(e) => handleGroupChange('upperGroup3', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* --- 2. Master Tuning --- */}
        <div className="space-y-6">
            <SousaMasterBlock 
                char="n" title="n (Mestre de Hastes - Minúsculas)" 
                contextWords={['nnnn', 'nonn']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="o" title="o (Mestre de Curvas - Minúsculas)" 
                contextWords={['nnonn', 'oooo']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="H" title="H (Mestre de Hastes - Maiúsculas)" 
                contextWords={['HHHH', 'HHOHH']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
            <SousaMasterBlock 
                char="O" title="O (Mestre de Curvas - Maiúsculas)" 
                contextWords={['HHOHH', 'OOOO']}
                settings={localSettings} onUpdate={handleMasterChange} font={font} fontFamily={fontFamily}
            />
        </div>

        {/* --- 3. Detailed Tuning --- */}
        <div className="mt-12 border-t dark:border-zinc-800 border-zinc-200 pt-10">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-xl font-black dark:text-white text-zinc-950 flex items-center gap-2 tracking-tight">
                        Ajustes de Exceção
                    </h3>
                    <p className="text-xs dark:text-zinc-400 text-zinc-600 uppercase tracking-widest font-bold mt-1">Sobrescreva as regras por glifo (H3)</p>
                </div>
            </div>

            <div className="dark:bg-zinc-900/40 bg-zinc-100/60 p-6 rounded-2xl border dark:border-zinc-800 border-zinc-200 shadow-sm">
                 {/* Selector */}
                 <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8 dark:bg-zinc-950/60 bg-white p-6 rounded-2xl border dark:border-zinc-800 border-zinc-200">
                     <div className="flex-1">
                         <div className="flex items-center justify-between mb-2">
                             <label className="text-xs dark:text-zinc-400 text-zinc-600 font-black uppercase tracking-widest block">Seletor de Glifo</label>
                             <button
                                 onClick={() => handleCopyUnicode(overrideChar)}
                                 className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 text-zinc-900 transition-all text-xs font-mono font-bold uppercase cursor-pointer shadow-sm hover:scale-105"
                                 title="Copiar Unicode para o diagrama de espaçamento"
                             >
                                 {copied ? (
                                     <>
                                         <Check className="w-3 h-3 text-zinc-950 dark:text-white" />
                                         <span className="text-zinc-950 dark:text-white">Copiado!</span>
                                     </>
                                 ) : (
                                     <>
                                         <Copy className="w-3 h-3" />
                                         <span>U+{overrideChar.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}</span>
                                     </>
                                 )}
                             </button>
                         </div>
                         <select 
                            value={overrideChar}
                            onChange={(e) => onCharSelect(e.target.value)}
                            className="w-full dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-700 border-zinc-300 rounded-xl px-4 py-3 dark:text-white text-zinc-950 font-mono text-base shadow-inner focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none transition-all"
                            aria-label="Escolher caracter para ajustar exceção"
                         >
                             {availableChars.map(c => (
                                 <option key={c} value={c}>
                                     {c} (U+{c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')})
                                 </option>
                             ))}
                         </select>
                     </div>
                     
                     <div className="text-base dark:text-zinc-400 text-zinc-600 flex flex-col justify-end">
                         <div className="flex items-center gap-3 dark:bg-zinc-900 bg-zinc-100 p-3 rounded-xl border dark:border-zinc-800 border-zinc-200">
                             <span className="text-xs font-black uppercase tracking-widest opacity-60">Origem</span>
                             {hasOverride ? (
                                 <motion.span initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-zinc-950 dark:text-white font-black px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs uppercase tracking-widest">Sobrescrito</motion.span>
                             ) : (
                                 <span className="text-zinc-700 dark:text-zinc-300 font-black px-3 py-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs uppercase tracking-widest">
                                     {getCharGroupStatus(overrideChar)}
                                 </span>
                             )}
                         </div>

                         {hasOverride && (
                             <button onClick={resetOverride} className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white font-black uppercase tracking-widest flex items-center gap-1.5 mt-3 justify-end transition-colors focus:outline-none focus:underline focus:ring-1 focus:ring-black dark:focus:ring-white rounded" aria-label="Remover ajustes personalizados e restaurar métricas originais">
                                 <RotateCcw className="w-3 h-3" /> Restaurar Espaçamento
                             </button>
                         )}
                     </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6 order-2 lg:order-1">
                        <div className="space-y-4">
                            {/* Override LSB */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm dark:text-zinc-300 text-zinc-700 font-medium">Side Bearing Esquerdo</label>
                                    <input 
                                        type="number"
                                        value={currentLsb}
                                        onChange={(e) => updateOverride('lsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-zinc-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-black dark:focus:ring-white ${hasOverride ? 'border-black dark:border-white text-black dark:text-white' : 'dark:border-zinc-700 border-zinc-300 text-zinc-950 dark:text-white'}`}
                                        aria-label="Sobrescrever Side Bearing Esquerdo"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={currentLsb}
                                    onChange={(e) => updateOverride('lsb', Number(e.target.value))}
                                    className="w-full accent-black dark:accent-white h-1.5 dark:bg-zinc-800 bg-zinc-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:ring-offset-2 focus:ring-offset-zinc-900"
                                    aria-label="Slider Sobrescrever Side Bearing Esquerdo"
                                />
                            </div>

                             {/* Override RSB */}
                             <div>
                                 <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm dark:text-zinc-300 text-zinc-700 font-medium">Side Bearing Direito</label>
                                    <input 
                                        type="number"
                                        value={currentRsb}
                                        onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                        className={`w-24 dark:bg-zinc-900 bg-white border rounded px-2 py-1 h-10 text-right text-sm font-bold outline-none transition-all focus:ring-1 focus:ring-black dark:focus:ring-white ${hasOverride ? 'border-black dark:border-white text-black dark:text-white' : 'dark:border-zinc-700 border-zinc-300 text-zinc-950 dark:text-white'}`}
                                        aria-label="Sobrescrever Side Bearing Direito"
                                    />
                                </div>
                                <input 
                                    type="range" min="-50" max="300" value={currentRsb}
                                    onChange={(e) => updateOverride('rsb', Number(e.target.value))}
                                    className="w-full accent-black dark:accent-white h-1.5 dark:bg-zinc-800 bg-zinc-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                    aria-label="Slider Sobrescrever Side Bearing Direito"
                                />
                            </div>
                        </div>

                        {/* Text Preview (Live) editable */}
                        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-2xl p-4 md:p-5 mt-2 flex flex-col justify-center min-h-[110px] shrink-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {isOverrideEditing ? (
                                <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                        type="text"
                                        value={overrideEditValue}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setOverrideEditValue(val);
                                            const wordsList = val.split(/[\s,]+/).filter(Boolean);
                                            handleOverrideWordsChange(wordsList);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setIsOverrideEditing(false);
                                            }
                                        }}
                                        onBlur={() => setIsOverrideEditing(false)}
                                        autoFocus
                                        className="text-center bg-transparent border-none outline-none font-mono text-base text-zinc-900 dark:text-zinc-100 border-b border-dashed border-zinc-400 dark:border-zinc-600 py-1 w-full max-w-xs focus:ring-0"
                                        placeholder="Ex: nnBnn, ooBoo"
                                    />
                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 font-mono uppercase tracking-widest font-black">Enter para salvar</p>
                                </div>
                            ) : (
                                <div 
                                    className="text-center py-1 cursor-pointer transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                                    onClick={() => {
                                        setOverrideEditValue(currentOverrideWords.join(', '));
                                        setIsOverrideEditing(true);
                                    }}
                                    title="Clique para editar sequência"
                                >
                                    <div className="w-full">
                                        {currentOverrideWords.map((w, index) => (
                                            <LiveTestWord key={index} word={w} fontFamily={fontFamily} font={font} settings={localSettings} targetChar={overrideChar} />
                                        ))}
                                    </div>
                                    <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 p-1 rounded">
                                        <Edit2 className="w-3 h-3" />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Visualizer */}
                    <div className="order-1 lg:order-2 flex flex-col h-full space-y-3">
                        <div className="flex items-center justify-between shrink-0">
                            <h3 className="text-sm font-black dark:text-zinc-400 text-zinc-600 uppercase tracking-widest flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5" /> ANÁLISE GEOMÉTRICA
                            </h3>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-black uppercase tracking-widest dark:text-zinc-400 text-zinc-600 whitespace-nowrap">ALTERAR GLIFO:</label>
                                <input 
                                    type="text"
                                    maxLength={1}
                                    value={inputOverrideChar}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setInputOverrideChar(val);
                                        if (val && availableChars.includes(val)) {
                                            onCharSelect(val);
                                        }
                                    }}
                                    onFocus={(e) => e.target.select()}
                                    className="bg-white dark:bg-zinc-950 border-2 dark:border-zinc-700 border-zinc-400 rounded-lg px-2 py-1 text-center text-lg font-black dark:text-white text-zinc-900 focus:border-black dark:focus:border-white focus:ring-1 focus:ring-black dark:focus:ring-white outline-none w-16 shadow-sm transition-all"
                                />
                            </div>
                        </div>
                        <div className="h-[320px] md:h-[360px] w-full shrink-0">
                            <GlyphVisualizer 
                                char={overrideChar} 
                                font={font} 
                                lsb={currentLsb} 
                                rsb={currentRsb} 
                                method="SOUSA"
                            />
                        </div>
                    </div>
                 </div>
            </div>
        </div>

      </div>
    </div>
  );
};
