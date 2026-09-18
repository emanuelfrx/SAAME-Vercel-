
import React from 'react';
import { FontState } from '../types';
import { getCharMetrics, TOPOLOGY } from '../services/fontService';

interface SousaAnalysisViewProps {
  font: FontState | null;
  category: 'Uppercase' | 'Lowercase';
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  onGlyphClick?: (char: string, lsb: number, rsb: number) => void;
}

const DEFAULT_GROUPS = {
    Lowercase: {
        Group1: ['b', 'd', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 'q', 'u'],
        Group2: ['a', 'c', 'e', 'f', 'j', 'k', 'r', 't'],
        Group3: ['g', 's', 'v', 'w', 'x', 'y', 'z']
    },
    Uppercase: {
        Group1: ['B', 'D', 'E', 'F', 'H', 'I', 'N', 'O', 'Q'],
        Group2: ['C', 'G', 'J', 'K', 'L', 'P', 'R'],
        Group3: ['A', 'M', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
    }
};

const getColorForType = (type: 'S'|'A'|'R'|'V') => {
    switch(type) {
        case 'S': return 'text-zinc-900 dark:text-zinc-100';
        case 'A': return 'text-zinc-800 dark:text-zinc-200';
        case 'R': return 'text-zinc-700 dark:text-zinc-300';
        case 'V': return 'dark:text-zinc-400 text-zinc-600';
        default: return 'dark:text-zinc-500 text-zinc-500';
    }
};

export const SousaAnalysisView: React.FC<SousaAnalysisViewProps> = ({ font, category, searchQuery, setSearchQuery, onGlyphClick }) => {
  const [localSearch, setLocalSearch] = React.useState(searchQuery || '');
  const query = setSearchQuery ? searchQuery : localSearch;
  const setQuery = setSearchQuery ? setSearchQuery : setLocalSearch;
  
  React.useEffect(() => {
    if (searchQuery !== undefined) setLocalSearch(searchQuery);
  }, [searchQuery]);

  const groups = category === 'Lowercase' ? DEFAULT_GROUPS.Lowercase : DEFAULT_GROUPS.Uppercase;

  if (!font || !font.fontObj) {
      return <div className="p-4 dark:text-gray-500 text-gray-500 text-base">Dados da fonte não disponíveis para análise Sousa</div>;
  }

  const fontFamily = font.fullFontFamily || 'Sousa';

  const renderGroup = (title: string, chars: string[]) => {
    const filteredChars = query 
        ? chars.filter(c => c.toLowerCase().includes(query.toLowerCase()))
        : chars;

    if (filteredChars.length === 0) return null;

    return (
        <div className="mb-6">
            <h5 className="text-sm font-bold dark:text-gray-500 text-gray-500 uppercase tracking-wider mb-3">{title}</h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-4 gap-4">
                {filteredChars.map(char => {
                    const { lsb, rsb } = getCharMetrics(font.fontObj, char);
                    const topo = TOPOLOGY[char] || { l: 'V', r: 'V' };
                    const lColor = getColorForType(topo.l);
                    const rColor = getColorForType(topo.r);

                    return (
                        <div 
                            key={char} 
                            onClick={() => onGlyphClick?.(char, lsb, rsb)}
                            className="dark:bg-zinc-800/50 bg-zinc-200/50 rounded h-16 p-1 flex items-center border dark:border-zinc-700/60 border-zinc-300 dark:hover:bg-zinc-800 hover:bg-zinc-200 transition-colors cursor-pointer"
                        >
                            <div className="min-w-[30px] flex-1 flex flex-col items-center justify-center h-full border-r dark:border-gray-700/30 border-gray-300/30">
                                <span className="mb-0.5 opacity-30 dark:text-gray-400 text-gray-600 text-[11px] leading-none">L</span>
                                <span className={`${lColor} font-bold text-[11px] font-mono leading-none`}>{lsb}</span>
                            </div>
                            <div 
                                className="w-12 text-3xl md:text-4xl dark:text-white text-slate-900 text-center flex items-center justify-center leading-none pb-1"
                                style={{ fontFamily: fontFamily }}
                            >
                                {char}
                            </div>
                            <div className="min-w-[30px] flex-1 flex flex-col items-center justify-center h-full border-l dark:border-gray-700/30 border-gray-300/30">
                                <span className="mb-0.5 opacity-30 dark:text-gray-400 text-gray-600 text-[11px] leading-none">R</span>
                                <span className={`${rColor} font-bold text-[11px] font-mono leading-none`}>{rsb}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
  };

  const g1 = renderGroup("1º Grupo (Relacional)", groups.Group1);
  const g2 = renderGroup("2º Grupo (Semi-Relacional)", groups.Group2);
  const g3 = renderGroup("3º Grupo (Visual)", groups.Group3);

  if (!g1 && !g2 && !g3) return null;

  return (
    <div className="mb-8">
        <h4 className="text-base font-bold uppercase mb-6 tracking-wider flex items-center gap-2 dark:text-white text-zinc-900">
             <div className="w-2 h-2 rounded-full dark:bg-white bg-zinc-900"></div>
             Método Sousa — Análise de {category === 'Uppercase' ? 'Maiúsculas' : 'Minúsculas'}
        </h4>

        {/* Legend */}
        {!searchQuery && (
            <div className="flex flex-wrap gap-4 mb-6 text-sm dark:bg-zinc-900/60 bg-zinc-100/80 p-3 rounded-xl border dark:border-zinc-800 border-zinc-300 items-center justify-between lg:justify-start lg:gap-8">
                <span className="flex items-center gap-1.5 font-medium dark:text-zinc-300 text-zinc-700"><div className="w-2 h-2 rounded dark:bg-white bg-zinc-900"></div> Haste / Reta</span>
                {category === 'Lowercase' && <span className="flex items-center gap-1.5 font-medium dark:text-zinc-300 text-zinc-700"><div className="w-2 h-2 rounded dark:bg-zinc-300 bg-zinc-600"></div> Arco</span>}
                <span className="flex items-center gap-1.5 font-medium dark:text-zinc-300 text-zinc-700"><div className="w-2 h-2 rounded dark:bg-zinc-500 bg-zinc-400"></div> Circular</span>
                <span className="flex items-center gap-1.5 font-medium dark:text-zinc-300 text-zinc-700"><div className="w-2 h-2 rounded dark:bg-zinc-700 bg-zinc-300"></div> Visual</span>
            </div>
        )}
        
        {g1}
        {g2}
        {g3}
    </div>
  );
};
