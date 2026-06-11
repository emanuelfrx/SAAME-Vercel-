
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from './useTheme';
import { TracySettings, FontState, MethodType } from '../types';
import { Layers, Type, AlignJustify, AlignLeft, AlignCenter, AlignRight, Download, BarChart2, Columns, ArrowUpDown, FileText, Loader2, Search, X, Edit2 } from 'lucide-react';
import { calculateAverageSB, downloadFont, getCharMetrics, generateFontFaceCSS } from '../services/fontService';
import { motion, AnimatePresence } from 'motion/react';
import { SpacingDiagram } from './SpacingDiagram';
import { SousaAnalysisView } from './SousaAnalysisView';
import { GlyphVisualizer } from './GlyphVisualizer';
import { SequenceVisualizer } from './SequenceVisualizer';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { useDebounce } from './useDebounce';

// --- NEW COMPONENT: Skeleton Screen for loading/processing states ---
const AnalysisSkeleton = () => (
    <div className="w-full animate-pulse space-y-8 p-4 md:p-8">
        <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800/50 h-16 rounded-2xl mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
                <div className="h-64 bg-slate-100 dark:bg-slate-800/20 rounded-2xl" />
            </div>
            <div className="space-y-4">
                <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
                <div className="h-64 bg-slate-100 dark:bg-slate-800/20 rounded-2xl" />
            </div>
        </div>
        <div className="space-y-4">
            <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/30 rounded-xl" />
                ))}
            </div>
        </div>
    </div>
);

interface AnalysisCanvasProps {
  fonts: Record<string, FontState | null>;
  isCompareMode?: boolean;
  customLabels?: {
      original: string;
      tracy: string;
  };
  onUpdateGlyph?: (method: MethodType, char: string, lsb: number | null, rsb: number | null) => void;
  selectedChar: string;
  onCharSelect: (char: string) => void;
  lastEditedMethod: MethodType;
}

const PARAGRAPH_TEXT = "Hook, a do. Joe, succor asclepias cod efferent. Fans rolls, oceania leets boise sentimentalisation, geologian pedicels, plowtail, dip em kinins tetracerous, non a revisal, at. Clamer goon, downstrokes imputative blip ballonne, yakin ouenite, he. Em arapunga, oat, a feud. Palaeoclimatologist, a ten noncrucial a to, rauli, a sirky, coy, if, pour my xmas. Hew, wisher seventy. Conducts, ya note, algic. Iricism, mil, swob groundling, koruny, hi lode, overwoman, shrive. Educate am fractocumulus, they tempt. Us goloe, offic, wammus, luminescing. Wow, relighted. Veracious glacon, seed, dram bat oral sgabellos noviceship, age neo cant bethorn, cirri nondepressed laserdisks, mom owl, fall. Multicordate, is, splint chremzel a he, kodak, acre, yokel, pope kong. A mojarra, savant, dredges, squattest ye. Plonked algologist, sip citrin. us gimp, woke, congressing.";
const FULL_SET_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\n!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

const RemainingGlyphItem = React.memo(({ g, font, borderColor, onClick }: { g: any, font: any, borderColor: string, onClick?: (char: string, lsb: number, rsb: number) => void }) => (
    <div 
        key={g.unicode} 
        onClick={() => onClick?.(g.char, g.lsb, g.rsb)}
        className={`dark:bg-gray-800/30 bg-gray-200/30 rounded h-16 p-1 flex items-center border ${borderColor} dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors cursor-pointer`}
    >
        <div className="flex-1 flex flex-col items-center justify-center h-full border-r dark:border-gray-700/30 border-gray-300/30">
            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-bold mb-0.5 leading-none">L</span>
            <span className="text-[11px] dark:text-gray-300 text-gray-700 font-mono leading-none">{g.lsb}</span>
        </div>
        <div 
            className="w-10 text-2xl dark:text-white text-slate-900 text-center flex items-center justify-center leading-none pb-1"
            style={{ fontFamily: `'${font.fullFontFamily}'` }}
        >
            {/* Special visualization for Space */}
            {g.char === ' ' ? <span className="text-xs dark:text-gray-500 text-gray-500 font-mono">SPACE</span> : g.char}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center h-full border-l dark:border-gray-700/30 border-gray-300/30">
            <span className="text-[11px] dark:text-gray-500 text-gray-500 font-bold mb-0.5 leading-none">R</span>
            <span className="text-[11px] dark:text-gray-300 text-gray-700 font-mono leading-none">{g.rsb}</span>
        </div>
    </div>
));

// --- NEW COMPONENT: Displays metrics for glyphs NOT in the standard topology (Numbers, Punctuation, etc.) ---
const RemainingGlyphsView = React.memo(({ font, method, searchQuery = '', onGlyphClick }: { font: FontState | null, method: MethodType, searchQuery?: string, onGlyphClick?: (char: string, lsb: number, rsb: number) => void }) => {
    const [displayLimit, setDisplayLimit] = useState(60);
    
    // Reset limit when searchQuery changes
    useEffect(() => {
        setDisplayLimit(60);
    }, [searchQuery]);

    const glyphs = useMemo(() => {
        if (!font || !font.fontObj) return [];
        
        const found: Array<{ char: string, lsb: number, rsb: number, unicode: number }> = [];
        const seen = new Set<string>();
        
        const standardLatinChars = new Set([
            ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(''),
            ..."abcdefghijklmnopqrstuvwxyz".split('')
        ]);
        
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
                    if (char && (char.trim() !== '' || char === ' ')) {
                        if (!seen.has(char)) {
                            seen.add(char);
                            
                            const isLetter = char.toLowerCase() !== char.toUpperCase();
                            const isStandardLatin = standardLatinChars.has(char);
                            
                            // For Sousa, since it has hardcoded A-Z/a-z groups, we show other letters in complementary
                            // For other methods, cased letters are already dynamically renderable in SpacingDiagram, so exclude here
                            const shouldInclude = method === MethodType.SOUSA 
                                ? !isStandardLatin 
                                : !isLetter;
                                
                            if (shouldInclude) {
                                found.push({ char, lsb: 0, rsb: 0, unicode: uni });
                            }
                        }
                    }
                } catch (e) {}
            }
        }
        
        // Filter by searchQuery
        const filtered = searchQuery 
            ? found.filter(g => 
                g.char.toLowerCase().includes(searchQuery.toLowerCase()) || 
                g.unicode.toString(16).toLowerCase().includes(searchQuery.toLowerCase())
              )
            : found;

        return filtered.sort((a, b) => a.unicode - b.unicode);
    }, [font?.fontObj, method, searchQuery]);

    if (!font || !font.fontObj || glyphs.length === 0) return null;

    const visibleGlyphs = glyphs.slice(0, displayLimit).map(g => {
        // Calculate metrics only for visible subset
        const { lsb, rsb } = getCharMetrics(font.fontObj!, g.char);
        return { ...g, lsb, rsb };
    });

    const getStyles = () => {
        switch(method) {
            case MethodType.TRACY: return { color: 'text-pink-400', border: 'border-pink-500/20' };
            case MethodType.SOUSA: return { color: 'text-cyan-400', border: 'border-cyan-500/20' };
            case MethodType.ORIGINAL_CUSTOM: return { color: 'text-blue-400', border: 'border-blue-500/20' };
            default: return { color: 'dark:text-slate-400 text-slate-600', border: 'border-slate-500/20' };
        }
    };

    const styles = getStyles();
    const methodColor = styles.color;
    const borderColor = styles.border;

    return (
        <div className="mt-8 pt-6 border-t dark:border-gray-800 border-gray-200">
             <h4 className={`text-sm font-black uppercase mb-4 tracking-widest flex items-center gap-2 ${methodColor}`}>
                 {glyphs.length} Glifos Complementares
                 {searchQuery && <span className="text-[10px] opacity-60 font-mono">(Filtro Ativo)</span>}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
                {visibleGlyphs.map(g => (
                    <RemainingGlyphItem key={g.unicode} g={g} font={font} borderColor={borderColor} onClick={onGlyphClick} />
                ))}
            </div>
            {glyphs.length > displayLimit && (
                <div className="mt-6 flex justify-center">
                    <button 
                        onClick={() => setDisplayLimit(prev => prev + 120)}
                        className="px-6 py-2 rounded-full border dark:border-gray-700 border-gray-300 dark:text-gray-400 text-gray-600 text-xs font-bold uppercase tracking-wider hover:bg-gray-800 hover:text-white transition-all"
                    >
                        Carregar mais {Math.min(120, glyphs.length - displayLimit)} glifos...
                    </button>
                </div>
            )}
        </div>
    );
});

// --- NEW CONST: Glyph Derivatives for Linked Metrics ---
const GLYPH_DERIVATIVES: Record<string, string[]> = {
    'n': ['m', 'h', 'u', 'l'],
    'o': ['c', 'e'],
    'H': ['I', 'L'],
    'O': ['C', 'G']
};

interface RenderedTextProps {
    text: string;
    baseChar: string | null;
    isOutline?: boolean;
    outlineColor?: string;
}

const RenderedText = ({ text, baseChar, isOutline, outlineColor }: RenderedTextProps) => {
    if (!baseChar) return <>{text}</>;
    
    const derivatives = GLYPH_DERIVATIVES[baseChar] || [];
    const lowerBaseChar = baseChar.toLowerCase();
    const upperBaseChar = baseChar.toUpperCase();
    const allBaseChars = [lowerBaseChar, upperBaseChar];
    const allDerivatives = derivatives.flatMap(d => [d.toLowerCase(), d.toUpperCase()]);
    
    const hasTargetChar = text.split('').some(char => allBaseChars.includes(char) || allDerivatives.includes(char));
    if (!hasTargetChar) return <>{text}</>;
    
    return (
        <>
            {text.split('').map((char, i) => {
                const isBase = allBaseChars.includes(char);
                const isDerived = allDerivatives.includes(char);
                
                if (isBase || isDerived) {
                    const colorClass = isBase ? 'text-pink-500 font-bold underline decoration-pink-500/30' : 'text-blue-500 font-bold underline decoration-blue-500/30';
                    
                    if (isOutline) {
                        return (
                            <span 
                                key={i} 
                                style={{ 
                                    WebkitTextStroke: `1.2px ${isBase ? '#EC4899' : '#3B82F6'}`,
                                    color: 'transparent'
                                }}
                            >
                                {char}
                            </span>
                        );
                    }
                    
                    return <span key={i} className={colorClass}>{char}</span>;
                }
                return char;
            })}
        </>
    );
};

