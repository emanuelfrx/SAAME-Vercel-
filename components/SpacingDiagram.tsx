
import React, { useMemo } from 'react';
import { FontState, MethodType } from '../types';
import { getCharMetrics, TOPOLOGY } from '../services/fontService';

interface SpacingDiagramProps {
  font: FontState | null;
  method: MethodType;
  category: 'Uppercase' | 'Lowercase';
  searchQuery?: string;
  onGlyphClick?: (char: string, lsb: number, rsb: number) => void;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz".split('');

export const SpacingDiagram: React.FC<SpacingDiagramProps> = ({ font, method, category, searchQuery = '', onGlyphClick }) => {
  const chars = useMemo(() => {
    if (!font || !font.fontObj) {
      return category === 'Uppercase' ? UPPERCASE : LOWERCASE;
    }
    
    const fontChars = new Set<string>();
    const numGlyphs = font.fontObj.glyphs.length;
    for (let i = 0; i < numGlyphs; i++) {
      const glyph = font.fontObj.glyphs.get(i);
      
      const unicodes: number[] = [];
      if (glyph.unicode && glyph.unicode > 32) {
        unicodes.push(glyph.unicode);
      }
      if (glyph.unicodes) {
        glyph.unicodes.forEach(uni => {
          if (uni && uni > 32 && !unicodes.includes(uni)) {
            unicodes.push(uni);
          }
        });
      }
      
      for (const uni of unicodes) {
        try {
          const char = String.fromCodePoint(uni);
          if (char && char.trim() !== '') {
            fontChars.add(char);
          }
        } catch (e) {}
      }
    }
    
    // Categorize into Uppercase vs Lowercase based on Unicode casing properties
    const matchedChars: string[] = [];
    fontChars.forEach(char => {
      const isLetter = char.toLowerCase() !== char.toUpperCase();
      if (isLetter) {
        if (category === 'Uppercase' && char === char.toUpperCase()) {
          matchedChars.push(char);
        } else if (category === 'Lowercase' && char === char.toLowerCase()) {
          matchedChars.push(char);
        }
      }
    });

    // Sort: standard A-Z or a-z should come first, then others alphabetically
    const standardSet = new Set(category === 'Uppercase' ? UPPERCASE : LOWERCASE);
    matchedChars.sort((a, b) => {
      const aStd = standardSet.has(a);
      const bStd = standardSet.has(b);
      if (aStd && !bStd) return -1;
      if (!aStd && bStd) return 1;
      return a.localeCompare(b);
    });
    
    // Fallback to standard if no letters were found
    return matchedChars.length > 0 ? matchedChars : (category === 'Uppercase' ? UPPERCASE : LOWERCASE);
  }, [font, category]);
  
  const filteredChars = useMemo(() => {
    if (!searchQuery) return chars;
    const qLower = searchQuery.toLowerCase().trim();
    const qCleanHex = qLower.replace(/^(u\+|0x)/g, '');
    
    return chars.filter(c => {
      if (c.toLowerCase().includes(qLower)) return true;
      
      const unicodeCode = c.codePointAt(0);
      if (unicodeCode !== undefined) {
        const hex = unicodeCode.toString(16).toLowerCase();
        const decimalStr = unicodeCode.toString();
        const uFormatted = `u+${unicodeCode.toString(16).padStart(4, '0').toLowerCase()}`;
        
        if (decimalStr.includes(qLower)) return true;
        if (hex.includes(qCleanHex)) return true;
        if (uFormatted.includes(qLower)) return true;
      }
      return false;
    });
  }, [chars, searchQuery]);

  const fontFamily = font?.fullFontFamily || (method === MethodType.TRACY ? 'Tracy' : method === MethodType.SOUSA ? 'Sousa' : 'Font');
  
  const getMethodStyles = () => {
    switch(method) {
        case MethodType.TRACY: return { color: 'dark:text-zinc-100 text-zinc-900', border: 'dark:border-zinc-700/60 border-zinc-300', bg: 'dark:bg-white bg-zinc-900' };
        case MethodType.SOUSA: return { color: 'dark:text-zinc-100 text-zinc-900', border: 'dark:border-zinc-700/60 border-zinc-300', bg: 'dark:bg-white bg-zinc-900' };
        case MethodType.ORIGINAL_CUSTOM: return { color: 'dark:text-zinc-100 text-zinc-900', border: 'dark:border-zinc-700/60 border-zinc-300', bg: 'dark:bg-white bg-zinc-900' };
        default: return { color: 'dark:text-slate-400 text-slate-600', border: 'dark:border-zinc-800 border-zinc-200', bg: 'bg-zinc-500' };
    }
  };

  const styles = getMethodStyles();
  const methodColor = styles.color;
  const borderClass = styles.border;

  const getMethodName = () => {
    switch(method) {
        case MethodType.TRACY: return "Método Tracy";
        case MethodType.SOUSA: return "Método Sousa";
        case MethodType.ORIGINAL_CUSTOM: return "Ajuste Manual";
        case MethodType.ORIGINAL: return "Métrica Original";
        default: return "Métrica";
    }
  };

  // Get Masters for Comparison
  const masters = useMemo(() => {
      if (!font || !font.fontObj) return { h: 0, o: 0, nLsb: 0, nRsb: 0 };
      const hM = getCharMetrics(font.fontObj, 'H');
      const oM = getCharMetrics(font.fontObj, 'O');
      const nM = getCharMetrics(font.fontObj, 'n');
      const loM = getCharMetrics(font.fontObj, 'o');
      
      return category === 'Uppercase' 
        ? { h: hM.lsb, o: oM.lsb, nLsb: 0, nRsb: 0 } 
        : { h: nM.lsb, o: loM.lsb, nLsb: nM.lsb, nRsb: nM.rsb }; 
  }, [font, category]);

  // Topology-aware labeling to avoid inversion
  const getLabel = (char: string, side: 'l' | 'r', val: number) => {
      const topo = TOPOLOGY[char] || { l: 'V', r: 'V' };
      const type = topo[side];
      const tol = 1;

      if (category === 'Uppercase') {
          const { h, o } = masters;
          
          if (type === 'S') {
              if (Math.abs(val - h) <= tol) return { label: 'H', color: 'dark:text-white text-zinc-900 font-bold' };
              if (val > h) return { label: '>H', color: 'dark:text-zinc-300 text-zinc-700' };
              if (val < h) return { label: '<H', color: 'dark:text-zinc-300 text-zinc-700' };
          }
          if (type === 'R') {
              if (Math.abs(val - o) <= tol) return { label: 'O', color: 'dark:text-zinc-400 text-zinc-600' };
          }
          if (type === 'V') return { label: '*', color: 'dark:text-zinc-400 text-zinc-500 font-bold' };
          
          // Fallbacks for non-strict matches
          if (Math.abs(val - h) <= tol) return { label: 'H', color: 'dark:text-white text-zinc-900 font-bold' };
          if (Math.abs(val - o) <= tol) return { label: 'O', color: 'dark:text-zinc-400 text-zinc-600' };
          if (val <= h * 0.4) return { label: '*', color: 'dark:text-zinc-400 text-zinc-500 font-bold' };
          
          return { label: '?', color: 'dark:text-gray-500 text-gray-500' };
      } else {
          // Lowercase Logic (n, o, >n, <o, *)
          const { nLsb, nRsb, o } = masters;
          
          if (type === 'S') {
               // Expect nStem
               if (Math.abs(val - nLsb) <= tol) return { label: 'n', color: 'dark:text-white text-zinc-900 font-bold' };
               if (val > nLsb) return { label: '>n', color: 'dark:text-zinc-300 text-zinc-700' };
          }
          if (type === 'A') {
               // Expect nArch
               if (Math.abs(val - nRsb) <= tol) return { label: 'n', color: 'dark:text-gray-400 text-gray-600' };
          }
          if (type === 'R') {
               // Expect o
               if (Math.abs(val - o) <= tol) return { label: 'o', color: 'dark:text-zinc-400 text-zinc-600' };
               if (val < o) return { label: '>o', color: 'dark:text-zinc-400 text-zinc-600' };
          }
          if (type === 'V') {
              return { label: '*', color: 'dark:text-zinc-400 text-zinc-500 font-bold' };
          }

          // Visual Fallbacks
          if (Math.abs(val - nLsb) <= tol) return { label: 'n', color: 'dark:text-white text-zinc-900 font-bold' };
          if (Math.abs(val - nRsb) <= tol) return { label: 'n', color: 'dark:text-gray-400 text-gray-600' };
          if (Math.abs(val - o) <= tol) return { label: 'o', color: 'dark:text-zinc-400 text-zinc-600' };
          
          return { label: '●', color: 'text-gray-600 dark:text-gray-500' }; 
      }
  };

  if (!font || !font.fontObj) {
      return <div className="p-4 dark:text-gray-500 text-gray-500 text-base">Dados da fonte não disponíveis para {method === MethodType.TRACY ? 'Tracy' : 'Sousa'}</div>;
  }

  if (filteredChars.length === 0) return null;

  return (
    <div className="mb-8">
        <h4 className={`text-base font-bold uppercase mb-4 tracking-wider flex items-center gap-2 ${methodColor}`}>
             <div className={`w-2 h-2 rounded-full ${styles.bg}`}></div>
             {getMethodName()} — Análise de {category === 'Uppercase' ? 'Maiúsculas' : 'Minúsculas'}
        </h4>
        
        {/* Comparison Legend */}
        {category === 'Uppercase' && method === MethodType.TRACY && (
             <div className="flex flex-wrap gap-4 mb-4 text-xs uppercase font-bold tracking-wider dark:bg-zinc-900/60 bg-zinc-100/80 p-2.5 rounded-xl border dark:border-zinc-800 border-zinc-300 items-center justify-between lg:justify-start lg:gap-8">
                 <span className="flex items-center gap-1.5"><span className="dark:text-white text-zinc-900 font-mono font-bold">H</span> = Reta</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-400 text-zinc-600 font-mono font-bold">O</span> = Circular</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-300 text-zinc-700 font-mono">&gt;H</span> / <span className="dark:text-zinc-300 text-zinc-700 font-mono">&lt;H</span> = Reta Ajustada</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-400 text-zinc-500 font-mono font-bold">*</span> = Mínimo/Visual</span>
             </div>
        )}
        
        {category === 'Lowercase' && method === MethodType.TRACY && (
             <div className="flex flex-wrap gap-4 mb-4 text-xs uppercase font-bold tracking-wider dark:bg-zinc-900/60 bg-zinc-100/80 p-2.5 rounded-xl border dark:border-zinc-800 border-zinc-300 items-center justify-between lg:justify-start lg:gap-8">
                 <span className="flex items-center gap-1.5"><span className="dark:text-white text-zinc-900 font-mono font-bold">n</span> = Haste</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-400 text-zinc-600 font-mono font-bold">n</span> = Arco</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-400 text-zinc-600 font-mono font-bold">o</span> = Circular</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-300 text-zinc-700 font-mono">&gt;n</span> = &gt; Haste</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-300 text-zinc-700 font-mono">&lt;o</span> = &lt; Circular</span>
                 <span className="flex items-center gap-1.5"><span className="dark:text-zinc-400 text-zinc-500 font-mono font-bold">*</span> = Mínimo</span>
                 <span className="flex items-center gap-1.5"><span className="text-gray-600 dark:text-gray-500 font-mono">●</span> = Visual</span>
             </div>
        )}

        <div className=" grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 gap-4">
            {filteredChars.map(char => {
                const { lsb, rsb } = getCharMetrics(font.fontObj, char);
                const lInfo = getLabel(char, 'l', lsb);
                const rInfo = getLabel(char, 'r', rsb);

                return (
                    <div 
                        key={char} 
                        onClick={() => onGlyphClick?.(char, lsb, rsb)}
                        className={`dark:bg-gray-800/50 bg-gray-200/50 rounded h-20  p-1 flex items-center border ${borderClass} dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors group relative cursor-pointer`}
                    >
                        {/* Left SB */}
                        <div className="min-w-[30px] px-2 flex-1 flex flex-col items-center justify-center h-full border-r dark:border-gray-700/30 border-gray-300/30">
                            <span className={`text-xs ${lInfo.color} font-bold mb-0.5 leading-none`}>{lInfo.label}</span>
                            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-mono leading-none">{lsb}</span>
                        </div>

                        {/* Character (Fixed Width for Alignment) */}
                        <div 
                            className="w-16 text-3xl md:text-4xl dark:text-white text-slate-900 text-center flex items-center justify-center leading-none pb-1"
                            style={{ fontFamily: `'${fontFamily}'` }}
                        >
                            {char}
                        </div>

                        {/* Right SB */}
                        <div className="min-w-[30px] px-2 flex-1  flex flex-col items-center justify-center h-full border-l dark:border-gray-700/30 border-gray-300/30">
                            <span className={`text-xs ${rInfo.color} font-bold mb-0.5 leading-none`}>{rInfo.label}</span>
                            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-mono leading-none">{rsb}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};
