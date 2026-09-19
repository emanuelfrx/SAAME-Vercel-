
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AppStep, 
  FontState, 
  MethodType, 
  DEFAULT_TRACY_SETTINGS, 
  TracySettings,
  DEFAULT_SOUSA_SETTINGS,
  SousaSettings,
  OriginalCustomSettings,
  DEFAULT_ORIGINAL_CUSTOM_SETTINGS
} from './types';
import { 
  createFontState, 
  cleanMetrics, 
  applyTracyMethod, 
  applySousaMethod, 
  applyOriginalCustomMethod,
  createFontUrl, 
  parseFont,
  prepareFontForExport,
  calculateHarmonicSpacing,
  getCharMetrics,
  MetricsCache
} from './services/fontService';
import { FileUpload } from './components/FileUpload';
import { MetricTuner } from './components/MetricTuner';
import { SousaTuner } from './components/SousaTuner';
import { OriginalTuner } from './components/OriginalTuner';
import { OriginalCustomTuner } from './components/OriginalCustomTuner';
import { TheoreticalTooltip } from './components/TheoreticalTooltip';
import { AnalysisCanvas } from './components/AnalysisCanvas';
import { MethodVisualizer } from './components/MethodVisualizer';
// Added 'Home' to the imports from lucide-react
import { ArrowRight, Activity, Type, MousePointerClick, RefreshCcw, Loader2, PlayCircle, Columns, Home, CheckCircle2, HelpCircle, X, Target, Zap, Layout, Settings2, Layers, AlertCircle } from 'lucide-react';
import { CompareSpacingFlow } from './CompareSpacingFlow';

