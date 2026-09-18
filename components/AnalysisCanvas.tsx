
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTheme } from './useTheme';
import { TracySettings, FontState, MethodType } from '../types';
import { Layers, Type, AlignJustify, AlignLeft, AlignCenter, AlignRight, Download, BarChart2, Columns, ArrowUpDown, FileText, Loader2, Search, X, Edit2, Sparkles, CheckCircle2, Printer, Check } from 'lucide-react';
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
  selectedChar?: string;
  onCharSelect?: (char: string) => void;
  lastEditedMethod?: MethodType;
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
            case MethodType.TRACY: return { color: 'dark:text-white text-zinc-900', border: 'border-zinc-400 dark:border-zinc-600' };
            case MethodType.SOUSA: return { color: 'dark:text-zinc-300 text-zinc-700', border: 'border-zinc-300 dark:border-zinc-700' };
            case MethodType.ORIGINAL_CUSTOM: return { color: 'dark:text-zinc-200 text-zinc-800', border: 'border-zinc-300 dark:border-zinc-700' };
            default: return { color: 'dark:text-slate-400 text-slate-600', border: 'border-slate-300 dark:border-slate-700' };
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
                    const colorClass = isBase ? 'dark:text-white text-zinc-900 font-bold underline decoration-zinc-500/40' : 'dark:text-zinc-300 text-zinc-700 font-bold underline decoration-zinc-400/40';
                    
                    if (isOutline) {
                        return (
                            <span 
                                key={i} 
                                style={{ 
                                    WebkitTextStroke: `1.2px ${isBase ? '#18181b' : '#71717a'}`,
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

export const AnalysisCanvas: React.FC<AnalysisCanvasProps> = ({ 
  fonts, 
  isCompareMode = false, 
  customLabels, 
  onUpdateGlyph, 
  selectedChar = 'H', 
  onCharSelect = () => {}, 
  lastEditedMethod = MethodType.TRACY 
}) => {
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
  const [selectedDiagramMethod, setSelectedDiagramMethod] = useState<MethodType>(lastEditedMethod || MethodType.TRACY);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportElapsedMs, setExportElapsedMs] = useState(0);

  useEffect(() => {
    if (!isExportingPdf) {
      setExportElapsedMs(0);
      return;
    }
    const startTime = Date.now();
    const interval = setInterval(() => {
      setExportElapsedMs(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [isExportingPdf]);

  const [pdfExportStatus, setPdfExportStatus] = useState<{
    stage: string;
    progress: number;
    detail: string;
  }>({
    stage: 'Inicializando',
    progress: 0,
    detail: 'Preparando motor de renderização...'
  });
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

    setIsReportExportModalOpen(false);
    setIsExportingPdf(true);
    setPdfExportStatus({
      stage: 'Sincronização de Fontes',
      progress: 6,
      detail: 'Carregando fontes web e sincronizando contornos vetoriais...'
    });

    // Yield control briefly so React renders the loading screen immediately
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      // Ensure all custom fonts and webfonts are fully rasterized & ready in browser memory
      if (document.fonts && document.fonts.ready) {
        setPdfExportStatus({
          stage: 'Sincronização de Glifos',
          progress: 12,
          detail: 'Validando métricas e curvas de Bézier dos glifos...'
        });
        await document.fonts.ready;
      }

      setPdfExportStatus({
        stage: 'Análise de Geometria HD',
        progress: 22,
        detail: fontSize <= 20 
          ? 'Ativando matriz Ultra-HD (600 DPI) para máxima nitidez em corpos de texto pequenos...' 
          : 'Calculando proporções de mancha gráfica para matriz HD editorial...'
      });
      await new Promise(resolve => setTimeout(resolve, 60));

      const targetEl = exportRef.current;
      const elWidth = Math.max(800, targetEl.scrollWidth || 1200);
      const elHeight = Math.max(600, targetEl.scrollHeight || 1000);

      // Ultra-HD Quality calculation dynamically adapted to typographic body size:
      // At small sizes (e.g. <= 16px), a fixed 300 DPI yield can produce only 20-30 raster pixels per em,
      // which causes blurry serifs, muddy counters, and loss of edge contrast.
      // By dynamically supersampling to 550–650 DPI (~6000-7200px canvas width) for small body sizes,
      // small characters gain 70-85+ physical raster pixels, rendering razor-sharp contours, distinct sidebearings,
      // and crystal-clear letterforms even under close inspection or zoom in the generated PDF.
      let targetCanvasWidth = 3800; // standard display sizes (> 40px)
      if (fontSize <= 14) {
        targetCanvasWidth = 6800; // ~630 DPI ultra-HD specimen grade
      } else if (fontSize <= 20) {
        targetCanvasWidth = 6000; // ~560 DPI high-precision body grade
      } else if (fontSize <= 28) {
        targetCanvasWidth = 5200; // ~480 DPI
      } else if (fontSize <= 40) {
        targetCanvasWidth = 4400; // ~410 DPI
      }

      let exportScale = Number((targetCanvasWidth / elWidth).toFixed(2));

      // Guard within safe browser Canvas dimensional bounds (prevent exceeding memory limits)
      const maxCanvasDim = 13500;
      if (elHeight * exportScale > maxCanvasDim) {
        exportScale = Number((maxCanvasDim / elHeight).toFixed(2));
      }
      if (elWidth * exportScale > maxCanvasDim) {
        exportScale = Number((maxCanvasDim / elWidth).toFixed(2));
      }
      exportScale = Math.max(2.5, exportScale);

      const achievedDpi = Math.round((elWidth * exportScale) / (273 / 25.4));

      setPdfExportStatus({
        stage: 'Rasterização de Ultra-Alta Resolução',
        progress: 40,
        detail: `Renderizando glifos em matriz ultra-HD (${achievedDpi} DPI, escala ${exportScale}x) com anti-aliasing de alta precisão...`
      });
      await new Promise(resolve => setTimeout(resolve, 80));

      const canvas = await html2canvas(targetEl, {
        scale: exportScale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: elWidth + 300,
        height: null,
        imageTimeout: 25000,
        onclone: async (clonedDoc) => {
          // Sync loaded FontFaces into the cloned document's font registry
          try {
            if (document.fonts) {
              document.fonts.forEach((fontFace) => {
                try {
                  (clonedDoc as any).fonts?.add(fontFace);
                } catch (err) {}
              });
            }
          } catch (e) {}

          // Inject custom @font-face rules and enforce optimizeLegibility font rendering
          const cloneStyle = clonedDoc.createElement('style');
          cloneStyle.textContent = `
            ${fontFacesCSS}
            * {
              -webkit-font-smoothing: antialiased !important;
              -moz-osx-font-smoothing: grayscale !important;
              text-rendering: optimizeLegibility !important;
              font-feature-settings: "kern" 1, "liga" 1, "calt" 1 !important;
              font-kerning: normal !important;
              font-synthesis: none !important;
            }
            p, span, h4 {
              text-rendering: optimizeLegibility !important;
              letter-spacing: normal;
            }
          `;
          clonedDoc.head.appendChild(cloneStyle);

          // Await cloned document font readiness so html2canvas renders with the actual OpenType fonts
          if ((clonedDoc as any).fonts && (clonedDoc as any).fonts.ready) {
            try {
              await (clonedDoc as any).fonts.ready;
            } catch (err) {}
          }

          const element = clonedDoc.querySelector('[data-export-target="true"]') as HTMLElement;
          if (element) {
            element.style.width = `${targetEl.scrollWidth}px`;
            element.style.backgroundColor = '#ffffff';
            element.style.color = '#050811';
            element.style.height = 'auto';
            element.style.overflow = 'visible';
            element.style.maxHeight = 'none';

            // Stabilize side-by-side columns to ensure proportional distribution and avoid line overflow
            if (viewMode === 'side-by-side') {
              element.style.display = 'flex';
              element.style.flexDirection = 'row';
              element.style.width = '100%';
              const cols = element.querySelectorAll(':scope > div');
              const colCount = cols.length || 1;
              cols.forEach((col) => {
                const colEl = col as HTMLElement;
                colEl.style.minWidth = '0';
                colEl.style.maxWidth = 'none';
                colEl.style.flex = `1 1 ${100 / colCount}%`;
                colEl.style.width = `${100 / colCount}%`;
                colEl.style.overflow = 'visible';
              });
            }

            if (viewMode === 'overlay') {
              const overlayMaster = element.querySelector('.overlay-height-master') as HTMLElement;
              const masterP = overlayMaster?.querySelector('p');
              element.style.position = 'relative';
              element.style.display = 'block';

              if (overlayMaster) {
                overlayMaster.style.opacity = '1';
                overlayMaster.style.visibility = 'visible';
                overlayMaster.style.position = 'relative';
                overlayMaster.style.display = 'block';
                overlayMaster.style.width = '100%';
              }

              if (masterP) {
                masterP.style.height = 'auto';
                masterP.style.overflow = 'visible';
                masterP.style.whiteSpace = 'pre-wrap';
                masterP.style.wordBreak = 'break-word';
                const calcHeight = masterP.getBoundingClientRect().height || masterP.offsetHeight;
                element.style.minHeight = `${calcHeight + 350}px`;
                element.style.height = 'auto';
              }
            }

            // Expand scroll containers
            const containers = element.querySelectorAll('div');
            containers.forEach(div => {
              if (div.classList.contains('overflow-auto') || div.classList.contains('overflow-y-auto')) {
                div.style.overflow = 'visible';
                div.style.height = 'auto';
                div.style.maxHeight = 'none';
              }
            });

            // Adjust text elements for clean white background and deep typographic contrast
            const textElements = element.querySelectorAll('p, h4, span, div');
            textElements.forEach((el) => {
              const hEl = el as HTMLElement;
              if (hEl.style.backgroundImage && hEl.style.backgroundImage.includes('data:image/svg')) {
                hEl.style.backgroundImage = gridLight;
                return;
              }
              const style = window.getComputedStyle(hEl);
              const color = style.color;
              // Enforce high-density typographic black on light/grey text to maximize legibility and edge contrast
              if (
                color.startsWith('rgb(2') || 
                color === 'white' || 
                color.includes('255, 255') || 
                color.includes('209, 213') ||
                color.includes('156, 163, 175') ||
                color.includes('107, 114, 128') ||
                color.includes('75, 85, 99') ||
                color.includes('55, 65, 81')
              ) {
                hEl.style.color = '#050811';
              }
            });

            // Clean borders & backgrounds for paper print
            const bordered = element.querySelectorAll('.border-gray-800, .border-gray-700, .border-slate-800, .border-slate-700, .bg-gray-900, .bg-slate-900');
            bordered.forEach(el => {
              (el as HTMLElement).style.borderColor = '#e2e8f0';
              (el as HTMLElement).style.backgroundColor = '#ffffff';
            });

            if (viewMode === 'overlay') {
              const allPs = element.querySelectorAll('p');
              allPs.forEach(p => {
                const parent = p.parentElement;
                const isReference = p.closest('.overlay-height-master') || (parent && parent.classList.contains('absolute') && !p.style.webkitTextStroke.includes('px'));
                
                if (isReference) {
                  p.style.color = 'rgba(15, 23, 42, 0.08)';
                  p.style.webkitTextStroke = 'none';
                  p.style.opacity = '1';
                  p.style.visibility = 'visible';
                } else {
                  p.style.color = 'transparent';
                  p.style.opacity = '1';
                  if (p.style.webkitTextStroke && p.style.webkitTextStroke.includes('px')) {
                    const strokeParts = p.style.webkitTextStroke.split(' ');
                    const rawSize = parseFloat(strokeParts[0]);
                    if (!isNaN(rawSize)) {
                      p.style.webkitTextStroke = `${Math.max(0.7, rawSize * 0.95)}px ${strokeParts.slice(1).join(' ')}`;
                    }
                  }
                }
              });
            }

            const legend = element.querySelector('.overlay-legend') as HTMLElement;
            if (legend) {
              legend.style.position = 'absolute';
              legend.style.bottom = '12px';
              legend.style.right = '12px';
              legend.style.backgroundColor = 'rgba(255, 255, 255, 0.97)';
              legend.style.borderColor = '#cbd5e1';
              legend.style.color = '#0f172a';
              legend.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
              legend.querySelectorAll('.text-gray-300, .text-slate-300').forEach(el => (el as HTMLElement).style.color = '#0f172a');
              legend.querySelectorAll('.text-gray-400, .text-slate-400').forEach(el => (el as HTMLElement).style.color = '#475569');
            }

            const ignoreBtns = clonedDoc.querySelectorAll('button');
            ignoreBtns.forEach(btn => btn.style.display = 'none');
          }
        }
      });

      setPdfExportStatus({
        stage: 'Diagramação de Pranchas A4',
        progress: 70,
        detail: 'Calculando paginação e fatiamento sem perdas (lossless PNG)...'
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // 2. Initialize Landscape A4 PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 12; // mm
      const availableWidth = pageWidth - (margin * 2); // 273mm
      const headerHeightP1 = 37; // mm
      const headerHeightSub = 14; // mm
      const footerHeight = 10; // mm

      // Pixels per mm in the rendered canvas
      const pxPerMm = canvas.width / availableWidth;

      // Available printable height per page
      const printableHeightP1 = pageHeight - headerHeightP1 - footerHeight - margin;
      const printableHeightSub = pageHeight - headerHeightSub - footerHeight - margin;

      const sliceHeightPxP1 = Math.floor(printableHeightP1 * pxPerMm);
      const sliceHeightPxSub = Math.floor(printableHeightSub * pxPerMm);

      const totalPages = canvas.height <= sliceHeightPxP1 
        ? 1 
        : 1 + Math.ceil((canvas.height - sliceHeightPxP1) / sliceHeightPxSub);

      const dateStr = new Date().toLocaleString('pt-BR');
      const fontDisplayName = fonts[MethodType.ORIGINAL]?.fontObj?.names?.fontFamily?.en || labelOriginal || 'Fonte';
      const viewModeLabel = viewMode === 'side-by-side' ? 'Comparação Lado a Lado' : 'Sobreposição Óptica (Overlay)';

      // Helper function to draw Header
      const drawHeader = (pageNum: number) => {
        pdf.setFillColor(255, 255, 255);
        if (pageNum === 1) {
          pdf.rect(0, 0, pageWidth, headerHeightP1, 'F');
          
          // Top accent brand band (System Blue #2563eb and Indigo #4f46e5)
          pdf.setFillColor(37, 99, 235);
          pdf.rect(margin, 0, (pageWidth - (margin * 2)) * 0.65, 1.2, 'F');
          pdf.setFillColor(79, 70, 229);
          pdf.rect(margin + (pageWidth - (margin * 2)) * 0.65, 0, (pageWidth - (margin * 2)) * 0.35, 1.2, 'F');

          // Hairline rule under header
          pdf.setDrawColor(226, 232, 240); // slate-200
          pdf.setLineWidth(0.35);
          pdf.line(margin, headerHeightP1 - 2, pageWidth - margin, headerHeightP1 - 2);

          // Brand Title
          pdf.setTextColor(15, 23, 42); // slate-900
          pdf.setFontSize(13);
          pdf.setFont("helvetica", "bold");
          pdf.text("SAAME TYPOGRAPHY LAB", margin, 9);

          // Technical Badge pill on right side in system colors
          pdf.setFillColor(239, 246, 255); // blue-50
          pdf.setDrawColor(191, 219, 254); // blue-200
          pdf.setLineWidth(0.2);
          const badgeText = `PADRÃO EDITORIAL HD • ${achievedDpi} DPI • A4 PAISAGEM`;
          const badgeWidth = (pdf.getStringUnitWidth(badgeText) * 6.5 / pdf.internal.scaleFactor) + 6;
          const badgeX = pageWidth - margin - badgeWidth;
          pdf.roundedRect(badgeX, 5, badgeWidth, 5.5, 1.2, 1.2, 'FD');
          pdf.setTextColor(29, 78, 216); // blue-700
          pdf.setFontSize(6.5);
          pdf.setFont("helvetica", "bold");
          pdf.text(badgeText, badgeX + 3, 8.8);

          // Subtitle
          pdf.setFontSize(7.5);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 116, 139); // slate-500
          pdf.text("SISTEMA DE ANÁLISE E APLICAÇÃO DE MÉTODOS DE ESPAÇAMENTO TIPOGRÁFICO", margin, 13.5);

          // Metadata Grid: Column 1 (Font & View)
          pdf.setFontSize(8);
          pdf.setTextColor(30, 41, 59); // slate-800
          pdf.setFont("helvetica", "bold");
          pdf.text("FONTE / ESPÉCIME:", margin, 20);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(`${fontDisplayName} (${viewModeLabel})`, margin, 24.5);
          pdf.text(`Data da Emissão: ${dateStr}`, margin, 29);

          // Metadata Grid: Column 2 (Parameters)
          const col2X = margin + 85;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 41, 59);
          pdf.text("PARÂMETROS TIPOGRÁFICOS:", col2X, 20);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(71, 85, 105);
          pdf.text(`Corpo: ${fontSize}px  •  Entrelinha: ${lineHeight}em  •  Matriz: ${achievedDpi} DPI`, col2X, 24.5);
          const casingText = textCase === 'uppercase' ? 'Caixa Alta (MAIÚSCULAS)' : textCase === 'lowercase' ? 'Caixa Baixa (minúsculas)' : 'Caixa Normal';
          const alignText = textAlign === 'left' ? 'À Esquerda' : textAlign === 'center' ? 'Centralizado' : textAlign === 'right' ? 'À Direita' : 'Justificado';
          pdf.text(`Caixa: ${casingText}  •  Alinhamento: ${alignText}`, col2X, 29);

          // Metadata Grid: Column 3 (Legend)
          const col3X = margin + 175;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(30, 41, 59);
          pdf.text("MÉTODOS ANALISADOS:", col3X, 20);
          pdf.setFont("helvetica", "normal");

          let legX = col3X;
          let legY = 24.5;
          activeMethods.forEach((method) => {
            if (method === MethodType.ORIGINAL) {
              pdf.setFillColor(148, 163, 184); // slate-400
              pdf.rect(legX, legY - 2.5, 2.5, 2.5, 'F');
              pdf.setTextColor(71, 85, 105);
              pdf.text("Original", legX + 4, legY);
            } else if (method === MethodType.ORIGINAL_CUSTOM) {
              pdf.setFillColor(59, 130, 246); // blue-500
              pdf.rect(legX, legY - 2.5, 2.5, 2.5, 'F');
              pdf.setTextColor(71, 85, 105);
              pdf.text("Manual", legX + 4, legY);
            } else if (method === MethodType.TRACY) {
              pdf.setFillColor(236, 72, 153); // pink-500
              pdf.rect(legX, legY - 2.5, 2.5, 2.5, 'F');
              pdf.setTextColor(71, 85, 105);
              pdf.text(isCompareMode ? 'Experimental' : 'Tracy', legX + 4, legY);
            } else if (method === MethodType.SOUSA) {
              pdf.setFillColor(6, 182, 212); // cyan-500
              pdf.rect(legX, legY - 2.5, 2.5, 2.5, 'F');
              pdf.setTextColor(71, 85, 105);
              pdf.text("Sousa", legX + 4, legY);
            }
            legX += 23;
          });
        } else {
          // Running header on page 2+
          pdf.rect(0, 0, pageWidth, headerHeightSub, 'F');
          
          // Accent line in system blue
          pdf.setFillColor(37, 99, 235);
          pdf.rect(margin, 0, pageWidth - (margin * 2), 0.8, 'F');

          pdf.setDrawColor(226, 232, 240);
          pdf.setLineWidth(0.25);
          pdf.line(margin, headerHeightSub - 2, pageWidth - margin, headerHeightSub - 2);

          pdf.setTextColor(15, 23, 42);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica", "bold");
          pdf.text("SAAME TYPOGRAPHY LAB", margin, 7.5);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 116, 139);
          pdf.text(`•  ${fontDisplayName}  •  ${viewModeLabel}  (Continuação)`, margin + 45, 7.5);
        }
      };

      // Helper function to draw Footer
      const drawFooter = (pageNum: number) => {
        const footerY = pageHeight - 6;
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.25);
        pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(148, 163, 184); // slate-400
        pdf.text(`SAAME Typography Lab • Sistema de Aplicação e Análise de Métodos de Espaçamento • Resolução HD (${achievedDpi} DPI)`, margin, footerY);

        const pageStr = `Página ${pageNum} de ${totalPages}`;
        const pageStrWidth = pdf.getStringUnitWidth(pageStr) * 7 / pdf.internal.scaleFactor;
        pdf.text(pageStr, pageWidth - margin - pageStrWidth, footerY);
      };

      // Page Slicing Loop:
      let currentSourceY = 0;
      for (let p = 1; p <= totalPages; p++) {
        if (p > 1) {
          pdf.addPage();
        }

        const startY = p === 1 ? headerHeightP1 : headerHeightSub;
        const maxSlicePx = p === 1 ? sliceHeightPxP1 : sliceHeightPxSub;
        const remainingPx = canvas.height - currentSourceY;
        const currentSliceHeightPx = Math.min(maxSlicePx, remainingPx);

        if (currentSliceHeightPx <= 0) break;

        // Slice canvas via temporary offscreen canvas with bit-perfect 1:1 pixel transfer (no resampling blur)
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = currentSliceHeightPx;
        const sCtx = sliceCanvas.getContext('2d', { alpha: false });
        if (sCtx) {
          sCtx.imageSmoothingEnabled = false; // 1:1 pixel copy without interpolation blur
          sCtx.fillStyle = '#ffffff';
          sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sCtx.drawImage(
            canvas,
            0, currentSourceY, canvas.width, currentSliceHeightPx,
            0, 0, canvas.width, currentSliceHeightPx
          );
        }

        // Lossless PNG for razor-sharp HD letterforms
        const sliceData = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = currentSliceHeightPx / pxPerMm;

        pdf.addImage(sliceData, 'PNG', margin, startY, availableWidth, sliceHeightMm, undefined, 'FAST');

        drawHeader(p);
        drawFooter(p);

        currentSourceY += currentSliceHeightPx;

        setPdfExportStatus({
          stage: 'Compondo Pranchas',
          progress: Math.min(94, Math.round(70 + (p / totalPages) * 22)),
          detail: `Processando prancha ${p} de ${totalPages} em alta resolução...`
        });
      }

      setPdfExportStatus({
        stage: 'Finalizando Documento',
        progress: 98,
        detail: 'Gravando metadados e gerando download do arquivo PDF HD...'
      });
      await new Promise(resolve => setTimeout(resolve, 80));

      const finalFileName = (typeof customName === 'string' && customName.length > 0) ? customName : `Relatorio_Analise_${Date.now()}`;
      pdf.save(finalFileName.toLowerCase().endsWith('.pdf') ? finalFileName : `${finalFileName}.pdf`);

      setPdfExportStatus({
        stage: 'Concluído!',
        progress: 100,
        detail: 'Download do relatório em alta definição concluído com sucesso!'
      });
      await new Promise(resolve => setTimeout(resolve, 350));
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Falha ao gerar PDF de alta definição. Verifique o console para mais detalhes.");
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
                          <div key={char} className={`dark:bg-zinc-800/40 bg-zinc-200/40 rounded p-3 border ${hasChange ? 'dark:border-zinc-600 border-zinc-400 dark:bg-zinc-800/80 bg-zinc-100' : 'dark:border-zinc-700/50 border-zinc-300/50'} flex flex-col gap-2 group dark:hover:bg-zinc-800 hover:bg-zinc-200 transition-colors`}>
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
                                      <span className={`font-mono font-medium ${diffL !== 0 ? 'dark:text-white text-zinc-900 font-bold' : 'dark:text-gray-400 text-gray-600'}`}>
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
                                      <span className={`font-mono font-medium ${diffR !== 0 ? 'dark:text-white text-zinc-900 font-bold' : 'dark:text-gray-400 text-gray-600'}`}>
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
                            <div key={g.unicode} className={`dark:bg-zinc-800/40 bg-zinc-200/40 rounded p-3 border ${hasChange ? 'dark:border-zinc-600 border-zinc-400 dark:bg-zinc-800/80 bg-zinc-100' : 'dark:border-zinc-700/50 border-zinc-300/50'} flex flex-col gap-2 group dark:hover:bg-zinc-800 hover:bg-zinc-200 transition-colors`}>
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
                                        <span className={`font-mono font-medium ${diffL !== 0 ? 'dark:text-white text-zinc-900 font-bold' : 'dark:text-gray-400 text-gray-600'}`}>
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
                                        <span className={`font-mono font-medium ${diffR !== 0 ? 'dark:text-white text-zinc-900 font-bold' : 'dark:text-gray-400 text-gray-600'}`}>
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
    <div className="flex flex-col flex-1 w-full min-h-[650px] dark:bg-gray-900 bg-gray-100 rounded-xl border dark:border-gray-700 border-gray-300 shadow-xl overflow-hidden touch-pan-y touch-pan-x">
       {/* Inject Local Styles to enforce precision within this canvas context */}
       <style>
            {fontFacesCSS}
       </style>

      {/* Toolbar */}
      <div className="dark:bg-gray-800 bg-gray-200 p-2 md:p-3 flex flex-col gap-2 md:gap-4 border-b dark:border-gray-700 border-gray-300">
        <div className="flex items-stretch sm:items-end justify-between gap-3 sm:gap-4 flex-wrap w-full">
            {/* Left Block: Navegação, Modos de Visualização, Comparação */}
            <div className="flex items-stretch sm:items-end gap-3 sm:gap-6 flex-wrap w-full lg:w-auto">
                {/* View Mode Navigator (Always Visible) */}
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        <Columns className="w-3.5 h-3.5 dark:text-white text-zinc-900" />
                        1. Navegação
                    </span>
                    <div className="grid grid-cols-3 gap-1 dark:bg-gray-700/50 bg-gray-300/50 rounded-lg p-1 shadow-inner w-full sm:w-auto">
                        <button 
                            onClick={() => setViewMode('side-by-side')}
                            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'side-by-side' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Análise Comparativa (Lado a Lado)"
                        >
                            <Columns className="w-3.5 h-3.5" />
                            <span className="truncate">Comparativo</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('overlay')}
                            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'overlay' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Visualização Overlay"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span className="truncate">Overlay</span>
                        </button>
                        <button 
                            onClick={() => setViewMode('metrics')}
                            className={`flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'metrics' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white shadow-sm' : 'dark:text-gray-400 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            title="Dados de Métricas / Diagrama"
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span className="truncate">Diagrama</span>
                        </button>
                    </div>
                </div>

                {/* Conditional Tools */}
                {viewMode !== 'metrics' && (
                  <>
                      {/* Comparação (Second Section) */}
                      {!isCompareMode && (
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                            <Edit2 className="w-3.5 h-3.5 dark:text-white text-zinc-900" />
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
                                    className={`px-2.5 py-1 text-xs font-black rounded-md transition-all ${activeMethods.includes(m.type) ? 'dark:bg-white dark:text-black bg-zinc-900 text-white shadow-sm opacity-100' : 'dark:bg-gray-800 bg-white dark:text-gray-400 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 opacity-60 hover:opacity-100'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                      </div>
                      )}

                      {/* Modos de Visualização (Third Section) */}
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                          <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                              <Type className="w-3.5 h-3.5 dark:text-white text-zinc-900" />
                              3. Modos
                          </span>
                          <div className="flex overflow-x-auto gap-1 custom-scrollbar">
                              <button 
                                  onClick={() => setPreset(PARAGRAPH_TEXT, 30, 'paragraph')} 
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap ${analysisPreset === 'paragraph' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white font-bold' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}
                              >
                                <AlignJustify className="w-3.5 h-3.5" />
                                Parágrafo
                              </button>
                              <button 
                                  onClick={() => setPreset(FULL_SET_TEXT, 48, 'full-set')} 
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap ${analysisPreset === 'full-set' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white font-bold' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}
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
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all whitespace-nowrap ${analysisPreset === 'words-overlay' ? 'dark:bg-white dark:text-black bg-zinc-900 text-white font-bold' : 'dark:bg-gray-700 bg-gray-300 dark:text-gray-300 hover:bg-opacity-80'}`}                
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
            <div className="flex items-stretch sm:items-end gap-3 sm:gap-6 flex-wrap w-full lg:w-auto justify-between sm:justify-end">
                {/* Settings Group */}
                {viewMode !== 'metrics' && (
                    <div className="flex gap-2 sm:gap-4 items-end flex-wrap">
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Tamanho</span>
                            <div className="flex items-center gap-1.5 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
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
                            <div className="flex items-center gap-1.5 px-2 dark:bg-gray-700/50 bg-gray-300/50 rounded p-1">
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
                                        className={`p-1.5 rounded transition-colors ${textAlign === align.id ? 'dark:bg-white bg-zinc-900 dark:text-black text-white' : 'dark:text-gray-400 text-gray-600 hover:bg-gray-400/20'}`}
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
                                        className={`px-2 py-1 rounded text-xs font-black tracking-wider transition-colors ${textCase === casing.id ? 'dark:bg-white bg-zinc-900 dark:text-black text-white' : 'dark:text-gray-400 text-gray-500 hover:bg-gray-400/20'}`}
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
                        className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2 dark:bg-white dark:hover:bg-zinc-200 dark:text-black bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-black/10 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed h-[38px] self-end cursor-pointer w-full sm:w-auto"
                        title="Exportar Relatório PDF em Alta Resolução (HD 300 DPI)"
                    >
                        {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        <span className="inline">Relatório PDF</span>
                        <span className="text-[10px] font-black dark:bg-black/20 bg-white/20 px-1.5 py-0.5 rounded tracking-normal">HD</span>
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
                    className="w-full dark:bg-gray-700/80 bg-gray-300/80 border dark:border-gray-600 border-gray-400 rounded-xl px-4 py-3 text-lg dark:text-gray-200 text-gray-800 font-sans resize-none h-24 leading-tight shadow-inner focus:ring-1 focus:ring-zinc-500 dark:focus:ring-zinc-400 outline-none"
                    placeholder="Insira o texto para análise..."
                />
                
                {/* Text Block Variations Suggestions based on View Mode */}
                <div className="flex flex-col gap-2 p-3 bg-slate-300/30 dark:bg-slate-900/40 rounded-xl border dark:border-slate-800/80 border-slate-300/80">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-black dark:text-gray-400 text-gray-500 tracking-widest flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full dark:bg-white bg-zinc-900 animate-pulse"></span>
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
                                            ? 'dark:bg-white dark:text-black bg-zinc-900 text-white shadow-md shadow-black/10 scale-[1.02]'
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
      <div className="flex-1 min-h-[480px] overflow-x-auto overflow-y-auto dark:bg-gray-950 bg-gray-50 relative custom-scrollbar touch-scroll-area touch-pan-y touch-pan-x">
        
        {viewMode === 'side-by-side' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className={`flex gap-0 min-h-full min-w-full divide-x divide-gray-800 dark:bg-gray-950 bg-gray-50 overflow-visible touch-scroll-area touch-pan-y touch-pan-x`}
             >
                {/* 1. Original */}
                {activeMethods.includes(MethodType.ORIGINAL) && (
                <div className={`flex flex-col flex-1 dark:bg-gray-900/30 bg-gray-100/30 order-1 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[320px] sm:min-w-[420px] md:min-w-[48%]' : activeMethods.length === 3 ? 'min-w-[300px] sm:min-w-[360px] md:min-w-[32%]' : 'min-w-[280px] sm:min-w-[320px] md:min-w-[24%]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest dark:text-gray-400 text-gray-600 truncate max-w-[200px]" title={labelOriginal}>
                            {labelOriginal}
                         </h4>
                         <button onClick={() => handleExport(MethodType.ORIGINAL)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs rounded-lg border border-slate-300 dark:border-slate-700 transition-all cursor-pointer" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: originalFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-gray-300 text-gray-700 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                     </div>
                </div>
                )}

                {/* 1.5 Ajuste Manual */}
                {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                    <div className={`flex flex-col flex-1 order-2 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[320px] sm:min-w-[420px] md:min-w-[48%]' : activeMethods.length === 3 ? 'min-w-[300px] sm:min-w-[360px] md:min-w-[32%]' : 'min-w-[280px] sm:min-w-[320px] md:min-w-[24%]'} shrink-0`}>
                         <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                             <h4 className="text-sm font-bold uppercase tracking-widest dark:text-slate-400 text-slate-600">Ajuste Manual</h4>
                             <button onClick={() => handleExport(MethodType.ORIGINAL_CUSTOM)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs rounded-lg border border-slate-300 dark:border-slate-700 transition-all cursor-pointer" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                         </div>
                         <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                            <p style={{ fontFamily: fonts[MethodType.ORIGINAL_CUSTOM]?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-gray-200 text-gray-800 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                                <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                            </p>
                         </div>
                    </div>
                )}

                {/* 2. Adjusted / Tracy */}
                {activeMethods.includes(MethodType.TRACY) && (
                <div className={`flex flex-col flex-1 order-3 overflow-visible ${activeMethods.length === 1 ? 'dark:bg-gray-900/40 bg-gray-100/40 min-w-full' : activeMethods.length === 2 ? 'min-w-[320px] sm:min-w-[420px] md:min-w-[48%]' : activeMethods.length === 3 ? 'min-w-[300px] sm:min-w-[360px] md:min-w-[32%]' : 'min-w-[280px] sm:min-w-[320px] md:min-w-[24%]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest dark:text-white text-slate-900 truncate max-w-[200px]" title={labelTracy}>
                            {labelTracy}
                         </h4>
                         <button onClick={() => handleExport(MethodType.TRACY)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs rounded-lg border border-slate-300 dark:border-slate-700 transition-all cursor-pointer" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
                        <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className={`dark:text-white text-slate-900 whitespace-pre-wrap break-words w-full h-auto text-${textAlign}`}>
                            <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                        </p>
                     </div>
                </div>
                )}

                {/* 3. Sousa */}
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className={`flex flex-col flex-1 order-4 overflow-visible ${activeMethods.length === 1 ? 'min-w-full' : activeMethods.length === 2 ? 'min-w-[320px] sm:min-w-[420px] md:min-w-[48%]' : activeMethods.length === 3 ? 'min-w-[300px] sm:min-w-[360px] md:min-w-[32%]' : 'min-w-[280px] sm:min-w-[320px] md:min-w-[24%]'} shrink-0`}>
                     <div className="p-3 border-b dark:border-gray-800 border-gray-200 dark:bg-gray-900 bg-gray-100 flex justify-between items-center sticky top-0 z-10" data-html2canvas-ignore>
                         <h4 className="text-sm font-bold uppercase tracking-widest dark:text-white text-slate-900 truncate max-w-[200px]">Método Miguel Sousa</h4>
                         <button onClick={() => handleExport(MethodType.SOUSA)} className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs rounded-lg border border-slate-300 dark:border-slate-700 transition-all cursor-pointer" data-html2canvas-ignore><Download className="w-4 h-4"/> OTF</button>
                     </div>
                     <div className="p-4 sm:p-6 md:p-8 flex-1 overflow-visible flex items-start justify-start">
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
                    <h4 className="text-sm font-bold uppercase tracking-widest dark:text-white text-zinc-900 mb-4">{labelTracy}</h4>
                    <p style={{ fontFamily: tracyFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                    </p>
                    <button onClick={() => handleExport(MethodType.TRACY)} className="text-sm dark:text-white text-zinc-900 dark:hover:text-zinc-200 hover:text-black flex gap-2 items-center dark:bg-zinc-800 bg-zinc-200 border dark:border-zinc-700 border-zinc-300 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download {isCompareMode ? labelTracy.toUpperCase() : 'TRACY'}</button>
                </div>
                )}
                
                {activeMethods.includes(MethodType.SOUSA) && (
                <div className="pt-12">
                    <h4 className="text-sm font-bold uppercase tracking-widest dark:text-white text-zinc-900 mb-4">Método Miguel Sousa</h4>
                    <p style={{ fontFamily: sousaFont?.fullFontFamily || 'serif', fontSize: `${fontSize}px`, lineHeight: lineHeight }} className="dark:text-white text-slate-900 whitespace-pre-wrap mb-4 text-left">
                        <RenderedText text={processedText} baseChar={selectedAdjustment?.char || null} />
                    </p>
                    <button onClick={() => handleExport(MethodType.SOUSA)} className="text-sm dark:text-white text-zinc-900 dark:hover:text-zinc-200 hover:text-black flex gap-2 items-center dark:bg-zinc-800 bg-zinc-200 border dark:border-zinc-700 border-zinc-300 px-3 py-1.5 rounded"><Download className="w-3 h-3"/> Download SOUSA</button>
                </div>
                )}
             </div>
        )}

        {viewMode === 'overlay' && (
             <div 
                ref={exportRef} 
                data-export-target="true"
                className="min-h-full w-full relative flex flex-col items-center justify-start dark:bg-gray-950 bg-gray-50 p-4 sm:p-8 overflow-visible"
             >
                <div className="flex flex-wrap gap-3 w-full justify-start mb-6" data-html2canvas-ignore>
                     {activeMethods.includes(MethodType.ORIGINAL) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded-lg">
                        <div className="w-3 h-3 bg-gray-500 rounded-sm"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelOriginal}</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded-lg">
                        <div className="w-3 h-3 dark:bg-white bg-zinc-900 rounded-sm"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">Ajuste Manual</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.TRACY) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded-lg">
                        <div className="w-3 h-3 dark:bg-zinc-400 bg-zinc-600 rounded-sm"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">{labelTracy}</span>
                     </div>
                     )}
                     {activeMethods.includes(MethodType.SOUSA) && (
                     <div className="flex items-center gap-2 px-3 py-1.5 dark:bg-gray-900 bg-gray-100 border dark:border-gray-800 border-gray-200 rounded-lg">
                        <div className="w-3 h-3 dark:bg-zinc-500 bg-zinc-400 rounded-sm"></div>
                        <span className="text-xs dark:text-gray-400 text-gray-600 font-bold uppercase tracking-wider">Sousa</span>
                     </div>
                     )}
                </div>

                {/* Legend Overlay */}
                <div className="overlay-legend p-3.5 sm:p-4 dark:bg-gray-900/80 bg-gray-100/90 backdrop-blur-md rounded-xl border dark:border-gray-800 border-gray-200 shadow-xl flex flex-wrap gap-4 items-center justify-between w-full mb-6 z-[20]" data-html2canvas-ignore>
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] dark:text-gray-400 text-gray-600">Legenda Métricas:</span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {activeMethods.includes(MethodType.ORIGINAL) && (
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm dark:bg-white/20 bg-black/20"></div>
                            <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ref. Original (Massa)</span>
                        </div>
                        )}
                        
                        {activeMethods.includes(MethodType.ORIGINAL_CUSTOM) && (
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm border dark:border-white border-zinc-900"></div>
                            <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Ajuste Manual Contorno</span>
                        </div>
                        )}

                        {activeMethods.includes(MethodType.TRACY) && (
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm border dark:border-zinc-400 border-zinc-600"></div>
                            <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Tracy Contorno</span>
                        </div>
                        )}
                        
                        {activeMethods.includes(MethodType.SOUSA) && (
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm border dark:border-zinc-500 border-zinc-500"></div>
                            <span className="text-xs dark:text-gray-300 text-gray-700 font-bold">Sousa Contorno</span>
                        </div>
                        )}
                    </div>
                </div>

                <div 
                    className="relative w-full overflow-y-auto overflow-x-auto min-h-[420px] custom-scrollbar px-4 pt-6 pb-16 touch-scroll-area touch-pan-y touch-pan-x"
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
                    <div className="absolute inset-0 pt-6 pointer-events-none">
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
                    <div className="absolute inset-0 pt-6 pointer-events-none">
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
                    <div className="absolute inset-0 pt-6 pointer-events-none">
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
                    <div className="absolute inset-0 pt-6 pointer-events-none">
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
             <div className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-auto overflow-y-visible custom-scrollbar touch-scroll-area touch-pan-y touch-pan-x">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-2xl font-bold flex gap-2 items-center dark:text-white text-slate-900">
                            <BarChart2 className="dark:text-white text-slate-900" /> Diagrama de Espaçamentos
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
                                className="w-full dark:bg-gray-800 bg-gray-200 border dark:border-gray-700 border-gray-300 rounded-lg pl-10 pr-4 py-2 text-xs dark:text-white text-slate-900 focus:border-zinc-500 dark:focus:border-zinc-400 outline-none transition-all"
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
                                     <h4 className="font-bold dark:text-white text-slate-900 mb-4">{labelTracy}</h4>
                                     <div className="flex justify-between text-base mb-2 dark:text-zinc-300 text-zinc-700">
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
                                   <span className="text-[11px] uppercase font-black px-2 py-0.5 rounded-md dark:bg-zinc-800 bg-zinc-200 dark:text-zinc-200 text-zinc-800">INDIVIDUAL</span>
                               </div>
                                <button onClick={() => setSelectedAdjustment(null)} className="p-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-all shadow-sm">
                                    <X className="w-4 h-4 dark:text-slate-400 text-slate-600" />
                                </button>
                                <button onClick={() => setSelectedAdjustment(null)} className="ml-2 px-4 py-2 dark:bg-white dark:hover:bg-zinc-200 dark:text-black bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all shadow-sm text-sm font-bold uppercase">
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
                                                className="text-center bg-transparent border-none outline-none font-mono text-base text-slate-800 dark:text-slate-200 border-b border-dashed border-zinc-500 dark:border-zinc-400 py-1 w-full max-w-xs focus:ring-0"
                                            />
                                            <p className="text-[10px] dark:text-zinc-400 text-zinc-600 mt-2 font-mono uppercase tracking-widest font-black animate-pulse">Enter para salvar</p>
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
                                            <div className="absolute top-1 right-1 opacity-0 group-hover/preview:opacity-100 transition-opacity dark:bg-zinc-800 bg-zinc-200 dark:text-white text-zinc-900 p-1 rounded">
                                                <Edit2 className="w-3 h-3" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* LSB Slider */}
                                <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                     <div className="flex justify-between items-center mb-3">
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING ESQUERDO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg dark:text-white text-zinc-900 font-bold text-sm shadow-sm">{selectedAdjustment.lsb}</span>
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
                                         className="w-full accent-zinc-900 dark:accent-white h-1.5 dark:bg-slate-700 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none"
                                     />
                                </div>
    
                                {/* RSB Slider */}
                                <div className="dark:bg-slate-900/50 bg-slate-50 p-4 rounded-2xl border dark:border-slate-800 border-slate-200 shadow-inner">
                                     <div className="flex justify-between items-center mb-3">
                                         <label className="text-xs font-black dark:text-slate-400 text-slate-600 uppercase tracking-widest">SIDE BEARING DIREITO</label>
                                         <span className="px-3 py-1 bg-white dark:bg-slate-800 border dark:border-slate-700 border-slate-200 rounded-lg dark:text-white text-zinc-900 font-bold text-sm shadow-sm">{selectedAdjustment.rsb}</span>
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
                                         className="w-full accent-zinc-900 dark:accent-white h-1.5 dark:bg-slate-700 bg-slate-200 rounded-lg appearance-none cursor-pointer outline-none"
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
                                    <Download className="w-6 h-6 dark:text-white text-zinc-900" /> Baixar Fonte
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
                                        className="w-full bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 border-slate-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 outline-none transition-shadow font-medium text-slate-900 dark:text-white"
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
                                    className="flex-1 px-6 py-4 rounded-2xl dark:bg-white dark:hover:bg-zinc-200 dark:text-black bg-zinc-900 hover:bg-zinc-800 text-white font-bold shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2"
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
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl border dark:border-slate-800 border-slate-200 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-start mb-5">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full dark:bg-zinc-800 bg-zinc-100 border dark:border-zinc-700 border-zinc-200 dark:text-zinc-200 text-zinc-800 text-[10px] font-black uppercase tracking-wider mb-2">
                                        <Sparkles className="w-3 h-3" />
                                        <span>Motor de Alta Fidelidade (Ultra-HD 300–600 DPI)</span>
                                    </div>
                                    <h3 className="text-xl font-black dark:text-white text-slate-900 flex items-center gap-2.5 font-display tracking-tight">
                                        <FileText className="w-5 h-5 dark:text-white text-zinc-900" /> Relatório Técnico em PDF
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => setIsReportExportModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                                    aria-label="Fechar"
                                >
                                    <X className="w-5 h-5 dark:text-slate-500 text-slate-400" />
                                </button>
                            </div>
                            
                            <p className="text-xs dark:text-slate-400 text-slate-500 mb-5 leading-relaxed">
                                Gere um documento gráfico diagramado em formato A4 Paisagem com cabeçalho técnico vetorial, métricas de ritmo tipográfico e renderização em altíssima resolução adaptativa.
                            </p>

                            {/* Technical Specs Specimen Box */}
                            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 mb-6 text-[11px]">
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Resolução</span>
                                    <span className="font-bold dark:text-zinc-200 text-zinc-800 font-mono">
                                        {fontSize <= 20 ? 'Ultra-HD (600 DPI)' : 'HD (300+ DPI)'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Prancha</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">A4 Paisagem</span>
                                </div>
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Visualização</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                                        {viewMode === 'side-by-side' ? 'Lado a Lado' : 'Sobreposição'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="space-y-4 mb-7">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider dark:text-slate-400 text-slate-500 mb-2 truncate">
                                        Nome do Arquivo do Relatório (.pdf)
                                    </label>
                                    <div className="relative flex items-center">
                                        <input 
                                            autoFocus
                                            type="text" 
                                            value={reportFileName}
                                            onChange={(e) => setReportFileName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') confirmReportExport();
                                                if (e.key === 'Escape') setIsReportExportModalOpen(false);
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-800/60 border dark:border-slate-800 border-slate-200 rounded-2xl pl-4 pr-14 py-3.5 focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 outline-none transition-shadow font-mono text-xs text-slate-900 dark:text-white"
                                            placeholder="Ex: Relatorio_MinhaFonte"
                                        />
                                        <span className="absolute right-4 text-xs font-mono font-bold text-slate-400 select-none">
                                            .pdf
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setIsReportExportModalOpen(false)}
                                    className="flex-1 px-5 py-3.5 rounded-2xl border dark:border-slate-800 border-slate-200 dark:text-slate-400 text-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmReportExport}
                                    className="flex-1 px-5 py-3.5 rounded-2xl dark:bg-white dark:hover:bg-zinc-200 dark:text-black bg-zinc-900 hover:bg-zinc-800 text-white font-bold shadow-lg shadow-black/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    <Sparkles className="w-4 h-4" /> Gerar PDF HD
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Full-Screen High-Definition Loading Modal */}
        <AnimatePresence>
            {isExportingPdf && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
                    style={{ pointerEvents: 'all' }}
                >
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl md:rounded-[2.5rem] shadow-2xl w-full max-w-lg p-7 md:p-8 overflow-hidden relative"
                    >
                        {/* System ambient glows */}
                        <div className="absolute top-0 right-0 w-52 h-52 bg-zinc-400/10 dark:bg-zinc-600/10 blur-3xl rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-52 h-52 bg-zinc-400/10 dark:bg-zinc-600/10 blur-3xl rounded-full pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center text-center">
                            {/* Typographic Glyph Rhythm Specimen Visualizer */}
                            <div className="w-20 h-20 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center mb-4 relative overflow-hidden shadow-inner">
                                <div className="flex items-center gap-1 font-serif text-slate-800 dark:text-slate-200 font-bold text-lg select-none">
                                    <span className="dark:text-white text-zinc-900">H</span>
                                    <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>
                                    <span className="dark:text-zinc-300 text-zinc-700">n</span>
                                    <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>
                                    <span className="dark:text-zinc-400 text-zinc-600">O</span>
                                </div>
                                <span className="text-[9px] font-mono font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-widest mt-0.5">
                                    300 DPI
                                </span>
                                
                                {/* Side-bearing guide lines */}
                                <div className="absolute inset-y-0 left-2 w-[1px] border-l border-dashed border-zinc-400/40 dark:border-zinc-600/40" />
                                <div className="absolute inset-y-0 right-2 w-[1px] border-r border-dashed border-zinc-400/40 dark:border-zinc-600/40" />

                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute -inset-1 rounded-2xl border border-dashed border-zinc-400/40 dark:border-zinc-600/40 pointer-events-none"
                                />
                            </div>

                            {/* HD Specs Chip */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full dark:bg-zinc-800 bg-zinc-100 border dark:border-zinc-700 border-zinc-200 dark:text-zinc-200 text-zinc-800 text-[11px] font-bold uppercase tracking-wider mb-2.5">
                                <Sparkles className="w-3.5 h-3.5 animate-pulse dark:text-white text-zinc-900" />
                                <span>Padrão Gráfico HD • 300 DPI • A4 Paisagem</span>
                            </div>

                            <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white mb-1.5 font-display">
                                Gerando Relatório Tipográfico
                            </h3>
                            
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-relaxed">
                                Rasterizando curvas de Bézier e calculando ritmo de mancha gráfica com anti-aliasing geométrico de altíssima definição.
                            </p>

                            {/* Progress Bar with System Monochrome Style */}
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-2.5 overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700/60 shadow-inner">
                                <motion.div
                                    className="h-full bg-zinc-900 dark:bg-white rounded-full"
                                    animate={{ width: `${pdfExportStatus.progress}%` }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                />
                            </div>

                            {/* Progress Meta Row */}
                            <div className="w-full flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-4 px-1">
                                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-sans">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin dark:text-white text-zinc-900" />
                                    {pdfExportStatus.stage}
                                </span>
                                <div className="flex items-center gap-2 font-mono text-xs">
                                    <span className="text-slate-400 dark:text-slate-500 text-[10px]">
                                        {(exportElapsedMs / 1000).toFixed(1)}s
                                    </span>
                                    <span className="font-bold dark:text-white text-zinc-900">
                                        {pdfExportStatus.progress}%
                                    </span>
                                </div>
                            </div>

                            {/* 4-Step Pipeline Badges */}
                            <div className="w-full grid grid-cols-4 gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 text-[10px] font-bold text-slate-400 dark:text-slate-500 text-center mb-4">
                                <div className={`p-1.5 rounded-lg transition-all ${pdfExportStatus.progress >= 15 ? 'bg-white dark:bg-zinc-800 dark:text-white text-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-700' : ''}`}>
                                    1. Fontes
                                </div>
                                <div className={`p-1.5 rounded-lg transition-all ${pdfExportStatus.progress >= 35 ? 'bg-white dark:bg-zinc-800 dark:text-white text-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-700' : ''}`}>
                                    2. Raster HD
                                </div>
                                <div className={`p-1.5 rounded-lg transition-all ${pdfExportStatus.progress >= 70 ? 'bg-white dark:bg-zinc-800 dark:text-white text-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-700' : ''}`}>
                                    3. Pranchas
                                </div>
                                <div className={`p-1.5 rounded-lg transition-all ${pdfExportStatus.progress >= 95 ? 'bg-white dark:bg-zinc-800 dark:text-white text-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-700' : ''}`}>
                                    4. Download
                                </div>
                            </div>

                            {/* Technical Detail Message */}
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic max-w-sm font-mono truncate">
                                {pdfExportStatus.detail}
                            </p>

                            {/* Adaptive Reassurance Note if processing takes a few seconds */}
                            <AnimatePresence>
                                {exportElapsedMs > 2500 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0, y: 6 }}
                                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3 w-full p-2.5 rounded-xl dark:bg-zinc-800/80 bg-zinc-100 border dark:border-zinc-700 border-zinc-300 text-[11px] dark:text-zinc-300 text-zinc-700 flex items-center gap-2 text-left"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 shrink-0 dark:text-white text-zinc-900" />
                                        <span className="leading-snug">
                                            A calibragem a 300 DPI assegura fidelidade milimétrica para impressão e documentos vetoriais de alta resolução.
                                        </span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};