// --- NEW CONSTS: Pre-defined Text and Word Presets for Variations ---
const SIDE_BY_SIDE_PRESETS = [
    {
        label: "Padrão",
        text: "Hook, a do. Joe, succor asclepias cod efferent. Fans rolls, oceania leets boise sentimentalisation, geologian pedicels, plowtail, dip em kinins tetracerous, non a revisal, at. Clamer goon, downstrokes imputative blip ballonne, yakin ouenite, he. Em arapunga, oat, a feud. Palaeoclimatologist, a ten noncrucial a to, rauli, a sirky, coy, if, pour my xmas.",
        fontSize: 30
    },
    {
        label: "Pangrama PT-BR",
        text: "O rápido afluxo de jovens ao belo porto de Coimbra deu em resultado uma interessante e viva tertúlia. À noite, vovô Secundino, cambaleante por causa do vinho, deu um soco no gato poliglota, que assustado fugiu sem olhar para trás.",
        fontSize: 28
    },
    {
        label: "Lorem Ipsum",
        text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam id finibus elit, ac vulputate justo. Sed feugiat purus id elementum tristique. Suspendisse pulvinar erat sit amet tristique imperdiet. Duis pellentesque tempor convallis.",
        fontSize: 26
    },
    {
        label: "Frases Curtas",
        text: "Design e Tecnologia trabalhando juntos.\nA tipografia expressa a voz da palavra escrita.\nEstética, legibilidade e ritmo visual harmonioso.\nO espaço em branco é uma ferramenta ativa na mancha de texto.",
        fontSize: 32
    },
    {
        label: "Ritmo e Textura (nn/oo)",
        text: "nonononon ooonooonoo nnoonnoonn nnoonnoonn\nhhababhbah ooeoeoeoeo lillillill ppuupupupu\nnuunnuunnu ddbbddbbdd qqpqpqpqpq ssassassas\nHHOOHOH nnnoonon HHOHHOH nnonnon minimum",
        fontSize: 28
    },
    {
        label: "Todo o Conjunto",
        text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\n!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
        fontSize: 32
    }
];

const OVERLAY_PRESETS = [
    {
        label: "Controle H/O/n/o",
        text: "HHOOHOH\nnnoonon\nHHOHHOH\nnnonnon",
        fontSize: 150
    },
    {
        label: "Ranhura de Hastes (minimum)",
        text: "minimum\nilluminate\nmillennium\naluminum\nautumn\nlimiting\nmillion",
        fontSize: 130
    },
    {
        label: "Ascendentes / Descendentes",
        text: "groundling\nOverwoman\nPalaeoclimatologist\nSuperconductivity\nbreakthrough\nphotographic",
        fontSize: 110
    },
    {
        label: "Olhos Circulares",
        text: "grotesque\ncooperate\neconological\nundone\nmonospaced\ncorrelation",
        fontSize: 130
    },
    {
        label: "Palavras Mistas",
        text: "Typography\nTypeface\nKerning\nSpacing\nMetrical\nLab",
        fontSize: 120
    },
    {
        label: "Somente Caixa Alta",
        text: "TYPOGRAPHY\nSPACING\nMETRICS\nLABORATORY\nKERNED",
        fontSize: 120
    }
];