const App: React.FC = () => {
  // Novo estado de navegação de alto nível para suportar o novo modo sem quebrar o antigo
  const [appMode, setAppMode] = useState<'START' | 'LAB' | 'COMPARE_SPACING'>('START');

  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveUpdateStatus, setLiveUpdateStatus] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState({ progress: 0, status: 'Iniciando...', title: 'Iniciando' });
  const [fontBuffer, setFontBuffer] = useState<ArrayBuffer | null>(null);
  const [fontName, setFontName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Shared worker for background commits (Shadow Metrics)
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize shared worker
    const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = async (e) => {
        if (e.data.action === 'APPLY_METHOD_SUCCESS') {
            const { buffer, familyName, method } = e.data;
            const fontObj = await parseFont(buffer);
            const blob = new Blob([buffer], { type: 'font/opentype' });
            const url = URL.createObjectURL(blob);

            setFonts(prev => {
                const methodKey = method === 'TRACY' ? MethodType.TRACY : 
                                 method === 'SOUSA' ? MethodType.SOUSA : 
                                 MethodType.ORIGINAL_CUSTOM;
                
                // Revoke old URL to prevent browser memory bloat
                if (prev[methodKey]?.url) {
                    URL.revokeObjectURL(prev[methodKey]!.url);
                }

                return {
                    ...prev,
                    [methodKey]: {
                        ...prev[methodKey]!,
                        fontObj,
                        url,
                        fullFontFamily: familyName
                    }
                };
            });
            setLiveUpdateStatus(null);
        } else if (e.data.action === 'ERROR') {
            console.error("Worker error:", e.data.error);
            setLiveUpdateStatus(null);
        }
    };

    return () => {
        worker.terminate();
    };
  }, []);

  // Font States
  const [fonts, setFonts] = useState<Record<string, FontState | null>>({
    [MethodType.ORIGINAL]: null,
    [MethodType.ORIGINAL_CUSTOM]: null,
    [MethodType.TRACY]: null,
    [MethodType.SOUSA]: null,
  });

  const [tracySettings, setTracySettings] = useState<TracySettings>(DEFAULT_TRACY_SETTINGS);
  const [sousaSettings, setSousaSettings] = useState<SousaSettings>(DEFAULT_SOUSA_SETTINGS);
  const [originalCustomSettings, setOriginalCustomSettings] = useState<OriginalCustomSettings>(DEFAULT_ORIGINAL_CUSTOM_SETTINGS);
  const [tuningTab, setTuningTab] = useState<'TRACY' | 'SOUSA' | 'ORIGINAL' | 'ORIGINAL_CUSTOM'>('ORIGINAL');
  const [lastEditedMethod, setLastEditedMethod] = useState<MethodType>(MethodType.TRACY);
  const [sharedSelectedChar, setSharedSelectedChar] = useState<string>('a');
  const [prepMobileView, setPrepMobileView] = useState<'TUNER' | 'TUTORIAL'>('TUNER');
  const [showHelp, setShowHelp] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Responsive state listener
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load CSS for fonts
  useEffect(() => {
    // Inject @font-face rules dynamically
    const styleId = 'saame-font-faces';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    let css = '';
    // Use the dynamic fullFontFamily name for accurate rendering updates
    if (fonts[MethodType.ORIGINAL]) css += `@font-face { font-family: '${fonts[MethodType.ORIGINAL]!.fullFontFamily}'; src: url('${fonts[MethodType.ORIGINAL]!.url}'); }\n`;
    if (fonts[MethodType.ORIGINAL_CUSTOM]) css += `@font-face { font-family: '${fonts[MethodType.ORIGINAL_CUSTOM]!.fullFontFamily}'; src: url('${fonts[MethodType.ORIGINAL_CUSTOM]!.url}'); }\n`;
    if (fonts[MethodType.TRACY]) css += `@font-face { font-family: '${fonts[MethodType.TRACY]!.fullFontFamily}'; src: url('${fonts[MethodType.TRACY]!.url}'); }\n`;
    if (fonts[MethodType.SOUSA]) css += `@font-face { font-family: '${fonts[MethodType.SOUSA]!.fullFontFamily}'; src: url('${fonts[MethodType.SOUSA]!.url}'); }\n`;
    
    styleTag.textContent = css;
  }, [fonts]);

  const handleFileLoaded = async (buffer: ArrayBuffer, name: string) => {
    setIsProcessing(true);
    setProcessingStatus({ progress: 0, status: 'Iniciando importação...', title: 'Importando Fonte' });
    setFontBuffer(buffer);
    setFontName(name);

    if (workerRef.current) {
        workerRef.current.postMessage({
            action: 'INITIAL_PARSE',
            buffer: buffer.slice(0)
        });
    }
    
    try {
        // 1. Store Original immediately (minimal processing)
        const originalState = await createFontState(buffer.slice(0), MethodType.ORIGINAL);
        // Parse separately to get a distinct Font object instance
        const originalCustomState = await createFontState(buffer.slice(0), MethodType.ORIGINAL_CUSTOM);
        
        let initialTracy = tracySettings;
        let initialSousa = sousaSettings;

        // Auto-calculate base harmonic spacing
        if (originalState.fontObj) {
            const fontObj = originalState.fontObj;
            
            const H_lsb = calculateHarmonicSpacing(fontObj, 'H', 'lsb');
            const H_rsb = calculateHarmonicSpacing(fontObj, 'H', 'rsb');
            const O_lsb = calculateHarmonicSpacing(fontObj, 'O', 'lsb');
            const O_rsb = calculateHarmonicSpacing(fontObj, 'O', 'rsb');
            const n_lsb = calculateHarmonicSpacing(fontObj, 'n', 'lsb');
            const n_rsb = calculateHarmonicSpacing(fontObj, 'n', 'rsb');
            const o_lsb = calculateHarmonicSpacing(fontObj, 'o', 'lsb');
            const o_rsb = calculateHarmonicSpacing(fontObj, 'o', 'rsb');
            
            initialTracy = {
                ...tracySettings,
                H: { lsb: H_lsb, rsb: H_rsb },
                O: { lsb: O_lsb, rsb: O_rsb },
                n: { lsb: n_lsb, rsb: n_rsb },
                o: { lsb: o_lsb, rsb: o_rsb },
            };
            
            initialSousa = {
                ...sousaSettings,
                H: { lsb: H_lsb, rsb: H_rsb },
                O: { lsb: O_lsb, rsb: O_rsb },
                n: { lsb: n_lsb, rsb: n_rsb },
                o: { lsb: o_lsb, rsb: o_rsb },
            };
            
            setTracySettings(initialTracy);
            setSousaSettings(initialSousa);
        }

        // 2. Offload complex processing to Worker
        const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({
            action: 'PROCESS_ALL',
            buffer: buffer.slice(0),
            tracySettings: initialTracy,
            sousaSettings: initialSousa,
            context: 'IMPORT'
        });

        worker.onmessage = async (e) => {
            if (e.data.action === 'PROGRESS') {
                setProcessingStatus(prev => ({ ...prev, progress: e.data.progress, status: e.data.status }));
            } else if (e.data.action === 'PROCESS_SUCCESS') {
                const { metrics, tracy, sousa } = e.data;
                
                // Populate MetricsCache with pre-calculated counter metrics from worker
                if (metrics.counterMap) {
                    Object.entries(metrics.counterMap).forEach(([char, val]) => {
                        MetricsCache.set(tracy.family, char, 'counter_metrics', val);
                        MetricsCache.set(sousa.family, char, 'counter_metrics', val);
                        if (originalState?.fullFontFamily) {
                            MetricsCache.set(originalState.fullFontFamily, char, 'counter_metrics', val);
                        }
                    });
                }
                
                // Convert buffers back to URLs
                const tracyBlob = new Blob([tracy.buffer], { type: 'font/opentype' });
                const sousaBlob = new Blob([sousa.buffer], { type: 'font/opentype' });
                
                const tracyFont = await parseFont(tracy.buffer);
                const sousaFont = await parseFont(sousa.buffer);

                const tracyState: FontState = {
                    type: MethodType.TRACY,
                    fontObj: tracyFont,
                    url: URL.createObjectURL(tracyBlob),
                    fullFontFamily: tracy.family,
                    metrics: metrics
                };

                const sousaState: FontState = {
                    type: MethodType.SOUSA,
                    fontObj: sousaFont,
                    url: URL.createObjectURL(sousaBlob),
                    fullFontFamily: sousa.family,
                    metrics: metrics
                };

                setFonts({
                    [MethodType.ORIGINAL]: originalState,
                    [MethodType.ORIGINAL_CUSTOM]: originalCustomState,
                    [MethodType.TRACY]: tracyState,
                    [MethodType.SOUSA]: sousaState
                });

                setTuningTab('ORIGINAL');
                setStep(AppStep.PREPARATION);
                setShowHelp(true);
                setIsProcessing(false);
                worker.terminate();
            }else if (e.data.action === 'ERROR') {
            console.error("Worker error:", e.data.error);
            setErrorMessage('Não foi possível processar esta fonte. Verifique se o arquivo não está corrompido e se contém os glifos H, O, n e o.');
            setIsProcessing(false);
            worker.terminate();
        }
    };

    worker.onerror = (err) => {
        console.error("Worker fatal error:", err);
        setErrorMessage('Ocorreu um erro inesperado ao processar a fonte. Tente novamente ou use outro arquivo.');
        setIsProcessing(false);
        worker.terminate();
    };

    } catch (error) {
        console.error("Processing failed:", error);
        setErrorMessage('Não foi possível importar este arquivo. Confirme se é um .otf ou .ttf válido.');
        setIsProcessing(false);
    }
  };

  const handleProcess = async () => {
    if (!fontBuffer) return;
    setIsProcessing(true);
    setProcessingStatus({ progress: 0, status: 'Iniciando cálculos...', title: 'Processando Espaçamento' });
    
    try {
        const worker = new Worker(new URL('./services/fontWorker.ts', import.meta.url), { type: 'module' });
        
        worker.postMessage({
            action: 'PROCESS_ALL',
            buffer: fontBuffer.slice(0),
            tracySettings,
            sousaSettings,
            context: 'PROCESS'
        });

        worker.onmessage = async (e) => {
            if (e.data.action === 'PROGRESS') {
                setProcessingStatus(prev => ({ ...prev, progress: e.data.progress, status: e.data.status }));
            } else if (e.data.action === 'PROCESS_SUCCESS') {
                const { metrics, tracy, sousa } = e.data;
                
                // Populate MetricsCache with pre-calculated counter metrics from worker
                if (metrics.counterMap) {
                    Object.entries(metrics.counterMap).forEach(([char, val]) => {
                        MetricsCache.set(tracy.family, char, 'counter_metrics', val);
                        MetricsCache.set(sousa.family, char, 'counter_metrics', val);
                        if (fonts[MethodType.ORIGINAL]?.fullFontFamily) {
                            MetricsCache.set(fonts[MethodType.ORIGINAL]!.fullFontFamily, char, 'counter_metrics', val);
                        }
                    });
                }
                
                const tracyBlob = new Blob([tracy.buffer], { type: 'font/opentype' });
                const sousaBlob = new Blob([sousa.buffer], { type: 'font/opentype' });
                
                const tracyFont = await parseFont(tracy.buffer);
                const sousaFont = await parseFont(sousa.buffer);

                const newTracyState: FontState = {
                    type: MethodType.TRACY,
                    fontObj: tracyFont,
                    url: URL.createObjectURL(tracyBlob),
                    fullFontFamily: tracy.family,
                    metrics: metrics
                };

                const newSousaState: FontState = {
                    type: MethodType.SOUSA,
                    fontObj: sousaFont,
                    url: URL.createObjectURL(sousaBlob),
                    fullFontFamily: sousa.family,
                    metrics: metrics
                };

                setFonts(prev => {
                    if (prev[MethodType.TRACY]?.url) URL.revokeObjectURL(prev[MethodType.TRACY]!.url);
                    if (prev[MethodType.SOUSA]?.url) URL.revokeObjectURL(prev[MethodType.SOUSA]!.url);
                    return {
                        ...prev,
                        [MethodType.TRACY]: newTracyState,
                        [MethodType.SOUSA]: newSousaState
                    };
                });

                setStep(AppStep.ANALYSIS);
                setIsProcessing(false);
                worker.terminate();
            }else {
              console.error("Worker error:", e.data?.error);
              setErrorMessage('Não foi possível reprocessar o espaçamento. Tente novamente.');
              setIsProcessing(false);
              worker.terminate();
            }
        };
    } catch (e) {
        console.error(e);
        setErrorMessage('Ocorreu um erro ao reprocessar a fonte.');
        setIsProcessing(false);
    }
  };

  const handleUpdateIndividualGlyph = (method: MethodType, char: string, lsb: number | null, rsb: number | null) => {
    setLastEditedMethod(method);
    if (method === MethodType.TRACY) {
      setTracySettings(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [char]: { 
            lsb: lsb !== null ? lsb : (prev.overrides[char]?.lsb ?? null),
            rsb: rsb !== null ? rsb : (prev.overrides[char]?.rsb ?? null)
          }
        }
      }));
    } else if (method === MethodType.SOUSA) {
      setSousaSettings(prev => ({
        ...prev,
        overrides: {
          ...prev.overrides,
          [char]: { 
            lsb: lsb !== null ? lsb : (prev.overrides[char]?.lsb ?? 0),
            rsb: rsb !== null ? rsb : (prev.overrides[char]?.rsb ?? 0)
          }
        }
      }));
    } else if (method === MethodType.ORIGINAL_CUSTOM) {
      setOriginalCustomSettings(prev => {
        const currentOverride = prev.overrides[char];
        let startL = 0;
        let startR = 0;
        if (!currentOverride && fonts[MethodType.ORIGINAL]?.fontObj) {
            const m = getCharMetrics(fonts[MethodType.ORIGINAL]?.fontObj, char);
            startL = m.lsb;
            startR = m.rsb;
        } else if (currentOverride) {
            startL = currentOverride.lsb;
            startR = currentOverride.rsb;
        }
        return {
            ...prev,
            overrides: {
                ...prev.overrides,
                [char]: { 
                    lsb: lsb !== null ? lsb : startL, 
                    rsb: rsb !== null ? rsb : startR
                }
            }
        };
      });
    }
  };

  // Debounced Tuner Update for Tracy (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Tracy)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'TRACY',
                    settings: tracySettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 350); 
        return () => { clearTimeout(timer); };
    }
  }, [tracySettings, step, fontBuffer]);

  // Debounced Tuner Update for Sousa (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Sousa)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'SOUSA',
                    settings: sousaSettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 350); 
        return () => { clearTimeout(timer); };
    }
  }, [sousaSettings, step, fontBuffer]);

  // Debounced Tuner Update for Original Custom (Worker-assisted Shadow Metrics)
  useEffect(() => {
    if (fontBuffer && (step === AppStep.PREPARATION || step === AppStep.ANALYSIS)) {
        const updateTuner = () => {
            if (workerRef.current) {
                setLiveUpdateStatus('Atualizando (Custom)...');
                workerRef.current.postMessage({
                    action: 'APPLY_METHOD',
                    method: 'ORIGINAL_CUSTOM',
                    settings: originalCustomSettings
                });
            }
        };
        const timer = setTimeout(updateTuner, 350); 
        return () => { clearTimeout(timer); };
    }
  }, [originalCustomSettings, step, fontBuffer]);

  // Renderização condicional da Tela Inicial
  if (appMode === 'START') {
    return (
      <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col justify-start items-center p-4 sm:p-6 md:p-8 pb-24 dark:bg-zinc-950 bg-white dark:text-zinc-200 text-zinc-900 relative custom-scrollbar font-sans">
        {/* Background Decor */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
        
        {/* Top Header Bar */}
        <header className="w-full max-w-5xl flex items-center justify-between py-4 px-4 sm:px-6 mb-6 border-b dark:border-zinc-800 border-zinc-200 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-lg shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight dark:text-white text-zinc-950">SAAME LAB</span>
              <span className="text-[10px] uppercase tracking-widest font-mono text-zinc-400 dark:text-zinc-500 hidden sm:inline">v2.0</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <span className="hidden md:inline">Ambiente de Métricas Tipográficas</span>
          </div>
        </header>

        {/* Hero Section */}
        <div className="text-center mb-10 relative max-w-2xl mx-auto">
          <motion.div 
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="dark:bg-white bg-black dark:text-black text-white p-4 rounded-xl inline-block mb-6 shadow-xl"
          >
            <Activity className="w-10 h-10" />
          </motion.div>
          
          <motion.h1 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black dark:text-white text-zinc-950 mb-3 tracking-tight"
          >
            SAAME LAB
          </motion.h1>
          <motion.p 
            initial={{ y: 15, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="dark:text-zinc-400 text-zinc-600 max-w-lg mx-auto text-lg sm:text-xl font-medium leading-relaxed"
          >
            Sistema de Aplicação e Análise de Métodos de Espaçamento
          </motion.p>
        </div>
        
        {/* Mode Selector Cards */}
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.12,
                delayChildren: 0.3
              }
            }
          }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative z-10"
        >
          <motion.button 
            variants={{
              hidden: { y: 20, opacity: 0 },
              show: { y: 0, opacity: 1 }
            }}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setAppMode('LAB')}
            className="flex flex-col items-center p-8 dark:bg-zinc-900/60 bg-zinc-50/80 backdrop-blur-md border dark:border-zinc-800 border-zinc-300 rounded-xl hover:border-black dark:hover:border-white transition-all group shadow-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            aria-label="Abrir Laboratório de Espaçamento"
          >
            <div className="w-14 h-14 rounded-lg dark:bg-zinc-800 bg-zinc-200 border dark:border-zinc-700 border-zinc-300 flex items-center justify-center mb-5 dark:text-white text-black group-hover:dark:bg-white group-hover:bg-black group-hover:dark:text-black group-hover:text-white transition-all shadow-sm">
              <PlayCircle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black dark:text-white text-zinc-950 mb-2 tracking-tight">Laboratório de Espaçamento</h3>
            <p className="dark:text-zinc-400 text-zinc-600 text-sm text-center font-medium leading-relaxed">Ajuste e processe fontes individuais usando métodos históricos e matemáticos.</p>
          </motion.button>
 
          <motion.button 
            variants={{
              hidden: { y: 20, opacity: 0 },
              show: { y: 0, opacity: 1 }
            }}
            whileHover={{ y: -4, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setAppMode('COMPARE_SPACING')}
            className="flex flex-col items-center p-8 dark:bg-zinc-900/60 bg-zinc-50/80 backdrop-blur-md border dark:border-zinc-800 border-zinc-300 rounded-xl hover:border-black dark:hover:border-white transition-all group shadow-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            aria-label="Abrir Fluxo de Comparação"
          >
             <div className="w-14 h-14 rounded-lg dark:bg-zinc-800 bg-zinc-200 border dark:border-zinc-700 border-zinc-300 flex items-center justify-center mb-5 dark:text-white text-black group-hover:dark:bg-white group-hover:bg-black group-hover:dark:text-black group-hover:text-white transition-all shadow-sm">
              <Columns className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black dark:text-white text-zinc-950 mb-2 tracking-tight">Fluxo de Comparação</h3>
            <p className="dark:text-zinc-400 text-zinc-600 text-sm text-center font-medium leading-relaxed">Analise métricas entre duas fontes tipográficas de forma independente.</p>
          </motion.button>
        </motion.div>
        
        {/* Educational Workflow Steps */}
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.5
              }
            }
          }}
          className="mt-12 w-full max-w-4xl dark:bg-zinc-900/40 bg-zinc-100/60 backdrop-blur-sm border dark:border-zinc-800 border-zinc-200 rounded-xl p-6 md:p-8"
        >
          <h4 className="text-xs uppercase tracking-[0.25em] dark:text-zinc-300 text-zinc-700 font-mono font-black mb-6 text-center">Como Funciona o SAAME</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-full dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center mb-2.5 dark:text-white text-black border dark:border-zinc-700 border-zinc-300 font-bold text-xs ring-2 ring-zinc-500/20">1</div>
              <h5 className="dark:text-white text-zinc-900 font-bold text-sm mb-1">Upload da Fonte</h5>
              <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">Carregue arquivos .otf ou .ttf para iniciar o processamento.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-full dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center mb-2.5 dark:text-white text-black border dark:border-zinc-700 border-zinc-300 font-bold text-xs ring-2 ring-zinc-500/20">2</div>
              <h5 className="dark:text-white text-zinc-900 font-bold text-sm mb-1">Ajuste de Métricas</h5>
              <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">Utilize Tracy ou Sousa para definir side-bearings rítmicos.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-full dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center mb-2.5 dark:text-white text-black border dark:border-zinc-700 border-zinc-300 font-bold text-xs ring-2 ring-zinc-500/20">3</div>
              <h5 className="dark:text-white text-zinc-900 font-bold text-sm mb-1">Análise Visual</h5>
              <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">Compare as fontes em tempo real com diagramas de espaçamento.</p>
            </motion.div>
            <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-full dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center mb-2.5 dark:text-white text-black border dark:border-zinc-700 border-zinc-300 font-bold text-xs ring-2 ring-zinc-500/20">4</div>
              <h5 className="dark:text-white text-zinc-900 font-bold text-sm mb-1">Validação Final</h5>
              <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">Verifique o ritmo em blocos de texto e refine glifos individuais.</p>
            </motion.div>
          </div>
        </motion.div>

        {/* Glossário de Recursos */}
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full max-w-4xl dark:bg-zinc-900/30 bg-zinc-100/40 p-3.5 rounded-lg border dark:border-zinc-800 border-zinc-200"
        >
            <div className="flex items-center gap-2 px-2.5">
                <PlayCircle className="w-3.5 h-3.5 dark:text-white text-black" />
                <span className="text-[11px] uppercase tracking-wider dark:text-zinc-300 text-zinc-700 font-bold">Laboratório</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 border-l dark:border-zinc-800 border-zinc-200">
                <Columns className="w-3.5 h-3.5 dark:text-white text-black" />
                <span className="text-[11px] uppercase tracking-wider dark:text-zinc-300 text-zinc-700 font-bold">Comparação</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 border-l dark:border-zinc-800 border-zinc-200">
                <Activity className="w-3.5 h-3.5 dark:text-white text-black" />
                <span className="text-[11px] uppercase tracking-wider dark:text-zinc-300 text-zinc-700 font-bold">Métricas</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 border-l dark:border-zinc-800 border-zinc-200">
                <MousePointerClick className="w-3.5 h-3.5 dark:text-white text-black" />
                <span className="text-[11px] uppercase tracking-wider dark:text-zinc-300 text-zinc-700 font-bold">Análise</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 border-l dark:border-zinc-800 border-zinc-200">
                <HelpCircle className="w-3.5 h-3.5 dark:text-zinc-400 text-zinc-500" />
                <span className="text-[11px] uppercase tracking-wider dark:text-zinc-300 text-zinc-700 font-bold">Ajuda</span>
            </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-16 flex flex-col items-center gap-6 pb-12 px-4 text-center max-w-3xl"
        >
            <div className="h-px w-20 dark:bg-zinc-800 bg-zinc-300" />
            <div className="flex flex-col gap-4 p-6 rounded-2xl dark:bg-zinc-900/40 bg-zinc-100/50 border dark:border-zinc-800 border-zinc-200 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.3em] dark:text-zinc-400 text-zinc-600 font-black">Informações Legais & Uso</p>
              <p className="text-[13px] dark:text-zinc-400 text-zinc-600 leading-relaxed">
                <span className="font-black dark:text-zinc-300 text-zinc-800">AVISO LEGAL:</span> O usuário é integralmente responsável por garantir que possui os direitos autorais e licenças necessários para o processamento e a exportação de qualquer fonte importada neste sistema, incluindo os arquivos resultantes. O SAAME Lab é uma ferramenta acadêmica de código aberto, sem fins lucrativos, e não armazena nem distribui os arquivos carregados ou gerados.
              </p>
              <div className="flex justify-center items-center gap-4 text-[10px] uppercase tracking-widest font-bold dark:text-zinc-600 text-zinc-400">
                <span>SAAME LAB v2.0</span>
                <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                <span>Uso Acadêmico</span>
              </div>
            </div>
        </motion.div>
      </div>
    );
  }

  // NOVO: Renderização do novo fluxo COMPARE_SPACING
  if (appMode === 'COMPARE_SPACING') {
    return <CompareSpacingFlow onBack={() => setAppMode('START')} />;
  }

  // O RESTO DO COMPONENTE PERMANECE ABSOLUTAMENTE IGUAL (Fluxo LAB original)
  return (
    <div className="flex flex-col min-h-screen w-full dark:bg-slate-950 bg-slate-50 dark:text-slate-200 text-slate-800 font-sans relative">
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] max-w-lg w-[92%] bg-red-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-medium">{errorMessage}</div>
          <button onClick={() => setErrorMessage(null)} className="text-white/80 hover:text-white font-bold px-1" aria-label="Fechar aviso">✕</button>
        </div>
      )}
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none" />
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {isProcessing && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] dark:bg-zinc-950/90 bg-white/90 backdrop-blur-md flex items-center justify-center flex-col"
            >
                <div className="relative">
                    <Loader2 className="w-12 h-12 dark:text-white text-black animate-spin" />
                </div>
                <h3 className="dark:text-white text-zinc-950 text-xl font-bold mt-6 tracking-wide">{processingStatus.title}</h3>
                <p className="dark:text-zinc-400 text-zinc-600 font-mono font-bold mt-2 tracking-widest uppercase text-xs">{processingStatus.status}</p>
                <div className="w-64 h-2 dark:bg-zinc-800 bg-zinc-200 rounded-full mt-4 overflow-hidden shadow-inner flex relative">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${processingStatus.progress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="h-full dark:bg-white bg-black relative flex items-center justify-end"
                    />
                </div>
                <p className="dark:text-zinc-400 text-zinc-600 mt-2 text-sm font-mono">{processingStatus.progress}%</p>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between px-3 sm:px-6 py-3 sm:py-4 dark:bg-zinc-900/80 bg-zinc-100/90 backdrop-blur-md border-b dark:border-zinc-800 border-zinc-200 gap-3 sm:gap-4 sticky top-0 z-50">
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setAppMode('START')} 
              className="p-2 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-xl dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Voltar ao Início"
              aria-label="Ir para a Página Inicial"
            >
              <Home className="w-5 h-5" />
            </button>
            
            <div className="h-7 w-px dark:bg-zinc-800 bg-zinc-300 hidden sm:block" />

            <div className="flex items-center gap-2.5 group">
              <div className="p-2 sm:p-2.5 rounded-xl shadow-md dark:bg-white bg-black dark:text-black text-white transition-all shrink-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight dark:text-white text-zinc-950 flex items-center leading-tight">
                  <span className="text-black dark:text-white">
                    SAAME
                  </span>
                  <span className="font-light ml-1.5 text-zinc-400 dark:text-zinc-500">Lab</span>
                </h1>
                <p className="hidden lg:block text-[11px] dark:text-zinc-400 text-zinc-600 uppercase tracking-[0.2em] font-medium truncate">Ambiente de Experimentação Tipográfica</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-lg dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
              title="Guia de Ajuda"
              aria-label="Abrir Guia de Ajuda"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Progress Stepper Monocromático com Navegação Interativa e Responsiva */}
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 text-xs sm:text-sm font-bold uppercase tracking-wider sm:tracking-[0.15em] w-full md:w-auto justify-center md:justify-end overflow-x-auto py-1 px-1 custom-scrollbar">
            <button 
                onClick={() => setStep(AppStep.UPLOAD)}
                className={`flex items-center gap-1.5 sm:gap-2.5 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white rounded-lg p-1.5 sm:p-2 cursor-pointer shrink-0 ${step === AppStep.UPLOAD ? 'dark:text-white text-black' : fonts[MethodType.ORIGINAL] ? 'dark:text-zinc-300 text-zinc-700 hover:opacity-80' : 'text-zinc-400 dark:text-zinc-600'}`}
                title="Ir para Upload da Fonte"
            >
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs transition-all ${
                  step === AppStep.UPLOAD ? 'border-black dark:border-white dark:bg-white bg-black dark:text-black text-white shadow-sm font-black' : 
                  fonts[MethodType.ORIGINAL] ? 'border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 bg-zinc-200 dark:text-white text-black font-bold' : 'dark:border-zinc-800 border-zinc-300'
                }`}>
                  {fonts[MethodType.ORIGINAL] && step !== AppStep.UPLOAD ? <CheckCircle2 className="w-3.5 h-3.5" /> : '01'}
                </span>
                <div className="flex flex-col text-left">
                    <span className="leading-none text-[11px] sm:text-xs">Fonte</span>
                    <span className="hidden sm:inline text-[8px] dark:text-zinc-500 text-zinc-500 tracking-normal font-normal mt-0.5 italic opacity-70">Upload</span>
                </div>
            </button>
            
            <div className={`w-3 sm:w-5 md:w-6 h-0.5 rounded-full shrink-0 ${step !== AppStep.UPLOAD ? 'dark:bg-white bg-black' : 'dark:bg-zinc-800 bg-zinc-300'}`} />
            
            <button 
                onClick={() => fonts[MethodType.ORIGINAL] && setStep(AppStep.PREPARATION)}
                disabled={!fonts[MethodType.ORIGINAL]}
                className={`flex items-center gap-1.5 sm:gap-2.5 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white rounded-lg p-1.5 sm:p-2 shrink-0 ${!fonts[MethodType.ORIGINAL] ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${step === AppStep.PREPARATION ? 'dark:text-white text-black' : step === AppStep.ANALYSIS ? 'dark:text-zinc-300 text-zinc-700 hover:opacity-80' : 'text-zinc-400 dark:text-zinc-600'}`}
                title="Ir para Ajustes de Métricas"
            >
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs transition-all ${
                  step === AppStep.PREPARATION ? 'border-black dark:border-white dark:bg-white bg-black dark:text-black text-white shadow-sm font-black' : 
                  step === AppStep.ANALYSIS ? 'border-zinc-400 dark:border-zinc-600 dark:bg-zinc-800 bg-zinc-200 dark:text-white text-black font-bold' : 'dark:border-zinc-800 border-zinc-300'
                }`}>
                  {step === AppStep.ANALYSIS ? <CheckCircle2 className="w-3.5 h-3.5" /> : '02'}
                </span>
                <div className="flex flex-col text-left">
                    <span className="leading-none text-[11px] sm:text-xs">Métricas</span>
                    <span className="hidden sm:inline text-[8px] dark:text-zinc-500 text-zinc-500 tracking-normal font-normal mt-0.5 italic opacity-70">Ajuste</span>
                </div>
            </button>
            
            <div className={`w-3 sm:w-5 md:w-6 h-0.5 rounded-full shrink-0 ${step === AppStep.ANALYSIS ? 'dark:bg-white bg-black' : 'dark:bg-zinc-800 bg-zinc-300'}`} />
            
            <button 
                onClick={() => fonts[MethodType.ORIGINAL] && setStep(AppStep.ANALYSIS)}
                disabled={!fonts[MethodType.ORIGINAL]}
                className={`flex items-center gap-1.5 sm:gap-2.5 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white rounded-lg p-1.5 sm:p-2 shrink-0 ${!fonts[MethodType.ORIGINAL] ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${step === AppStep.ANALYSIS ? 'dark:text-white text-black' : 'text-zinc-400 dark:text-zinc-600 hover:opacity-80'}`}
                title="Ir para Análise Comparativa"
            >
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs transition-all ${step === AppStep.ANALYSIS ? 'border-black dark:border-white dark:bg-white bg-black dark:text-black text-white shadow-sm font-black' : 'dark:border-zinc-800 border-zinc-300'}`}>03</span>
                <div className="flex flex-col text-left">
                    <span className="leading-none text-[11px] sm:text-xs">Análise</span>
                    <span className="hidden sm:inline text-[8px] dark:text-zinc-500 text-zinc-500 tracking-normal font-normal mt-0.5 italic opacity-70">Resultados</span>
                </div>
            </button>

            <div className="h-6 w-px dark:bg-zinc-800 bg-zinc-300 mx-1 hidden md:block" />

            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-lg dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black transition-all group focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white hidden md:flex items-center justify-center min-h-[40px] min-w-[40px]"
              title="Guia de Ajuda"
              aria-label="Abrir Guia de Ajuda"
            >
              <HelpCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full flex flex-col p-2 sm:p-4 md:p-6 min-w-0 pb-16">
        
        {/* Help Modal (H10) */}
        <AnimatePresence>
          {showHelp && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] dark:bg-slate-950/90 bg-slate-50/90 backdrop-blur-xl flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="dark:bg-slate-900 bg-slate-100 border dark:border-slate-800 border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl"
              >
                <div className="flex items-center justify-between p-5 border-b dark:border-zinc-800 border-zinc-200 dark:bg-zinc-900/50 bg-zinc-100/50">
                  <div className="flex items-center gap-3 dark:text-white text-black">
                    <Zap className="w-5 h-5" />
                    <h2 className="text-lg font-black uppercase tracking-tight dark:text-white text-zinc-950">Guia de Navegação SAAME</h2>
                  </div>
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="p-1.5 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                    aria-label="Fechar Guia de Ajuda"
                  >
                    <X className="w-5 h-5 dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black" />
                  </button>
                </div>
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {/* Grid of Areas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <section className="dark:bg-zinc-950/40 bg-zinc-50/60 p-5 rounded-xl border dark:border-zinc-800 border-zinc-200 flex flex-col gap-3 hover:border-black dark:hover:border-white transition-colors">
                      <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-lg dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center dark:text-white text-black border dark:border-zinc-700 border-zinc-300">
                           <Activity className="w-4 h-4" />
                         </div>
                         <h3 className="dark:text-white text-zinc-950 font-black text-xs uppercase tracking-wider">Ajustador de Métricas</h3>
                      </div>
                      
                      {/* Animated Metaphor for Sliders */}
                      <div className="h-16 dark:bg-zinc-900/50 bg-zinc-100/80 rounded-lg border dark:border-zinc-800 border-zinc-200 flex flex-col justify-center gap-2.5 px-5 overflow-hidden">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="h-1 flex-1 dark:bg-zinc-800 bg-zinc-300 rounded-full relative">
                              <motion.div 
                                animate={{ left: i % 2 === 0 ? ['10%', '60%', '10%'] : ['70%', '20%', '70%'] }}
                                transition={{ duration: 3 + i, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute -top-1 w-3 h-3 dark:bg-white bg-black rounded-full shadow-sm" 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">
                        Controle o espaçamento usando métodos como <span className="font-bold dark:text-white text-black">Tracy</span> e <span className="font-bold dark:text-white text-black">Sousa</span>. Altere valores globais ou por grupos de glifos no painel lateral.
                      </p>
                    </section>

                    <section className="dark:bg-zinc-950/40 bg-zinc-50/60 p-5 rounded-xl border dark:border-zinc-800 border-zinc-200 flex flex-col gap-3 hover:border-black dark:hover:border-white transition-colors">
                      <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-lg dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center dark:text-white text-black border dark:border-zinc-700 border-zinc-300">
                           <Zap className="w-4 h-4" />
                         </div>
                         <h3 className="dark:text-white text-zinc-950 font-black text-xs uppercase tracking-wider">Processamento</h3>
                      </div>

                      {/* Animated Metaphor for Processing/Validation */}
                      <div className="h-16 dark:bg-zinc-900/50 bg-zinc-100/80 rounded-lg border dark:border-zinc-800 border-zinc-200 flex items-center justify-center gap-3 overflow-hidden">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="w-6 h-6 rounded-full border border-dashed dark:border-zinc-500 border-zinc-400 flex items-center justify-center"
                        >
                          <RefreshCcw className="w-3 h-3 dark:text-zinc-400 text-zinc-600" />
                        </motion.div>
                        <div className="flex flex-col gap-1">
                          <motion.div 
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="h-1 w-14 dark:bg-zinc-700 bg-zinc-300 rounded-full" 
                          />
                          <motion.div 
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="h-1 w-10 dark:bg-zinc-700 bg-zinc-300 rounded-full" 
                          />
                        </div>
                        <motion.div
                          animate={{ scale: [0.8, 1, 0.8], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <CheckCircle2 className="w-4 h-4 dark:text-white text-black" />
                        </motion.div>
                      </div>

                      <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">
                        O sistema analisa a fonte automaticamente para identificar contraformas e sugerir métricas baseadas no design original.
                      </p>
                    </section>

                    <section className="dark:bg-zinc-950/40 bg-zinc-50/60 p-5 rounded-xl border dark:border-zinc-800 border-zinc-200 flex flex-col gap-3 hover:border-black dark:hover:border-white transition-colors">
                      <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-lg dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center dark:text-white text-black border dark:border-zinc-700 border-zinc-300">
                           <Target className="w-4 h-4" />
                         </div>
                         <h3 className="dark:text-white text-zinc-950 font-black text-xs uppercase tracking-wider">Tutoriais Visuais</h3>
                      </div>

                      {/* Visual Metaphor for Tutorial */}
                      <div className="h-16 dark:bg-zinc-900/50 bg-zinc-100/80 rounded-lg border dark:border-zinc-800 border-zinc-200 flex items-center justify-center gap-2 overflow-hidden">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="w-10 h-12 dark:bg-zinc-800/50 bg-zinc-200/50 rounded-md border dark:border-zinc-700/50 border-zinc-300/50 flex flex-col gap-1 p-1.5">
                             <div className="h-1 w-full dark:bg-zinc-700 bg-zinc-300 rounded-full" />
                             <div className="h-1 w-2/3 dark:bg-zinc-700 bg-zinc-300 rounded-full" />
                             <div className="mt-auto h-3 w-full dark:bg-zinc-950/40 bg-zinc-50/40 rounded flex items-center justify-center">
                                <Activity className="w-2 h-2 dark:text-zinc-500 text-zinc-400" />
                             </div>
                          </div>
                        ))}
                      </div>

                      <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">
                        Entenda o embasamento teórico de cada método. Acompanhe diagramas interativos que explicam conceitos de ritmo e espaçamento sistemático.
                      </p>
                    </section>

                    <section className="dark:bg-zinc-950/40 bg-zinc-50/60 p-5 rounded-xl border dark:border-zinc-800 border-zinc-200 flex flex-col gap-3 hover:border-black dark:hover:border-white transition-colors">
                      <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-lg dark:bg-zinc-800 bg-zinc-200 flex items-center justify-center dark:text-white text-black border dark:border-zinc-700 border-zinc-300">
                           <Type className="w-4 h-4" />
                         </div>
                         <h3 className="dark:text-white text-zinc-950 font-black text-xs uppercase tracking-wider">Visualização</h3>
                      </div>

                      {/* Visual Metaphor for Preview */}
                      <div className="h-16 dark:bg-zinc-900/50 bg-zinc-100/80 rounded-lg border dark:border-zinc-800 border-zinc-200 flex items-center justify-center overflow-hidden">
                        <div className="text-2xl font-serif dark:text-white text-zinc-900 opacity-60 flex items-baseline gap-1">
                          <span>A</span>
                          <motion.span 
                            animate={{ x: [-2, 4, -2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="dark:text-zinc-400 text-zinc-600 underline decoration-1"
                          >V</motion.span>
                          <span>W</span>
                        </div>
                      </div>

                      <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">
                        Teste sua fonte com textos reais em tempo real. Alterne entre fundo claro/escuro e veja o comportamento do "cinza tipográfico".
                      </p>
                    </section>
                  </div>

                  <section className="dark:bg-zinc-900/40 bg-zinc-100/70 p-4 rounded-lg border dark:border-zinc-800 border-zinc-200">
                    <h4 className="dark:text-zinc-200 text-zinc-800 font-bold text-xs mb-1.5 font-mono uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5" /> Fluxo Sugerido
                    </h4>
                    <p className="dark:text-zinc-400 text-zinc-600 text-xs leading-relaxed">
                      Comece ajustando os <span className="dark:text-white text-black font-bold">Caracteres Mestre</span> no método Tracy, valide o resultado nos <span className="dark:text-white text-black font-bold">Grupos de Afinidade</span> do método Sousa e finalize com o teste de leitura na área de <span className="dark:text-white text-black font-bold">Pré-visualização</span>.
                    </p>
                  </section>
                </div>
                <div className="p-4 border-t dark:border-zinc-800 border-zinc-200 dark:bg-zinc-900/50 bg-zinc-100/50 flex justify-end">
                  <button 
                    onClick={() => setShowHelp(false)} 
                    className="px-5 py-2 bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-lg font-bold transition-all text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  >
                    Entendido
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {step === AppStep.UPLOAD && (
            <div className="max-w-2xl mx-auto pt-8 md:pt-12 px-4 pb-20">
                <FileUpload onFileLoaded={handleFileLoaded} />
                <div className="mt-8 text-center dark:text-gray-500 text-gray-500 text-sm max-w-lg mx-auto leading-relaxed">
                    Carregue um arquivo .otf ou .ttf. O sistema gerará automaticamente uma cópia limpa (métricas zeradas) e uma cópia de referência Original para comparação rítmica.
                </div>
            </div>
        )}

        {step === AppStep.PREPARATION && (
            <div className="flex flex-col flex-1 w-full min-w-0">
                {/* Preparation Header matching Analysis Header button position */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 shrink-0">
                    <h2 className="text-xl md:text-2xl font-black dark:text-white text-zinc-950 flex items-center gap-2 uppercase tracking-tighter">
                        <Settings2 className="w-6 h-6 dark:text-white text-black" />
                        Ajuste e Métricas
                    </h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button 
                            onClick={() => setStep(AppStep.UPLOAD)}
                            className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border dark:border-zinc-800 border-zinc-300 dark:hover:bg-zinc-800/50 hover:bg-zinc-200/50 transition-all dark:text-zinc-400 text-zinc-600 font-bold text-xs uppercase tracking-wider dark:hover:text-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white cursor-pointer"
                            title="Trocar Arquivo Fonte"
                        >
                            Trocar Fonte
                        </button>
                        <button 
                            onClick={handleProcess}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold shadow-lg w-full sm:w-auto transform active:scale-[0.99] transition-all uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs cursor-pointer"
                        >
                            Processar e Validar Fontes
                            <ArrowRight className="w-4 h-4 dark:text-black text-white" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full lg:overflow-hidden relative px-1 pb-10 lg:pb-0">
                {/* Mobile View Switcher */}
                <div className="lg:hidden flex sticky top-0 z-[60] dark:bg-zinc-950/90 bg-white/90 backdrop-blur-md border-b dark:border-zinc-800 border-zinc-200 p-2 mb-2 -mx-1 gap-2">
                    <button 
                        onClick={() => setPrepMobileView('TUNER')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white ${prepMobileView === 'TUNER' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black'}`}
                        aria-pressed={prepMobileView === 'TUNER'}
                    >
                        <RefreshCcw className="w-4 h-4" /> Ajustes
                    </button>
                    <button 
                        onClick={() => setPrepMobileView('TUTORIAL')}
                        className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white ${prepMobileView === 'TUTORIAL' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black'}`}
                        aria-pressed={prepMobileView === 'TUTORIAL'}
                    >
                        <Target className="w-4 h-4" /> Tutorial
                    </button>
                </div>

                {/* Tuning Panel */}
                {(prepMobileView === 'TUNER' || isDesktop) && (
                    <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-8 flex-1 min-h-0 lg:h-full flex flex-col order-1 overflow-y-auto lg:overflow-hidden custom-scrollbar min-w-0"
                    >
                        <div className="flex gap-2 mb-4 dark:bg-zinc-900/90 bg-zinc-100/90 backdrop-blur p-1.5 rounded-lg border dark:border-zinc-800 border-zinc-300 w-[calc(100vw-1rem)] sm:w-full lg:w-fit self-center lg:self-start z-20 shadow-sm overflow-x-auto custom-scrollbar max-w-full">
                            <button 
                            onClick={() => setTuningTab('ORIGINAL')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white relative flex items-center gap-2 whitespace-nowrap ${tuningTab === 'ORIGINAL' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black hover:bg-black/5 dark:hover:bg-white/5'}`}
                            style={{ minWidth: 'max-content' }}
                            role="tab"
                            aria-selected={tuningTab === 'ORIGINAL'}
                        >
                            {tuningTab === 'ORIGINAL' && <div className="w-1.5 h-1.5 rounded-full dark:bg-black bg-white animate-pulse" />}
                            Fonte Original
                        </button>
                        <button 
                            onClick={() => setTuningTab('ORIGINAL_CUSTOM')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white relative flex items-center gap-2 whitespace-nowrap ${tuningTab === 'ORIGINAL_CUSTOM' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black hover:bg-black/5 dark:hover:bg-white/5'}`}
                            style={{ minWidth: 'max-content' }}
                            role="tab"
                            aria-selected={tuningTab === 'ORIGINAL_CUSTOM'}
                        >
                            {tuningTab === 'ORIGINAL_CUSTOM' && <div className="w-1.5 h-1.5 rounded-full dark:bg-black bg-white animate-pulse" />}
                            Ajuste Manual
                        </button>
                        <button 
                            onClick={() => setTuningTab('TRACY')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white relative flex items-center gap-2 whitespace-nowrap ${tuningTab === 'TRACY' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black hover:bg-black/5 dark:hover:bg-white/5'}`}
                            style={{ minWidth: 'max-content' }}
                            role="tab"
                            aria-selected={tuningTab === 'TRACY'}
                        >
                            {tuningTab === 'TRACY' && <div className="w-1.5 h-1.5 rounded-full dark:bg-black bg-white animate-pulse" />}
                            Método Tracy
                        </button>
                        <button 
                            onClick={() => setTuningTab('SOUSA')}
                            className={`flex-1 sm:flex-none px-4 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white relative flex items-center gap-2 whitespace-nowrap ${tuningTab === 'SOUSA' ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm' : 'dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black hover:bg-black/5 dark:hover:bg-white/5'}`}
                            style={{ minWidth: 'max-content' }}
                            role="tab"
                            aria-selected={tuningTab === 'SOUSA'}
                        >
                            {tuningTab === 'SOUSA' && <div className="w-1.5 h-1.5 rounded-full dark:bg-black bg-white animate-pulse" />}
                            Método Sousa
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 dark:bg-zinc-900/40 bg-zinc-100/50 rounded-xl border dark:border-zinc-800 border-zinc-300 shadow-inner overflow-hidden flex flex-col relative">
                        {liveUpdateStatus && (
                            <div className="absolute top-4 right-4 z-50 bg-black dark:bg-white text-white dark:text-black text-xs uppercase font-bold tracking-widest px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                                {liveUpdateStatus}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {tuningTab === 'TRACY' ? (
                                <MetricTuner 
                                    settings={tracySettings} 
                                    onSettingsChange={setTracySettings}
                                    fontFamily={fonts[MethodType.TRACY]?.fullFontFamily || 'sans-serif'}
                                    font={fonts[MethodType.TRACY]}
                                    selectedChar={sharedSelectedChar}
                                    onCharSelect={setSharedSelectedChar}
                                />
                            ) : tuningTab === 'SOUSA' ? (
                                <SousaTuner 
                                    settings={sousaSettings} 
                                    onSettingsChange={setSousaSettings}
                                    fontFamily={fonts[MethodType.SOUSA]?.fullFontFamily || 'sans-serif'}
                                    font={fonts[MethodType.SOUSA]}
                                    selectedChar={sharedSelectedChar}
                                    onCharSelect={setSharedSelectedChar}
                                />
                            ) : tuningTab === 'ORIGINAL' ? (
                                <OriginalTuner 
                                    font={fonts[MethodType.ORIGINAL]}
                                    selectedChar={sharedSelectedChar}
                                    onCharSelect={setSharedSelectedChar}
                                />
                            ) : (
                                <OriginalCustomTuner 
                                    font={fonts[MethodType.ORIGINAL_CUSTOM]}
                                    originalFont={fonts[MethodType.ORIGINAL]}
                                    tracyFont={fonts[MethodType.TRACY]}
                                    sousaFont={fonts[MethodType.SOUSA]}
                                    settings={originalCustomSettings}
                                    onSettingsChange={setOriginalCustomSettings}
                                    selectedChar={sharedSelectedChar}
                                    onCharSelect={setSharedSelectedChar}
                                />
                            )}
                        </div>
                        
                        {/* Mobile Action buttons in Tuner Panel */}
                        <div className="lg:hidden p-4 dark:bg-zinc-900/90 bg-zinc-100/90 backdrop-blur-md border-t dark:border-zinc-800 border-zinc-200">
                             <div className="flex flex-col gap-2.5 w-full">
                                <button 
                                    onClick={handleProcess}
                                    className="px-6 py-3.5 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold shadow-lg flex items-center justify-center gap-2.5 w-full transform active:scale-[0.99] transition-all text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    Processar e Visualizar Resultados <ArrowRight className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setStep(AppStep.UPLOAD)}
                                    className="px-6 py-2.5 rounded-lg border dark:border-zinc-800 border-zinc-300 dark:hover:bg-zinc-800/50 hover:bg-zinc-200/50 transition-all dark:text-zinc-400 text-zinc-600 font-bold text-xs uppercase tracking-wider dark:hover:text-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    Trocar Arquivo
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
                )}

                {/* Info Panel */}
                {(prepMobileView === 'TUTORIAL' || isDesktop) && (
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="lg:col-span-4 flex-1 min-h-0 lg:h-full order-2 lg:overflow-hidden flex flex-col min-w-0"
                    >
                        <div className="dark:bg-zinc-900/60 bg-zinc-100/60 backdrop-blur-sm flex-1 rounded-xl border dark:border-zinc-800 border-zinc-300 flex flex-col overflow-hidden shadow-lg relative group min-h-0">
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pt-5 px-5 md:px-6">
                            <div className="flex flex-col items-center">
                                {/* Refined compact font info */}
                                <div className="hidden lg:flex items-center gap-3 dark:bg-zinc-950/40 bg-zinc-50/60 p-3 rounded-lg mb-4 border dark:border-zinc-800 border-zinc-200 w-full">
                                    <div className="dark:bg-zinc-950 bg-zinc-50 p-2 rounded-md shadow-inner border dark:border-zinc-800 border-zinc-300">
                                        <Type className="w-4 h-4 dark:text-white text-black" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full dark:bg-white bg-black shadow-sm" />
                                            <h4 className="text-[10px] font-black dark:text-zinc-400 text-zinc-600 uppercase tracking-[0.2em]">{fontName}</h4>
                                        </div>
                                        <h3 className="text-xs font-bold dark:text-white text-zinc-900 truncate tracking-tight">Análise Ativa</h3>
                                    </div>
                                </div>
                                
                                <div className="w-full flex-1">
                                    <MethodVisualizer method={tuningTab} font={fonts[tuningTab as MethodType.TRACY | MethodType.SOUSA]} />
                                </div>

                                <div className="hidden lg:block dark:bg-zinc-950/40 bg-zinc-50/60 rounded-lg p-5 border dark:border-zinc-800 border-zinc-300 my-6 text-left w-full">
                                    <h4 className="text-xs font-black dark:text-white text-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                        <Target className="w-3.5 h-3.5" />
                                        Fundamentos Teóricos
                                    </h4>
                                    <div className="dark:text-zinc-300 text-zinc-700 text-xs md:text-sm leading-relaxed font-medium">
                                        {tuningTab === 'TRACY' ? (
                                            <div className="space-y-3">
                                                <p>
                                                    Walter Tracy propõe que o <span className="dark:text-white text-zinc-950 font-bold"> ritmo tipográfico</span> é uma relação direta entre o espaço interno e as margens externas.
                                                </p>
                                                <div className="dark:bg-zinc-900/50 bg-zinc-100/50 p-3.5 rounded-md border dark:border-zinc-800 border-zinc-200 space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="dark:text-white text-black font-black text-[11px] uppercase tracking-wider">Haste Reta</span>
                                                        <span className="dark:text-zinc-500 text-zinc-500 text-[10px] font-mono">FIXO</span>
                                                    </div>
                                                    <p className="text-xs dark:text-zinc-400 text-zinc-600 leading-tight">Glifos como H e n recebem a carga metrológica primária, servindo como modelo para o resto da fonte.</p>
                                                </div>
                                            </div>
                                        ) : tuningTab === 'SOUSA' ? (
                                            <div className="space-y-3">
                                                <p>
                                                    O método de Miguel Sousa organiza o espaçamento em <span className="dark:text-white text-zinc-950 font-bold">três grandes grupos</span> baseados na semelhança de forma e relações de herança entre os glifos.
                                                </p>
                                                <div className="dark:bg-zinc-900/50 bg-zinc-100/50 p-3.5 rounded-md border dark:border-zinc-800 border-zinc-200 space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="dark:text-white text-black font-black text-[11px] uppercase tracking-wider">Semelhança de Forma</span>
                                                        <span className="dark:text-zinc-500 text-zinc-500 text-[10px] font-mono">REFERÊNCIA</span>
                                                    </div>
                                                    <p className="text-xs dark:text-zinc-400 text-zinc-600 leading-tight">O sistema utiliza relações onde hastes herdam de 'l' e curvas de 'o', permitindo ajustes visuais precisos onde a geometria falha.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <p>
                                                    A <span className="dark:text-white text-zinc-950 font-bold">métrica original</span> representa o desenho pretendido pelo autor. Analisar esses valores é essencial para entender as decisões estéticas iniciais.
                                                </p>
                                                <div className="dark:bg-zinc-900/50 bg-zinc-100/50 p-3.5 rounded-md border dark:border-zinc-800 border-zinc-200 space-y-1.5">
                                                    <div className="flex justify-between items-center">
                                                        <span className="dark:text-zinc-300 text-zinc-700 font-black text-[11px] uppercase tracking-wider">Métrica de Fábrica</span>
                                                        <span className="dark:text-zinc-500 text-zinc-500 text-[10px] font-mono">BASELINE</span>
                                                    </div>
                                                    <p className="text-xs dark:text-zinc-400 text-zinc-600 leading-tight">Observe como o designer original equilibrou as massas pretas e brancas antes de aplicar métodos sistemáticos.</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sticky Action Footer in Info Panel */}
                        <div className="p-5 dark:bg-zinc-900/90 bg-zinc-100/90 backdrop-blur-md border-t dark:border-zinc-800 border-zinc-200 mt-auto">
                            <div className="flex flex-col gap-2.5 w-full">
                                <button 
                                    onClick={handleProcess}
                                    className="px-6 py-3.5 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold shadow-lg flex items-center justify-center gap-2.5 w-full transform active:scale-[0.99] transition-all text-xs uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    Processar e Visualizar Resultados <ArrowRight className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setStep(AppStep.UPLOAD)}
                                    className="px-6 py-2.5 rounded-lg border dark:border-zinc-800 border-zinc-300 dark:hover:bg-zinc-800/50 hover:bg-zinc-200/50 transition-all dark:text-zinc-400 text-zinc-600 font-bold text-xs uppercase tracking-wider dark:hover:text-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                                >
                                    Trocar Arquivo Fonte
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
                )}
                </div>
            </div>
        )}

        {step === AppStep.ANALYSIS && (
            <div className="flex-1 flex flex-col w-full min-h-[750px] pb-12">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2 shrink-0">
                    <h2 className="text-xl md:text-2xl font-black dark:text-white text-zinc-950 flex items-center gap-2 uppercase tracking-tighter">
                        <MousePointerClick className="w-6 h-6 dark:text-white text-black" />
                        Análise Comparativa
                    </h2>
                    <button 
                        onClick={() => setStep(AppStep.PREPARATION)}
                        className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-bold shadow-lg w-full sm:w-auto transform active:scale-[0.99] transition-all uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-xs cursor-pointer"
                    >
                        <Settings2 className="w-4 h-4 dark:text-black text-white" /> 
                        Retornar aos ajustes
                    </button>
                </div>
                <div className="flex-1 flex flex-col w-full min-h-[650px] min-w-0">
                     <AnalysisCanvas 
                      fonts={fonts} 
                      rawBuffer={fontBuffer}
                      onUpdateGlyph={handleUpdateIndividualGlyph} 
                      selectedChar={sharedSelectedChar}
                      onCharSelect={setSharedSelectedChar}
                      lastEditedMethod={lastEditedMethod}
                    />
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default App;