export const AnalysisCanvas: React.FC<AnalysisCanvasProps> = ({ fonts, isCompareMode = false, customLabels, onUpdateGlyph, selectedChar, onCharSelect, lastEditedMethod }) => {
  const { isDark } = useTheme();

  // Ensure we have at least one font loaded to display analysis
  const hasFonts = Object.values(fonts).some(f => !!f && !!f.fontObj);
  if (!hasFonts) return <AnalysisSkeleton />;

  const [testText, setTestText] = useState(PARAGRAPH_TEXT);
  const [analysisPreset, setAnalysisPreset] = useState<'paragraph' | 'words-overlay' | 'custom'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_analysis_preset') : null;
    if (saved && ['paragraph', 'words-overlay', 'custom'].includes(saved)) {
      return saved as any;
    }
    return 'paragraph';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_analysis_preset', analysisPreset);
  }, [analysisPreset]);

  const [fontSize, setFontSize] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_font_size') : null;
    return saved ? Number(saved) : 30;
  });
  const debouncedFontSize = useDebounce(fontSize, 300);

  React.useEffect(() => {
    localStorage.setItem('saame_font_size', fontSize.toString());
  }, [fontSize]);

  const [lineHeight, setLineHeight] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_line_height') : null;
    return saved ? Number(saved) : 1.5;
  });
  const debouncedLineHeight = useDebounce(lineHeight, 300);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right' | 'justify'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_text_align') : null;
    return saved && ['left', 'center', 'right', 'justify'].includes(saved) ? (saved as any) : 'left';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_text_align', textAlign);
  }, [textAlign]);

  React.useEffect(() => {
    localStorage.setItem('saame_line_height', lineHeight.toString());
  }, [lineHeight]);

  const [textCase, setTextCase] = useState<'normal' | 'uppercase' | 'lowercase'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_text_case') : null;
    return saved && ['normal', 'uppercase', 'lowercase'].includes(saved) ? (saved as any) : 'normal';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_text_case', textCase);
  }, [textCase]);

  const [viewMode, setViewMode] = useState<'stack' | 'overlay' | 'metrics' | 'side-by-side'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_view_mode') : null;
    if (saved && ['stack', 'overlay', 'metrics', 'side-by-side'].includes(saved)) {
      return saved as any;
    }
    return 'side-by-side';
  });

  React.useEffect(() => {
    localStorage.setItem('saame_view_mode', viewMode);
  }, [viewMode]);
  const [selectedDiagramMethod, setSelectedDiagramMethod] = useState<MethodType>(lastEditedMethod);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isReportExportModalOpen, setIsReportExportModalOpen] = useState(false);
  const [reportFileName, setReportFileName] = useState("");
  const [hasVisitedOverlay, setHasVisitedOverlay] = useState(false);

  useEffect(() => {
    if (viewMode === 'overlay' && !hasVisitedOverlay) {
      setTestText("HHOOHOH\nnnoonon\nminimum\nOverwoman\ngroundling\nPalaeoclimatologist");
      setFontSize(150);
      setAnalysisPreset('words-overlay');
      setHasVisitedOverlay(true);
    }
  }, [viewMode, hasVisitedOverlay]);

  const [searchQuery, setSearchQuery] = useState('');
  
  // --- New State for Font Export Modal ---
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [exportMethodType, setExportMethodType] = useState<MethodType | null>(null);
  
  // Memoize search query update for performance
  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const [selectedAdjustment, setSelectedAdjustment] = useState<{
    char: string,
    method: MethodType,
    lsb: number,
    rsb: number
  } | null>(null);

  const toggleAdjustment = React.useCallback((char: string, lsb: number, rsb: number, method: MethodType) => {
      setSelectedAdjustment({ char, method, lsb, rsb });
      onCharSelect(char);
  }, [onCharSelect]);
  const [modalTestText, setModalTestText] = useState<string>('');
  const [isModalEditing, setIsModalEditing] = useState(false);

  const processedText = React.useMemo(() => {
    if (textCase === 'uppercase') return testText.toUpperCase();
    if (textCase === 'lowercase') return testText.toLowerCase();
    return testText;
  }, [testText, textCase]);
  const [rawActiveMethods, setRawActiveMethods] = useState<MethodType[]>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('saame_comparison_methods') : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      MethodType.ORIGINAL,
      MethodType.ORIGINAL_CUSTOM,
      MethodType.TRACY,
      MethodType.SOUSA
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('saame_comparison_methods', JSON.stringify(rawActiveMethods));
  }, [rawActiveMethods]);

  const activeMethods = isCompareMode ? [MethodType.ORIGINAL, MethodType.TRACY] : rawActiveMethods;

  const toggleMethod = (method: MethodType) => {
    setRawActiveMethods(prev => {
        if (prev.includes(method)) {
            if (prev.length === 1) return prev; // Keep at least one
            return prev.filter(m => m !== method);
        }
        return [...prev, method].sort((a, b) => {
            const order = [MethodType.ORIGINAL, MethodType.ORIGINAL_CUSTOM, MethodType.TRACY, MethodType.SOUSA];
            return order.indexOf(a) - order.indexOf(b);
        });
    });
  };

  // Reset modal state on character change
  React.useEffect(() => {
    if (selectedAdjustment) {
      const isUpper = selectedAdjustment.char === selectedAdjustment.char.toUpperCase() && selectedAdjustment.char !== selectedAdjustment.char.toLowerCase();
      setModalTestText(isUpper ? `HH${selectedAdjustment.char}HH, OO${selectedAdjustment.char}OO` : `nn${selectedAdjustment.char}nn, oo${selectedAdjustment.char}oo`);
      setIsModalEditing(false);
    }
  }, [selectedAdjustment?.char]);

  const exportRef = useRef<HTMLDivElement>(null);
  
  const originalFont = fonts[MethodType.ORIGINAL];
  const tracyFont = fonts[MethodType.TRACY];
  const sousaFont = fonts[MethodType.SOUSA];

  // Logic to determine labels based on mode and props
  const labelOriginal = isCompareMode 
    ? (customLabels?.original || 'Referência Original') 
    : (originalFont?.fullFontFamily || 'Original');
    
  const labelTracy = isCompareMode 
    ? (customLabels?.tracy || 'Espécime Ajustado') 
    : "Método Walter Tracy";

  const handleExport = (type: MethodType) => {
      const fontState = fonts[type];
      if (fontState?.fontObj) {
          // Attempt to get the real original font name from the ORIGINAL state
          const originalName = fonts[MethodType.ORIGINAL]?.fontObj?.names?.fontFamily?.en || 'Font';
          
          // Improved nomenclature prefixes (Trace/Souza as requested for better organization)
          const prefix = type === MethodType.TRACY ? 'Trace' : 
                         type === MethodType.SOUSA ? 'Souza' : 
                         type === MethodType.ORIGINAL_CUSTOM ? 'Manual' : '';
          
          // Construct default suggested name preserving original name + prefix
          const defaultName = prefix ? `${prefix}_${originalName.replace(/\s/g, '_')}` : originalName.replace(/\s/g, '_');
          
          setExportMethodType(type);
          setExportFileName(defaultName);
          setIsExportModalOpen(true);
      }
  };

  const confirmExport = () => {
      if (exportMethodType && exportFileName) {
          const fontState = fonts[exportMethodType];
          if (fontState?.fontObj) {
              downloadFont(fontState.fontObj, exportMethodType, exportFileName);
              setIsExportModalOpen(false);
          }
      }
  };

  const confirmReportExport = () => {
      if (reportFileName) {
          handlePdfExport(reportFileName);
          setIsReportExportModalOpen(false);
      }
  };

  const avgSBs = useMemo(() => {
    const results: Record<string, number> = {};
    Object.entries(fonts).forEach(([type, f]) => {
        if (f?.fontObj) results[type] = calculateAverageSB(f.fontObj);
    });
    return results;
  }, [fonts]);

  const getAvgSB = (type: MethodType) => {
      return avgSBs[type] || 0;
  };

  const setPreset = (text: string, size: number, presetType: 'paragraph' | 'words-overlay') => {
      setTestText(text);
      setFontSize(size);
      setAnalysisPreset(presetType);
  };

  // --- PRECISE METRIC CALCULATIONS ---
  const cachedMetrics = useMemo(() => {
      // Default fallback
      const empty = { 
          grid: '', 
          gridLight: '',
          lhPx: fontSize * lineHeight, 
          refBaseline: 0, 
          expCorrectionY: 0 
      };

      if (!originalFont?.metrics) return empty;

      // 1. Constants
      const LH_RATIO = lineHeight;
      const lhPx = fontSize * LH_RATIO;
      
      // 2. Reference Metrics (The Source of Truth for the Grid)
      const refM = originalFont.metrics;
      const safeRefUPM = refM.unitsPerEm || 1000; 
      const refScale = fontSize / safeRefUPM;
      
      const refContentH = (refM.ascender + Math.abs(refM.descender)) * refScale;
      const refLeading = lhPx - refContentH;
      const refBaselineY = (refLeading / 2) + (refM.ascender * refScale);

      // Grid Coordinates (Aligned to Reference)
      const gridY = {
          asc: refBaselineY - (refM.ascender * refScale),
          cap: refBaselineY - (refM.capHeight * refScale),
          x: refBaselineY - (refM.xHeight * refScale),
          base: refBaselineY,
          desc: refBaselineY + (Math.abs(refM.descender) * refScale)
      };

      // 3. Calculate Individual Offsets for each method in Overlay Mode
      const calculateOffset = (fM: any) => {
          if (!fM) return 0;
          const safeUPM = fM.unitsPerEm || 1000;
          const scale = fontSize / safeUPM;
          const naturalBaselineY = ( (lhPx - (fM.ascender + Math.abs(fM.descender)) * scale) / 2) + (fM.ascender * scale);
          return Math.round(refBaselineY - naturalBaselineY);
      };

      const offsets = {
          [MethodType.ORIGINAL]: 0,
          [MethodType.ORIGINAL_CUSTOM]: calculateOffset(fonts[MethodType.ORIGINAL_CUSTOM]?.metrics),
          [MethodType.TRACY]: calculateOffset(tracyFont?.metrics),
          [MethodType.SOUSA]: calculateOffset(sousaFont?.metrics)
      };

      // Helper to generate SVG string (DRY)
      const generateSVG = (isLightMode: boolean) => {
          const colors = isLightMode ? {
               asc: '#d97706', // Darker Yellow
               cap: '#15803d', // Darker Green
               x: '#1d4ed8',   // Darker Blue
               base: '#000000', // BLACK Baseline
               desc: '#b91c1c', // Darker Red
               lbl: '#4b5563', // Gray 600
               refLine: 'rgba(0,0,0,0.3)'
          } : {
               asc: '#EAB308',
               cap: '#22C55E',
               x: '#3B82F6',
               base: '#FFFFFF',
               desc: '#EF4444',
               lbl: 'rgba(255, 255, 255, 0.4)',
               refLine: 'rgba(255, 255, 255, 0.2)'
          };

          if (isCompareMode) {
            return `
                <svg width="100%" height="${lhPx}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
                    <style>
                        .line { stroke-width: 0.5px; vector-effect: non-scaling-stroke; stroke-dasharray: 4 2; opacity: 0.5; }
                        .base { stroke-width: 0.8px; stroke-dasharray: none; opacity: 0.7; }
                    </style>
                    <line x1="0" y1="${gridY.asc}" x2="100%" y2="${gridY.asc}" class="line" stroke="${colors.asc}" />
                    <line x1="0" y1="${gridY.cap}" x2="100%" y2="${gridY.cap}" class="line" stroke="${colors.cap}" />
                    <line x1="0" y1="${gridY.x}" x2="100%" y2="${gridY.x}" class="line" stroke="${colors.x}" />
                    <line x1="0" y1="${gridY.base}" x2="100%" y2="${gridY.base}" class="base" stroke="${colors.base}" />
                    <line x1="0" y1="${gridY.desc}" x2="100%" y2="${gridY.desc}" class="line" stroke="${colors.desc}" />
                </svg>
            `;
          } else {
             return `
                <svg width="100%" height="${lhPx}" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision">
                    <defs>
                        <style>
                            .txt { font-family: 'Fira Code', monospace; font-size: 8px; font-weight: 500; }
                            .line { stroke-width: 0.5px; vector-effect: non-scaling-stroke; }
                            .ref { stroke: ${colors.refLine}; stroke-dasharray: 2 2; }
                            .lbl { fill: ${colors.lbl}; }
                            .base { stroke: ${isLightMode ? 'rgba(8, 145, 178, 1)' : 'rgba(6, 182, 212, 0.7)'}; stroke-width: 0.8px; } 
                        </style>
                    </defs>
                    <line x1="0" y1="${gridY.asc}" x2="100%" y2="${gridY.asc}" class="line ref" />
                    <text x="4" y="${gridY.asc + 8}" class="txt lbl">ASC</text>

                    <line x1="0" y1="${gridY.cap}" x2="100%" y2="${gridY.cap}" class="line ref" />
                    <text x="28" y="${gridY.cap + 8}" class="txt lbl">CAP</text>

                    <line x1="0" y1="${gridY.x}" x2="100%" y2="${gridY.x}" class="line ref" />
                    <text x="4" y="${gridY.x - 3}" class="txt lbl">x-Height</text>

                    <line x1="0" y1="${gridY.base}" x2="100%" y2="${gridY.base}" class="line base" />
                    <text x="4" y="${gridY.base - 3}" class="txt lbl" style="fill: ${isLightMode ? 'rgba(8, 145, 178, 1)' : 'rgba(6, 182, 212, 0.8)'}">BASE</text>

                    <line x1="0" y1="${gridY.desc}" x2="100%" y2="${gridY.desc}" class="line ref" />
                    <text x="4" y="${gridY.desc - 3}" class="txt lbl">DESC</text>
                </svg>
            `;
          }
      };

      const svgDark = generateSVG(false);
      const svgLight = generateSVG(true);

      return {
          grid: isDark ? `url("data:image/svg+xml;utf8,${encodeURIComponent(svgDark.replace(/\s+/g, ' ').trim())}")` : `url("data:image/svg+xml;utf8,${encodeURIComponent(svgLight.replace(/\s+/g, ' ').trim())}")`,
          gridLight: `url("data:image/svg+xml;utf8,${encodeURIComponent(svgLight.replace(/\s+/g, ' ').trim())}")`,
          lhPx,
          refBaseline: refBaselineY,
          offsets
      };
  }, [fonts, originalFont?.metrics, tracyFont?.metrics, sousaFont?.metrics, fontSize, lineHeight, isDark, isCompareMode]);

  const { grid, gridLight, offsets } = cachedMetrics;

  const fontFacesCSS = useMemo(() => {
    return Object.values(fonts)
        .filter((f): f is FontState => !!f)
        .map(f => generateFontFaceCSS(f))
        .join('\n');
  }, [fonts]);

  const handlePdfExport = async (nameArg?: string) => {
    if (!exportRef.current) return;
    
    // Explicitly check if nameArg is a string to avoid React event objects crashing endsWith
    const customName = typeof nameArg === 'string' ? nameArg : undefined;
    
    if (!customName) {
      const dateStr = new Date().toISOString().split('T')[0];
      const viewStr = viewMode === 'side-by-side' ? 'Comparacao' : 'Sobreposicao';
      const originalName = fonts[MethodType.ORIGINAL]?.fontObj?.names?.fontFamily?.en?.replace(/\s/g, '_') || 'Fonte';
      
      const defaultName = `Relatorio_${originalName}_${viewStr}_${dateStr}`;
      setReportFileName(defaultName);
      setIsReportExportModalOpen(true);
      return;
    }

    setIsExportingPdf(true);
    setIsReportExportModalOpen(false);

    try {
        // 1. Calculate dynamic scale to prevent "Invalid canvas data" (too big canvas)
        const elementArea = exportRef.current.scrollWidth * exportRef.current.scrollHeight;
        let exportScale = 2.0; // Balanced default quality
        
        // Optimize for stability on large layouts (staying within browser canvas limits)
        if (elementArea > 8000000) exportScale = 1.5;
        if (elementArea > 20000000) exportScale = 1.0;
        if (elementArea > 40000000) exportScale = 0.8;
        if (elementArea > 100000000) exportScale = 0.5;

        const canvas = await html2canvas(exportRef.current, {
            scale: exportScale, 
            useCORS: true,
            backgroundColor: '#ffffff', // FORCE WHITE BACKGROUND
            logging: false,
            // Ensure we capture everything with generous buffers
            windowWidth: exportRef.current.scrollWidth + 300,
            height: null, 
            onclone: (clonedDoc) => {
                const element = clonedDoc.querySelector('[data-export-target="true"]') as HTMLElement;
                if (element) {
                    // Force the width to ensure text doesn't wrap differently in the clone
                    element.style.width = `${exportRef.current.scrollWidth}px`;
                    
                    // --- FORCE LIGHT MODE STYLES FOR EXPORT ---
                    element.style.backgroundColor = '#ffffff';
                    element.style.color = '#000000';
                    element.style.height = 'auto'; // FORCE FULL HEIGHT
                    element.style.overflow = 'visible'; // SHOW ALL TEXT
                    element.style.maxHeight = 'none';

                    // --- OVERLAY MODE SPECIFIC FIXES ---
                    if (viewMode === 'overlay') {
                        const overlayMaster = element.querySelector('.overlay-height-master') as HTMLElement;
                        const masterP = overlayMaster?.querySelector('p');
                        
                        // Force parent to show relative positioning for height calculation
                        element.style.position = 'relative';
                        element.style.display = 'block';

                        if (overlayMaster) {
                           overlayMaster.style.opacity = '1';
                           overlayMaster.style.visibility = 'visible';
                           overlayMaster.style.position = 'relative';
                           overlayMaster.style.display = 'block';
                           overlayMaster.style.width = '100%';
                        }

                        // Calculate height based on the reference text content
                        if (masterP) {
                            // Ensure the master P is expanded properly
                            masterP.style.height = 'auto';
                            masterP.style.overflow = 'visible';
                            masterP.style.whiteSpace = 'pre-wrap';
                            masterP.style.wordBreak = 'break-word';
                            const calcHeight = masterP.getBoundingClientRect().height || masterP.offsetHeight;
                            element.style.minHeight = `${calcHeight + 400}px`; // Generous bottom padding
                            element.style.height = 'auto';
                        }
                    }

                    // For both modes: Expand inner containers
                    const containers = element.querySelectorAll('div');
                    containers.forEach(div => {
                        if (div.classList.contains('overflow-auto') || div.classList.contains('overflow-y-auto')) {
                            div.style.overflow = 'visible';
                            div.style.height = 'auto';
                            div.style.maxHeight = 'none';
                        }
                    });

                    // --- GENERAL STYLING FOR PDF (WHITE BG) ---
                    // Specific Handling for Side-by-Side Text Colors
                    const textElements = element.querySelectorAll('p, h4, span, div');
                    textElements.forEach((el) => {
                         const style = window.getComputedStyle(el);
                         // If it's a grid overlay div (has background image), swap to Light Grid
                         if ((el as HTMLElement).style.backgroundImage && (el as HTMLElement).style.backgroundImage.includes('data:image/svg')) {
                             (el as HTMLElement).style.backgroundImage = gridLight;
                             return;
                         }

                         // If text is white/gray (light), force it to black/dark gray
                         const color = style.color;
                         if (color.startsWith('rgb(2') || color === 'white' || color.includes('255, 255') || color.includes('209, 213')) {
                             (el as HTMLElement).style.color = '#111827'; // gray-900
                         }
                    });

                    // Remove borders or make them light gray
                    const bordered = element.querySelectorAll('.border-gray-800, .border-gray-700, .bg-gray-900');
                    bordered.forEach(el => {
                        el.classList.remove('dark:bg-gray-900 bg-gray-100', 'dark:bg-gray-800 bg-gray-200', 'dark:bg-gray-950 bg-gray-50');
                        el.classList.add('bg-white');
                        (el as HTMLElement).style.borderColor = '#e5e7eb'; // gray-200
                        (el as HTMLElement).style.backgroundColor = '#ffffff';
                    });

                    // --- FONT STAIN RENDERING ---
                    if (viewMode === 'overlay') {
                        const allPs = element.querySelectorAll('p');
                        allPs.forEach(p => {
                            // Check if this P is in a relative/absolute container that belongs to a method
                            const parent = p.parentElement;
                            const isReference = p.closest('.overlay-height-master') || (parent && parent.classList.contains('absolute') && !p.style.webkitTextStroke.includes('px'));
                            
                            if (isReference) {
                                // REFERENCE FONT (The "Stain")
                                // Matching lighter preview style (subtle but visible)
                                p.style.color = 'rgba(0, 0, 0, 0.055)'; 
                                p.style.webkitTextStroke = 'none';
                                p.style.opacity = '1';
                                p.style.visibility = 'visible';
                            } else {
                                // COMPARISON FONTS (Outlines)
                                p.style.color = 'transparent';
                                p.style.opacity = '1';

                                // Ensure strokes are crisp and not excessively thick in the export
                                if (p.style.webkitTextStroke && p.style.webkitTextStroke.includes('px')) {
                                    const strokeParts = p.style.webkitTextStroke.split(' ');
                                    const rawSize = parseFloat(strokeParts[0]);
                                    if (!isNaN(rawSize)) {
                                        // Compensate for PDF rendering bias towards thicker strokes
                                        p.style.webkitTextStroke = `${Math.max(0.3, rawSize * 0.7)}px ${strokeParts.slice(1).join(' ')}`;
                                    }
                                }
                            }
                        });
                    }
                    
                    // Re-position Legend for Print (Bottom of the content, not fixed to screen)
                    const legend = element.querySelector('.overlay-legend') as HTMLElement;
                    if (legend) {
                        legend.style.position = 'absolute';
                        legend.style.bottom = '10px';
                        legend.style.right = '10px';
                        legend.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
                        legend.style.borderColor = '#e5e7eb';
                        legend.style.color = '#000';
                        legend.style.boxShadow = 'none';
                        // Fix legend text colors
                        legend.querySelectorAll('.text-gray-300').forEach(el => (el as HTMLElement).style.color = '#000');
                        legend.querySelectorAll('.text-gray-400').forEach(el => (el as HTMLElement).style.color = '#4b5563');
                    }
                    
                    // Hide export buttons in the clone
                    const ignoreBtns = clonedDoc.querySelectorAll('button');
                    ignoreBtns.forEach(btn => btn.style.display = 'none');
                }
            }
        });

        // 2. Initialize PDF (Landscape A4)
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        const headerHeight = 40;

        // 3. Detailed Header Info (White bg, Black text for PDF cleanliness)
        pdf.setFillColor(255, 255, 255); 
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');

        pdf.setTextColor(0, 0, 0); // Black text
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("Relatório SAAME Typography Lab", margin, 10);
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(60, 60, 60); 
        const dateStr = new Date().toLocaleString();
        
        // Metadata Column 1
        pdf.text(`Data: ${dateStr}`, margin, 16);
        pdf.text(`Modo de Visualização: ${viewMode === 'side-by-side' ? 'Comparação Lado a Lado' : 'Sobreposição (Overlay)'}`, margin, 21);
        
        // Metadata Column 2 (Parameters)
        const col2X = margin + 80;
        pdf.text(`Tamanho da Fonte: ${fontSize}px`, col2X, 16);
        pdf.text(`Entrelinha: ${lineHeight}em`, col2X, 21);
        pdf.text(`Capitalização: ${textCase === 'uppercase' ? 'Caixa Alta' : textCase === 'lowercase' ? 'Caixa Baixa' : 'Normal'}`, col2X, 26);
        pdf.text(`Alinhamento: ${textAlign === 'left' ? 'Esquerda' : textAlign === 'center' ? 'Centralizado' : textAlign === 'right' ? 'Direita' : 'Justificado'}`, col2X, 31);
        
        // Metadata Column 3 (Legend)
        const col3X = margin + 140;
        pdf.setFont("helvetica", "bold");
        pdf.text("LEGENDA:", col3X, 16);
        pdf.setFont("helvetica", "normal");
        
        let legendY = 21;
        if (viewMode === 'overlay') {
            activeMethods.forEach((method) => {
                if (method === MethodType.ORIGINAL) {
                    pdf.setFillColor(150, 150, 150);
                    pdf.rect(col3X, legendY - 3, 3, 3, 'F');
                    pdf.text(`Original: ${labelOriginal.substring(0, 20)}`, col3X + 5, legendY);
                } else if (method === MethodType.ORIGINAL_CUSTOM) {
                    pdf.setDrawColor(59, 130, 246);
                    pdf.setLineWidth(0.5);
                    pdf.rect(col3X, legendY - 3, 3, 3, 'S');
                    pdf.text(`Ajuste Manual`, col3X + 5, legendY);
                } else if (method === MethodType.TRACY) {
                    pdf.setDrawColor(isCompareMode ? 6 : 236, isCompareMode ? 182 : 72, isCompareMode ? 212 : 153);
                    pdf.setLineWidth(0.5);
                    pdf.rect(col3X, legendY - 3, 3, 3, 'S');
                    pdf.text(`${isCompareMode ? 'Experimental' : 'Tracy'}: ${labelTracy.substring(0, 20)}`, col3X + 5, legendY);
                } else if (method === MethodType.SOUSA) {
                    pdf.setDrawColor(6, 182, 212);
                    pdf.setLineWidth(0.5);
                    pdf.rect(col3X, legendY - 3, 3, 3, 'S');
                    pdf.text(`Sousa`, col3X + 5, legendY);
                }
                legendY += 5;
            });
        } else {
             // Side-by-Side
             activeMethods.forEach((method, idx) => {
                 let label = "";
                 if (method === MethodType.ORIGINAL) label = `Original (${labelOriginal.substring(0, 15)})`;
                 else if (method === MethodType.ORIGINAL_CUSTOM) label = "Ajuste Manual";
                 else if (method === MethodType.TRACY) label = isCompareMode ? labelTracy : "Método Walter Tracy";
                 else if (method === MethodType.SOUSA) label = "Método Miguel Sousa";
                 
                 pdf.text(`Col ${idx + 1}: ${label}`, col3X, legendY);
                 legendY += 5;
             });
        }

        // 4. Add Image with Multi-Page Logic
        const imgData = canvas.toDataURL('image/jpeg', 0.85);
        if (!imgData || imgData === 'data:,') {
            console.error("Failed to generate PDF: Invalid canvas data");
            setIsExportingPdf(false);
            return;
        }
        const imgProps = pdf.getImageProperties(imgData);
        
        const availableWidth = pageWidth - (margin * 2);
        // Calculate the height the full image would take on the PDF
        const fullImgHeightOnPdf = (imgProps.height * availableWidth) / imgProps.width;
        
        let heightLeft = fullImgHeightOnPdf;
        let position = headerHeight; // Start after header
        let pageImgY = 0; // Where in the source image we are slicing from (conceptually)

        // First Page
        // If image fits on one page (minus header and footer margin)
        if (fullImgHeightOnPdf <= (pageHeight - headerHeight - margin)) {
             pdf.addImage(imgData, 'JPEG', margin, position, availableWidth, fullImgHeightOnPdf);
        } else {
             // Multi-page loop
             // We add the image, but shifted up for subsequent pages
             // Note: jsPDF addImage supports simple placement. For splitting a long canvas cleanly across pages without slicing manually, 
             // the standard trick is to add the same image with a negative Y offset on subsequent pages, masked by the page boundaries.
             
             let yOffset = headerHeight;
             
             while (heightLeft > 0) {
                 pdf.addImage(imgData, 'JPEG', margin, yOffset, availableWidth, fullImgHeightOnPdf);
                 
                 heightLeft -= (pageHeight - (yOffset === headerHeight ? headerHeight : margin) - margin); // Subtract visible area
                 yOffset -= (pageHeight - margin * 2); // Shift up for next page
                 
                 if (heightLeft > 0) {
                     pdf.addPage();
                     // No header on subsequent pages, just top margin
                     yOffset = margin - (fullImgHeightOnPdf - heightLeft); 
                     // Actually, a simpler approach for the offset in the loop:
                     // Just use the standard negative offset technique.
                 }
             }
        }
        
        // Save
        const finalFileName = (typeof customName === 'string' && customName.length > 0) ? customName : `Relatorio_Analise_${Date.now()}`;
        pdf.save(finalFileName.toLowerCase().endsWith('.pdf') ? finalFileName : `${finalFileName}.pdf`);

    } catch (error) {
        console.error("PDF Generation failed:", error);
        alert("Failed to generate PDF. Check console for details.");
    } finally {
        setIsExportingPdf(false);
    }
  };

  const ComparativeMetricsView = React.memo(({ category }: { category: 'Uppercase' | 'Lowercase' }) => {
      const allChars = category === 'Uppercase' ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('') : "abcdefghijklmnopqrstuvwxyz".split('');
      
      const chars = useMemo(() => {
          if (!searchQuery) return allChars;
          const qLower = searchQuery.toLowerCase().trim();
          const qCleanHex = qLower.replace(/^(u\+|0x)/g, '');
          
          return allChars.filter(c => {
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
      }, [allChars, searchQuery]);

      if (!originalFont?.fontObj || !tracyFont?.fontObj) return null;
      if (chars.length === 0) return null;

      return (
          <div className="mb-8">
              <h4 className="text-base font-bold uppercase mb-4 tracking-wider dark:text-gray-400 text-gray-600 border-b dark:border-gray-800 border-gray-200 pb-2">
                  {category === 'Uppercase' ? 'Maiúsculas' : 'Minúsculas'} - Comparação
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {chars.map(char => {
                      const m1 = getCharMetrics(originalFont.fontObj!, char);
                      const m2 = getCharMetrics(tracyFont.fontObj!, char);
                      
                      const diffL = m2.lsb - m1.lsb;
                      const diffR = m2.rsb - m1.rsb;
                      
                      const hasChange = diffL !== 0 || diffR !== 0;

                      return (
                          <div key={char} className={`dark:bg-gray-800/40 bg-gray-200/40 rounded p-3 border ${hasChange ? 'border-cyan-500/30 bg-cyan-900/5' : 'dark:border-gray-700/50 border-gray-300/50'} flex flex-col gap-2 group dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors`}>
                              {/* Header */}
                              <div className="flex justify-between items-end border-b dark:border-gray-700/50 border-gray-300/50 pb-2">
                                  <span className="text-4xl leading-none dark:text-white text-slate-900" style={{ fontFamily: tracyFont.fullFontFamily }}>{char}</span>
                                  <span className="text-xs text-gray-600 dark:text-gray-500 font-mono">{char.charCodeAt(0)}</span>
                              </div>

                              {/* LSB Block */}
                              <div className="flex justify-between items-center text-sm">
                                  <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-8">LSB</span>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.lsb}</span>
                                      <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                      <span className={`font-mono font-medium ${diffL !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                          {m2.lsb}
                                      </span>
                                  </div>
                              </div>

                              {/* RSB Block */}
                              <div className="flex justify-between items-center text-sm">
                                  <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-8">RSB</span>
                                  <div className="flex-1 flex justify-between items-center">
                                      <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.rsb}</span>
                                      <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                      <span className={`font-mono font-medium ${diffR !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                          {m2.rsb}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          </div>
      );
  });

  const ExtendedComparativeView = React.memo(() => {
        const [displayLimit, setDisplayLimit] = useState(60);

        // Reset limit on search change
        useEffect(() => {
            setDisplayLimit(60);
        }, [searchQuery]);

        if (!originalFont?.fontObj || !tracyFont?.fontObj) return null;

        const glyphs = useMemo(() => {
            const found: Array<{ char: string, unicode: number }> = [];
            const seen = new Set<string>();
            const numGlyphs = tracyFont.fontObj.glyphs.length;
            
            for (let i = 0; i < numGlyphs; i++) {
                const glyph = tracyFont.fontObj.glyphs.get(i);
                
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
                        if (char && (char.trim() !== '' || char === ' ')) {
                            if (!seen.has(char)) {
                                seen.add(char);
                                // Only include if it is not a letter with uppercase/lowercase distinctions
                                const isLetter = char.toLowerCase() !== char.toUpperCase();
                                if (!isLetter) {
                                    found.push({ char, unicode: uni });
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
            
            // Filter by searchQuery
            const filtered = searchQuery 
                ? found.filter(g => 
                    g.char.toLowerCase().includes(searchQuery.toLowerCase()) || 
                    g.unicode.toString(16).toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : found;

            return filtered.sort((a, b) => a.unicode - b.unicode);
        }, [tracyFont, searchQuery]);

        if (glyphs.length === 0) return null;

        const visibleGlyphs = glyphs.slice(0, displayLimit);

        return (
            <div className="mb-8 mt-12 pt-8 border-t dark:border-gray-800 border-gray-200">
                <h4 className="text-base font-bold uppercase mb-4 tracking-wider dark:text-gray-400 text-gray-600 border-b dark:border-gray-800 border-gray-200 pb-2">
                    Comparação de Glifos Complementares ({glyphs.length})
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {visibleGlyphs.map(g => {
                        const m1 = getCharMetrics(originalFont.fontObj!, g.char);
                        const m2 = getCharMetrics(tracyFont.fontObj!, g.char);
                        
                        const diffL = m2.lsb - m1.lsb;
                        const diffR = m2.rsb - m1.rsb;
                        const hasChange = diffL !== 0 || diffR !== 0;

                        return (
                            <div key={g.unicode} className={`dark:bg-gray-800/40 bg-gray-200/40 rounded p-3 border ${hasChange ? 'border-cyan-500/30 bg-cyan-900/5' : 'dark:border-gray-700/50 border-gray-300/50'} flex flex-col gap-2 group dark:hover:bg-gray-800 hover:bg-gray-200 transition-colors`}>
                                {/* Header */}
                                <div className="flex justify-between items-end border-b dark:border-gray-700/50 border-gray-300/50 pb-2">
                                    <span className="text-3xl leading-none dark:text-white text-slate-900 w-full text-center" style={{ fontFamily: tracyFont.fullFontFamily }}>
                                        {/* Visualize Space */}
                                        {g.char === ' ' ? <span className="text-sm dark:text-gray-500 text-gray-500 font-mono tracking-widest">[ESPAÇO]</span> : g.char}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-600 dark:text-gray-500 font-mono text-center mb-1">{g.unicode} (U+{g.unicode.toString(16).toUpperCase()})</div>

                                {/* LSB Block */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-6">L</span>
                                    <div className="flex-1 flex justify-between items-center pl-2">
                                        <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.lsb}</span>
                                        <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                        <span className={`font-mono font-medium ${diffL !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                            {m2.lsb}
                                        </span>
                                    </div>
                                </div>

                                {/* RSB Block */}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="dark:text-gray-500 text-gray-500 font-bold text-xs w-6">R</span>
                                    <div className="flex-1 flex justify-between items-center pl-2">
                                        <span className="dark:text-gray-500 text-gray-500 text-xs">{m1.rsb}</span>
                                        <span className="text-gray-600 dark:text-gray-500 text-xs">→</span>
                                        <span className={`font-mono font-medium ${diffR !== 0 ? 'text-cyan-400' : 'dark:text-gray-400 text-gray-600'}`}>
                                            {m2.rsb}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
                {glyphs.length > displayLimit && (
                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={() => setDisplayLimit(prev => prev + 60)}
                            className="px-8 py-3 rounded-xl border dark:border-gray-700 border-gray-300 dark:text-gray-400 text-gray-600 text-sm font-bold uppercase hover:bg-gray-800 hover:text-white transition-all shadow-lg"
                        >
                            Ver mais {glyphs.length - displayLimit} glifos complementares
                        </button>
                    </div>
                )}
            </div>
        );
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full dark:bg-gray-900 bg-gray-100 rounded-lg overflow-hidden border dark:border-gray-700 border-gray-300 shadow-xl">
       {/* Inject Local Styles to enforce precision within this canvas context */}
       <style>
            {fontFacesCSS}
       </style>

      {/* Toolbar */}
      <div className="dark:bg-gray-800 bg-gray-200 p-2 md:p-3 flex flex-col gap-2 md:gap-4 border-b dark:border-gray-700 border-gray-300">
        <div className="flex items-end justify-between gap-4 flex-wrap w-full">
            {/* Left Block: Navegação, Modos de Visualização, Comparação */}
            <div className="flex items-end gap-6 flex-wrap">
                {/* View Mode Navigator (Always Visible) */}
                <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        <Columns className="w-3.5 h-3.5 text-indigo-500" />
                        1. Navegação
                    </span>
                    <div className="grid grid-cols-3 gap-1 dark:bg-gray-700/50 bg-gray-300/50 rounded-lg p-1 shadow-inner">
                        <button 
                            onClick={() => setViewMode('side-by-side')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'side-by-side' ? 'bg-indigo-600 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Análise Comparativa (Lado a Lado)"
                        >
                            <Columns className="w-3.5 h-3.5" />
                            Comparativo
                        </button>
                        <button 
                            onClick={() => setViewMode('overlay')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'overlay' ? 'bg-rose-600 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Visualização Overlay"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            Overlay
                        </button>
                        <button 
                            onClick={() => setViewMode('metrics')}
                            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'metrics' ? 'bg-indigo-600 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Dados de Métricas / Diagrama"
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            Diagrama
                        </button>
                    </div>
                </div>

                {/* Conditional Tools */}
                {viewMode !== 'metrics' && (
                  <>
                      {/* Comparação (Second Section) */}
                      {!isCompareMode && (
                      <div className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                            <Edit2 className="w-3.5 h-3.5 text-indigo-500" />
                            2. Comparar
                        </span>
                        <div className="flex overflow-x-auto gap-1 pb-1 custom-scrollbar whitespace-nowrap dark:bg-gray-700/30 bg-gray-300/30 rounded-lg p-1">
                            {[
                                { type: MethodType.ORIGINAL, label: 'Orig' },
                                { type: MethodType.ORIGINAL_CUSTOM, label: 'Manual' },
                                { type: MethodType.TRACY, label: 'Tracy' },
                                { type: MethodType.SOUSA, label: 'Sousa' }
                            ].map((m) => (
                                <button 
                                    key={m.type}
                                    onClick={() => toggleMethod(m.type)}
                                    className={`px-2.5 py-1 text-xs font-black rounded-md transition-all ${activeMethods.includes(m.type) ? 'bg-indigo-600 text-white shadow-sm opacity-100' : 'dark:bg-gray-800 bg-white dark:text-gray-400 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60 hover:opacity-100'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                      </div>
                      )}

                      {/* Modos de Visualização (Third Section) */}
                      <div className="flex flex-col gap-1">
                          <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                              <Type className="w-3.5 h-3.5 text-blue-500" />
                              3. Modos
                          </span>
                          <div className="flex gap-1">
                              <button 
                                  onClick={() => setPreset(PARAGRAPH_TEXT, 30, 'paragraph')} 
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${analysisPreset === 'paragraph' ? 'bg-blue-600 text-white' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}
                              >
                                <AlignJustify className="w-3.5 h-3.5" />
                                Parágrafo
                              </button>
                              <button 
                                  onClick={() => setPreset(FULL_SET_TEXT, 48, 'full-set')} 
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${analysisPreset === 'full-set' ? 'bg-indigo-600 text-white' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}
                              >
                                <Type className="w-3.5 h-3.5" />
                                Corrido
                              </button>
                              <button 
                                  onClick={() => { 
                                      setTestText("HHOOHOH\nnnoonon\nminimum\nOverwoman\ngroundling\nPalaeoclimatologist"); 
                                      setFontSize(150); 
                                      setAnalysisPreset('words-overlay');
                                      setHasVisitedOverlay(true);
                                  }} 
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all ${analysisPreset === 'words-overlay' ? 'bg-purple-600 text-white' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}                
                              >
                                  <Layers className="w-3.5 h-3.5" />
                                  Palavra
                              </button>
                          </div>
                      </div>
                  </>
                )}
            </div>

            {/* Right Block: Ajustes de Fonte e Exportar PDF */}
            <div className="flex items-end gap-6 flex-wrap">
                {/* Settings Group */}
                {viewMode !== 'metrics' && (
                    <div className="flex gap-4 items-end flex-wrap">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Tamanho</span>
                            <div className="flex items-center gap-2 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
                                <Type className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                                <input 
                                    type="number" 
                                    value={fontSize} 
                                    onChange={(e) => setFontSize(Number(e.target.value))}
                                    className="w-12 dark:bg-gray-700 bg-gray-300 border dark:border-gray-600 border-gray-400 rounded px-1 text-sm text-center dark:text-white text-slate-900"
                                />
                                <span className="text-xs dark:text-gray-400 text-gray-600">px</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Entrelinha</span>
                            <div className="flex items-center gap-2 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
                                 <ArrowUpDown className="w-4 h-4 dark:text-gray-400 text-gray-600" />
                                <input 
                                    type="number"
                                    step="0.1" 
                                    min="0.8"
                                    max="3.0"
                                    value={lineHeight} 
                                    onChange={(e) => setLineHeight(Number(e.target.value))}
                                    className="w-12 dark:bg-gray-700 bg-gray-300 border dark:border-gray-600 border-gray-400 rounded px-1 text-sm text-center dark:text-white text-slate-900"
                                />
                                <span className="text-xs dark:text-gray-400 text-gray-600">em</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Alinhamento</span>
                            <div className="flex items-center gap-1 px-1 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
                                {[
                                  { id: 'left', icon: <AlignLeft className="w-4 h-4" /> },
                                  { id: 'center', icon: <AlignCenter className="w-4 h-4" /> },
                                  { id: 'right', icon: <AlignRight className="w-4 h-4" /> },
                                  { id: 'justify', icon: <AlignJustify className="w-4 h-4" /> }
                                ].map((align) => (
                                    <button
                                        key={align.id}
                                        onClick={() => setTextAlign(align.id as any)}
                                        className={`p-1.5 rounded transition-colors ${textAlign === align.id ? 'bg-indigo-600 text-white' : 'dark:text-gray-400 text-gray-600 hover:bg-gray-400/20'}`}
                                        title={align.id}
                                    >
                                      {align.icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Modo Caixa</span>
                            <div className="flex items-center gap-1 px-1 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
                                {[
                                  { id: 'normal', label: 'Ab' },
                                  { id: 'uppercase', label: 'AB' },
                                  { id: 'lowercase', label: 'ab' }
                                ].map((casing) => (
                                    <button
                                        key={casing.id}
                                        onClick={() => setTextCase(casing.id as any)}
                                        className={`px-2 py-1 rounded text-xs font-black tracking-wider transition-colors ${textCase === casing.id ? 'bg-indigo-600 text-white' : 'dark:text-gray-400 text-gray-500 hover:bg-gray-400/20'}`}
                                        title={casing.id === 'normal' ? 'Normal' : casing.id === 'uppercase' ? 'Caixa Alta' : 'Caixa Baixa'}
                                    >
                                      {casing.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* PDF Export Button */}
                {(viewMode === 'overlay' || viewMode === 'side-by-side') && (
                    <button
                        onClick={() => handlePdfExport()}
                        disabled={isExportingPdf}
                        className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-rose-600/30 h-[38px] self-end"
                        title="Exportar PDF"
                    >
                        {isExportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                        <span className="inline uppercase tracking-widest text-xs">PDF</span>
                    </button>
                )}
            </div>
        </div>

        {viewMode !== 'metrics' && (
            <div className="w-full flex flex-col gap-2.5">
                <textarea 
                    value={testText} 
                    onChange={(e) => {
                        setTestText(e.target.value);
                        setAnalysisPreset('custom');
                    }}
                    className="w-full dark:bg-gray-700/80 bg-gray-300/80 border dark:border-gray-600 border-gray-400 rounded-xl px-4 py-3 text-lg dark:text-gray-200 text-gray-800 font-sans resize-none h-24 leading-tight shadow-inner focus:ring-1 focus:ring-indigo-500/50 outline-none"
                    placeholder="Insira o texto para análise..."
                />
                
                {/* Text Block Variations Suggestions based on View Mode */}
                <div className="flex flex-col gap-2 p-3 bg-slate-300/30 dark:bg-slate-900/40 rounded-xl border dark:border-slate-800/80 border-slate-300/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-black dark:text-gray-400 text-gray-500 tracking-widest flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                            Variações de {viewMode === 'side-by-side' ? 'Parágrafos (Manchas de Texto)' : 'Palavras (Sobreposição)'}:
                        </span>
                        <span className="text-[9px] dark:text-gray-500 text-gray-400 italic">
                            *Alterna o texto e ajusta o tamanho automaticamente
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {(viewMode === 'side-by-side' ? SIDE_BY_SIDE_PRESETS : OVERLAY_PRESETS).map((p, idx) => {
                            const isSelected = testText.trim().replace(/\s+/g, ' ') === p.text.trim().replace(/\s+/g, ' ');
                            return (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setTestText(p.text);
                                        setFontSize(p.fontSize);
                                        setAnalysisPreset('custom');
                                    }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                                            : 'dark:bg-slate-800/80 bg-slate-200/80 dark:text-slate-300 text-slate-700 hover:bg-slate-300 dark:hover:bg-slate-700/90 border dark:border-slate-700 border-slate-300'
                                    }`}
                                    title={p.text}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto dark:bg-gray-950 bg-gray-50 relative">
        
        {viewMode === 'side-by-side' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className={`flex gap-0 min-h-full divide-x divide-gray-800 dark:bg-gray-950 bg-gray-50`}
             >
                {/* 1. Original */}
                {activeMethods.includes(MethodType.ORIGINAL) && (
                <div className={`flex flex-col flex-1 dark:bg-gray-900/30 bg-gray-100/30 order-1 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[500px]' : activeMethods.length === 3 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[33.333%] xl:min-w-[400px]' : 'min-w-[100vw] md:min-w-[50%] lg:min-w-[25%] xl:min-w-[350px]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-600 truncate max-w-[200px]" title={labelOriginal}>
                            {labelOriginal}
                         </h4>
                         <button onClick={() => handleExport(MethodType.ORIGINAL)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs rounded-lg border border-slate-300 dark:border-slate-700 transition-all" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: originalFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-gray-300 text-gray-700 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                     </div>
                </div>
                )}

                {/* 1.5 Ajuste Manual */}
                {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                    <div className={`flex flex-col flex-1 order-2 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[500px]' : activeMethods.length === 3 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[33.333%] xl:min-w-[400px]' : 'min-w-[100vw] md:min-w-[50%] lg:min-w-[25%] xl:min-w-[350px]'} shrink-0`}>
                         <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                             <h4 className="text-sm font-bold uppercase tracking-widest dark:text-slate-400 text-slate-600">Ajuste Manual</h4>
                             <button onClick={() => handleExport(MethodType.ORIGINAL_CUSTOM)} className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-900 dark:text-blue-200 font-black uppercase tracking-widest text-xs rounded-lg border border-blue-300 dark:border-blue-700 transition-all" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                         </div>
                         <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                            <p style={{ fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-gray-200 text-gray-800 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                                <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                            </p>
                         </div>
                    </div>
                )}

                {/* 2. Adjusted / Tracy */}
                {activeMethods.includes(MethodType.TRACY) && (
                <div className={`flex flex-col flex-1 order-3 overflow-visible ${activeMethods.length === 1 ? 'dark:bg-gray-900/40 bg-gray-100/40 min-w-full' : activeMethods.length === 2 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[500px]' : activeMethods.length === 3 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[33.333%] xl:min-w-[400px]' : 'min-w-[100vw] md:min-w-[50%] lg:min-w-[25%] xl:min-w-[350px]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className={`text-sm font-bold uppercase tracking-widest ${isCompareMode ? 'text-cyan-400' : 'text-pink-400'} truncate max-w-[200px]`} title={labelTracy}>
                            {labelTracy}
                         </h4>
                         <button onClick={() => handleExport(MethodType.TRACY)} className={`flex items-center gap-2.5 px-4 py-2.5 hover:bg-pink-200 dark:hover:bg-pink-900/50 text-pink-900 dark:text-pink-200 font-black uppercase tracking-widest text-xs rounded-lg border border-pink-300 dark:border-pink-700 transition-all ${isCompareMode ? 'bg-cyan-100 dark:bg-cyan-900/30' : 'bg-pink-100 dark:bg-pink-900/30'}`} data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-white text-slate-900 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                     </div>
                </div>
                )}

                {/* 3. Sousa */}
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className={`flex flex-col flex-1 order-4 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[500px]' : activeMethods.length === 3 ? 'min-w-[100vw] md:min-w-[50%] lg:min-w-[33.333%] xl:min-w-[400px]' : 'min-w-[100vw] md:min-w-[50%] lg:min-w-[25%] xl:min-w-[350px]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-400 truncate max-w-[200px]">Método Miguel Sousa</h4>
                         <button onClick={() => handleExport(MethodType.SOUSA)} className="flex items-center gap-2.5 px-4 py-2.5 bg-cyan-100 dark:bg-cyan-900/30 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 text-cyan-900 dark:text-cyan-200 font-black uppercase tracking-widest text-xs rounded-lg border border-cyan-300 dark:border-cyan-700 transition-all" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: sousaFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-white text-slate-900 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                     </div>
                </div>
                )}
             </div>
        )}

        {viewMode === 'stack' && (
             <div className="flex flex-col divide-y divide-gray-800 max-w-5xl mx-auto p-4 md:p-12 gap-12 overflow-visible">
                {activeMethods.includes(MethodType.ORIGINAL) && (
                <div>
                     <h4 className="text-sm font-bold uppercase tracking-widest dark:text-gray-500 text-gray-500 mb-4">{labelOriginal}</h4>
                     <p style={{ fontFamily: originalFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-gray-400 text-gray-600 whitespace-pre-wrap mb-4 text-left">
                        <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                    </p>
                    <button onClick={() => handleExport(MethodType.ORIGINAL)} className="text-sm dark:text-gray-500 text-gray-500 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download ORIGINAL</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                <div className="pt-12">
                     <h4 className="text-sm font-bold uppercase tracking-widest dark:text-slate-500 text-slate-500 mb-4">Ajuste Manual</h4>
                     <p style={{ fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-slate-300 text-slate-700 whitespace-pre-wrap mb-4 text-left">
                          <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                     </p>
                    <button onClick={() => handleExport(MethodType.ORIGINAL_CUSTOM)} className="text-sm dark:text-slate-500 text-slate-500 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Exportar Ajuste Manual</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.TRACY) && (
                <div className="pt-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-pink-500 mb-4">{labelTracy}</h4>
                    <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                    </p>
                    <button onClick={() => handleExport(MethodType.TRACY)} className="text-sm dark:text-pink-500 text-pink-600 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download {isCompareMode ? labelTracy.toUpperCase() : 'TRACY'}</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className="pt-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-cyan-500 mb-4">Método Miguel Sousa</h4>
                    <p style={{ fontFamily: sousaFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                    </p>
                    <button onClick={() => handleExport(MethodType.SOUSA)} className="text-sm dark:text-cyan-500 text-cyan-600 dark:hover:text-white hover:text-slate-900 flex gap-2 items-center dark:bg-gray-800 bg-gray-200 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download SOUSA</button>
                </div>
                )}
             </div>
        )}

        {viewMode === 'overlay' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className="min-h-full relative flex flex-col items-center justify-center dark:bg-gray-950 bg-gray-50 p-8"
             >
                <div className="absolute top-4 left-4 flex flex-wrap gap-4" data-html2canvas-ignore>
                     {activeMethods.includes(MethodType.ORIGINAL) && (
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className="w-3 h-3 bg-gray-500"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelOriginal}</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className="w-3 h-3 bg-blue-500"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">Ajuste Manual</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.TRACY) && (
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className={`w-3 h-3 ${isCompareMode ? 'bg-cyan-500' : 'bg-pink-500'}`}></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelTracy}</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.SOUSA) && (
                     <div className="flex items-center gap-2 px-3 py-1 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded">
                        <div className="w-3 h-3 bg-cyan-500"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">Sousa</span>
                     </div>
                     )}
                </div>

                {/* Legend Overlay */}
                <div className="overlay-legend absolute bottom-6 right-6 p-4 dark:bg-gray-900/60 bg-gray-100/60 backdrop-blur-md rounded-xl border dark:border-gray-800 border-gray-200 shadow-2xl flex flex-col gap-3 min-w-[180px] z-[50]" data-html2canvas-ignore>
                    <h5 className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-gray-500 text-gray-500 border-b dark:border-gray-800 border-gray-200 pb-2 mb-1">Métricas em Tempo Real</h5>
                    
                    {activeMethods.includes(MethodType.ORIGINAL) && (
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-sm dark:bg-white/10 bg-black/10"></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ref. Original (Massa)</span>
                    </div>
                    )}
                    
                    {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-sm border border-blue-500"></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ajuste Manual Contorno</span>
                    </div>
                    )}

                    {activeMethods.includes(MethodType.TRACY) && (
                    <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-sm border ${isCompareMode ? 'border-cyan-400' : 'border-pink-500'}`}></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Tracy Contorno</span>
                    </div>
                    )}
                    
                    {activeMethods.includes(MethodType.SOUSA) && (
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-sm border border-cyan-400"></div>
                        <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Sousa Contorno</span>
                    </div>
                    )}
                </div>

                <div 
                    className="relative w-full overflow-y-auto max-h-[85vh] scrollbar-hide px-4 pt-12"
                    style={{ 
                        lineHeight: `${debouncedFontSize * debouncedLineHeight}px`,
                        backgroundImage: viewMode === 'overlay' ? 'none' : `var(--bg-grid-svg, ${grid})`,
                        backgroundSize: `100% ${debouncedFontSize * debouncedLineHeight}px`,
                        backgroundAttachment: 'local',
                        backgroundPosition: '0 12px'
                    }}
                >
                    {/* Height Master: Always rendered but invisible to drive container dimensions */}
                    <div className="overlay-height-master select-none pointer-events-none opacity-0" aria-hidden="true">
                        <p 
                            style={{ 
                                fontFamily: originalFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                transition: 'all 0.3s ease'
                            }} 
                            className={`whitespace-pre-wrap break-words text-${textAlign}`}
                        >
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                    </div>

                    {/* 1. Reference (Original) */}
                    {activeMethods.includes(MethodType.ORIGINAL) && (
                    <div className="absolute inset-0 pt-12 pointer-events-none">
                        <p 
                            style={{ 
                                fontFamily: originalFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                                WebkitTextStroke: 'none',
                                transition: 'all 0.3s ease'
                            }} 
                            className={`whitespace-pre-wrap break-words px-4 text-${textAlign}`}
                        >
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                    </div>
                    )}
                    
                    {/* 1.5 Original Custom Overlay */}
                    {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                    <div className="absolute inset-0 pt-12 pointer-events-none">
                        <p 
                            style={{ 
                                fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: 'transparent',
                                WebkitTextStroke: `1.2px ${isDark ? '#3B82F6' : '#2563EB'}`,
                                transform: `translateY(${offsets[MethodType.ORIGINAL_CUSTOM]}px)`,
                                transition: 'all 0.3s ease'
                            }} 
                            className={`whitespace-pre-wrap break-words px-4 text-${textAlign}`}
                        >
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} isOutline />
                        </p>
                    </div>
                    )}

                    {/* 2. Experimental (Tracy) */}
                    {activeMethods.includes(MethodType.TRACY) && (
                    <div className="absolute inset-0 pt-12 pointer-events-none">
                        <p 
                            style={{ 
                                fontFamily: tracyFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: 'transparent',
                                WebkitTextStroke: `1.2px ${isCompareMode ? (isDark ? '#06B6D4' : '#0891B2') : (isDark ? '#EC4899' : '#DB2777')}`,
                                transform: `translateY(${offsets[MethodType.TRACY]}px)`,
                                transition: 'all 0.3s ease'
                            }} 
                            className={`whitespace-pre-wrap break-words px-4 text-${textAlign}`}
                        >
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} isOutline />
                        </p>
                    </div>
                    )}

                    {/* 3. Experimental (Sousa) */}
                    {activeMethods.includes(MethodType.SOUSA) && (
                    <div className="absolute inset-0 pt-12 pointer-events-none">
                        <p 
                            style={{ 
                                fontFamily: sousaFont?.fullFontFamily || 'serif', 
                                fontSize: `${debouncedFontSize}px`,
                                color: 'transparent',
                                WebkitTextStroke: `1.2px ${isDark ? '#22D3EE' : '#0891B2'}`,
                                transform: `translateY(${offsets[MethodType.SOUSA]}px)`,
                                transition: 'all 0.3s ease'
                            }} 
                            className={`whitespace-pre-wrap break-words px-4 text-${textAlign}`}
                        >
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} isOutline />
                        </p>
                    </div>
                    )}
                </div>
             </div>
        )}

        {viewMode === 'metrics' && (
             <div className="p-4 md:p-8 max-w-7xl mx-auto">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-2xl font-bold flex gap-2 items-center dark:text-white text-slate-900">
                            <BarChart2 className="text-blue-400" /> Diagrama de Espaçamentos
                        </h3>
                        <p className="text-xs dark:text-slate-500 text-slate-500 uppercase font-black tracking-widest pl-7">Análise Técnica e Sistematização</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                        {/* Method Selector Tabs */}
                        {!isCompareMode && (
                        <div className="flex dark:bg-slate-950 bg-slate-50 p-1 rounded-xl border dark:border-slate-800 border-slate-200 w-full sm:w-auto">
                            {(['ORIGINAL', 'ORIGINAL_CUSTOM', 'TRACY', 'SOUSA'] as MethodType[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setSelectedDiagramMethod(m)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                                        selectedDiagramMethod === m 
                                            ? 'dark:bg-slate-800 bg-slate-200 dark:text-white text-slate-900 shadow-sm' 
                                            : 'dark:text-slate-500 text-slate-500 dark:hover:text-slate-300 hover:text-slate-700'
                                    }`}
                                >
                                    {m === 'ORIGINAL' ? 'Original' : m === 'ORIGINAL_CUSTOM' ? 'Ajuste Manual' : m === 'TRACY' ? 'Tracy' : 'Sousa'}
                                </button>
                            ))}
                        </div>
                        )}

                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-gray-500 text-gray-500" />
                            <input 
                                type="text"
                                placeholder="Pesquisar glifo ou Unicode (ex: U+0041, 65)..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className="w-full dark:bg-gray-800 bg-gray-200 border dark:border-gray-700 border-gray-300 rounded-lg pl-10 pr-4 py-2 text-xs dark:text-white text-slate-900 focus:border-blue-500 outline-none transition-all"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 dark:hover:bg-gray-700 hover:bg-gray-300 rounded"
                                >
                                    <X className="w-3 h-3 dark:text-gray-400 text-gray-600" />
                                </button>
                            )}
                        </div>
                    </div>
                 </div>
                 
                 {isCompareMode ? (
                     <>
                        {/* Comparative Stats Summary */}
                        <div className="space-y-8 dark:bg-gray-800/50 bg-gray-200/50 p-6 rounded-xl border dark:border-gray-700 border-gray-300 mb-8">
                             <div className="flex flex-col md:flex-row gap-8 justify-between">
                                 <div className="flex-1">
                                     <h4 className="font-bold dark:text-gray-300 text-gray-700 mb-4">{labelOriginal}</h4>
                                     <div className="flex justify-between text-base mb-2 dark:text-gray-400 text-gray-600">
                                         <span>Global Average Spacing</span>
                                         <span>{getAvgSB(MethodType.ORIGINAL)} units</span>
                                     </div>
                                 </div>
                                 <div className="w-px dark:bg-gray-700 bg-gray-300 hidden md:block"></div>
                                 <div className="flex-1">
                                     <h4 className="font-bold text-cyan-400 mb-4">{labelTracy}</h4>
                                     <div className="flex justify-between text-base mb-2 text-cyan-300">
                                         <span>Global Average Spacing</span>
                                         <span>{getAvgSB(MethodType.TRACY)} units</span>
                                     </div>
                                 </div>
                             </div>
                        </div>
                        
                        {/* Detailed Character Cards */}
                        <ComparativeMetricsView category="Lowercase" />
                        <ComparativeMetricsView category="Uppercase" />
                        
                        {/* NEW: Full Extended Character Set Comparison */}
                        <ExtendedComparativeView />
                     </>
                 ) : (
                      <div className="space-y-12">
                          <div className="dark:bg-slate-900/40 bg-slate-100/40 p-2 md:p-8 rounded-[2rem] border dark:border-slate-800/50 border-slate-200/50">
                              <div className="flex flex-col gap-8">
                                  {/* Selection Content Dynamic Rendering */}
                                  {(selectedDiagramMethod === MethodType.ORIGINAL || 
                                     selectedDiagramMethod === MethodType.ORIGINAL_CUSTOM || 
                                     selectedDiagramMethod === MethodType.TRACY) && (
                                       <div className="space-y-8">
                                          <SpacingDiagram 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              category="Lowercase" 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                          <SpacingDiagram 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              category="Uppercase" 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                          <RemainingGlyphsView 
                                              font={fonts[selectedDiagramMethod]} 
                                              method={selectedDiagramMethod as MethodType} 
                                              searchQuery={searchQuery}
                                              onGlyphClick={selectedDiagramMethod !== MethodType.ORIGINAL ? (char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, selectedDiagramMethod as MethodType) : undefined}
                                          />
                                      </div>
                                  )}

                                  {selectedDiagramMethod === MethodType.SOUSA && (
                                      <div className="space-y-8">
                                          <SousaAnalysisView 
                                              font={sousaFont} 
                                              category="Lowercase" 
                                              searchQuery={searchQuery}
                                              setSearchQuery={setSearchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                          <SousaAnalysisView 
                                              font={sousaFont} 
                                              category="Uppercase" 
                                              searchQuery={searchQuery}
                                              setSearchQuery={setSearchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                          <RemainingGlyphsView 
                                              font={sousaFont} 
                                              method={MethodType.SOUSA} 
                                              searchQuery={searchQuery}
                                              onGlyphClick={(char, lsb, rsb) => toggleAdjustment(char, lsb, rsb, MethodType.SOUSA)}
                                          />
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                 )}
             </div>
        )}

        {/* Individual Adjustment Modal */}
        <AnimatePresence>
            {selectedAdjustment && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[110] dark:bg-slate-950/90 bg-slate-50/90 backdrop-blur-md flex items-center justify-center p-4 lg:p-8"
                >
                    <motion.div 
                        initial={{ scale: 0.95, y: 30, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.95, y: 30, opacity: 0 }}
                        className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-[2.5rem] w-full max-w-6xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] flex flex-col h-[95vh] md:h-auto md:max-h-[90vh]"
                    >
                        {/* Header Modal */}
                        <div className="flex justify-between items-start mb-4 shrink-0 p-6 px-10">
                            <div>
                               <h2 className="text-2xl font-black dark:text-white text-slate-900 uppercase tracking-tighter">AJUSTE FINO DE GLIFO</h2>
                               <div className="mt-1 flex items-center gap-2 text-sm dark:text-slate-500 text-slate-500 font-medium uppercase tracking-wider">
                                    GLIFO SELECIONADO: <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">{selectedAdjustment.char}</span>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                               <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 border dark:border-slate-800 border-slate-200 px-3 py-1.5 rounded-full shadow-sm">
                                   <span className="text-[11px] uppercase font-black dark:text-slate-500 text-slate-600">STATUS</span>
                                   <span className="text-[11px] uppercase font-black px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400">INDIVIDUAL</span>
                               </div>
                                <button onClick={() => setSelectedAdjustment(null)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                                    <X className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                                </button>
                                <button onClick={() => setSelectedAdjustment(null)} className="ml-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm text-sm font-bold uppercase">
                                    CONFIRMAR
                                </button>
                             </div>
                        </div>

                        {/* Body Modal */}
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4 flex-1 min-h-0 p-4 lg:p-10">
                            {/* Left Col: Preview + Sliders */}
                            <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar p-1">
                                <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-800 shadow-md rounded-2xl p-4 flex flex-col justify-center min-h-[110px] shrink-0 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {isModalEditing ? (
                                        <div className="flex flex-col items-center justify-center w-full py-2" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="text"
                                                value={modalTestText}
                                                onChange={(e) => setModalTestText(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') setIsModalEditing(false); }}
                                                onBlur={() => setIsModalEditing(false)}
                                                autoFocus
                                                className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-pink-500/50 py-1 w-full max-w-xs focus:ring-0"
                                            />
                                            <p className="text-[10px] text-pink-500 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
                                        </div>
                                    ) : (
                                        <div 
                                            className="text-center py-2 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-900/30 rounded-xl relative group/preview min-h-[44px] flex flex-col justify-center items-center"
                                            onClick={() => setIsModalEditing(true)}
                                            title="Clique para editar sequência"
                                        >
                                            <div className="text-3xl font-mono text-slate-800 dark:text-slate-200">
                                                {modalTestText}
                                            </div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity bg-pink-500/10 text-pink-400 p-1 rounded">
                                                <Edit2 className="w-3 h-3" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* LSB Slider */}
                                <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                     <div className="flex justify-between items-center mb-3">
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING ESQUERDO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-blue-500 font-bold text-sm shadow-sm">{selectedAdjustment.lsb}</span>
                                     </div>
                                     <input 
                                         type="range" min="-500" max="1500" value={selectedAdjustment.lsb}
                                         onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setSelectedAdjustment({ ...selectedAdjustment, lsb: val });
                                             onUpdateGlyph?.(selectedAdjustment.method, selectedAdjustment.char, val, null);
                                             
                                             // Propagate to derivatives if base glyph
                                             const derived = GLYPH_DERIVATIVES[selectedAdjustment.char];
                                             if (derived) {
                                                 derived.forEach(char => {
                                                     onUpdateGlyph?.(selectedAdjustment.method, char, val, null);
                                                 });
                                             }
                                         }}
                                         className="w-full accent-blue-500 h-1.5 dark:bg-slate-700 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none"
                                     />
                                </div>
    
                                {/* RSB Slider */}
                                <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                     <div className="flex justify-between items-center mb-3">
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING DIREITO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg text-emerald-500 font-bold text-sm shadow-sm">{selectedAdjustment.rsb}</span>
                                     </div>
                                     <input 
                                         type="range" min="-500" max="1500" value={selectedAdjustment.rsb}
                                         onChange={(e) => {
                                             const val = Number(e.target.value);
                                             setSelectedAdjustment({ ...selectedAdjustment, rsb: val });
                                             onUpdateGlyph?.(selectedAdjustment.method, selectedAdjustment.char, null, val);
                                             
                                             // Propagate to derivatives if base glyph
                                             const derived = GLYPH_DERIVATIVES[selectedAdjustment.char];
                                             if (derived) {
                                                 derived.forEach(char => {
                                                     onUpdateGlyph?.(selectedAdjustment.method, char, null, val);
                                                 });
                                             }
                                         }}
                                         className="w-full accent-emerald-500 h-1.5 dark:bg-slate-700 bg-emerald-200 rounded-lg appearance-none cursor-pointer outline-none"
                                     />
                                </div>
                            </div>
                            
                            {/* Right Col: Visualizer */}
                            <div className="flex flex-col min-h-0">
                                <h3 className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5" /> ANÁLISE GEOMÉTRICA
                                </h3>
                                <div className="flex-1 dark:bg-slate-900 bg-white rounded-3xl border dark:border-slate-800 border-slate-200 overflow-hidden min-h-[250px] shadow-sm flex flex-col p-4">
                                    <div className="flex-1 border dark:border-slate-800 border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                                        <SequenceVisualizer 
                                            text={modalTestText}
                                            font={fonts[selectedAdjustment.method]} 
                                            method={selectedAdjustment.method}
                                            targetChar={selectedAdjustment.char}
                                            lsb={selectedAdjustment.lsb} 
                                            rsb={selectedAdjustment.rsb} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Export Modal */}
        <AnimatePresence>
            {isExportModalOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setIsExportModalOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border dark:border-slate-800 border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold dark:text-white text-slate-900 flex items-center gap-3">
                                    <Download className="w-6 h-6 text-blue-500" /> Baixar Fonte
                                </h3>
                                <button 
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 dark:text-slate-500 text-slate-400" />
                                </button>
                            </div>
                            
                            <p className="text-sm dark:text-slate-400 text-slate-500 mb-6 leading-relaxed">
                                Escolha um nome para o arquivo da fonte. O nome sugerido preserva a organização por método e o nome original.
                            </p>
                            
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 mb-2 truncate">
                                        Nome do Arquivo (.otf)
                                    </label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        value={exportFileName}
                                        onChange={(e) => setExportFileName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmExport();
                                            if (e.key === 'Escape') setIsExportModalOpen(false);
                                        }}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-medium text-slate-900 dark:text-white"
                                        placeholder="Ex: MinhaFonte_Trace"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl border dark:border-slate-800 border-slate-200 dark:text-slate-400 text-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmExport}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <Download className="w-4 h-4" /> Baixar
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Report Export Modal */}
        <AnimatePresence>
            {isReportExportModalOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                    onClick={() => setIsReportExportModalOpen(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border dark:border-slate-800 border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold dark:text-white text-slate-900 flex items-center gap-3">
                                    <FileText className="w-6 h-6 text-emerald-500" /> Relatório de Análise
                                </h3>
                                <button 
                                    onClick={() => setIsReportExportModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                                >
                                    <X className="w-5 h-5 dark:text-slate-500 text-slate-400" />
                                </button>
                            </div>
                            
                            <p className="text-sm dark:text-slate-400 text-slate-500 mb-6 leading-relaxed">
                                Escolha um nome para o arquivo do relatório PDF. O nome sugerido inclui a fonte original e o modo de visualização.
                            </p>
                            
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest dark:text-slate-500 text-slate-400 mb-2 truncate">
                                        Nome do Relatório (.pdf)
                                    </label>
                                    <input 
                                        autoFocus
                                        type="text" 
                                        value={reportFileName}
                                        onChange={(e) => setReportFileName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmReportExport();
                                            if (e.key === 'Escape') setIsReportExportModalOpen(false);
                                        }}
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow font-medium text-slate-900 dark:text-white"
                                        placeholder="Ex: Relatorio_MinhaFonte"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsReportExportModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl border dark:border-slate-800 border-slate-200 dark:text-slate-400 text-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmReportExport}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText className="w-4 h-4" /> Exportar PDF
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};
