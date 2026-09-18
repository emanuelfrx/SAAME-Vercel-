
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppStep, FontState, MethodType } from './types';
import { createFontState } from './services/fontService';
import { FileUpload } from './components/FileUpload';
import { LabStyleComparisonGrid } from './components/LabStyleComparisonGrid';
import { Loader2, Activity, Home, ArrowRight, CheckCircle2 } from 'lucide-react';

export const CompareSpacingFlow: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [refFile, setRefFile] = useState<{ buffer: ArrayBuffer | null, name: string }>({ buffer: null, name: '' });
  const [expFile, setExpFile] = useState<{ buffer: ArrayBuffer | null, name: string }>({ buffer: null, name: '' });
  
  const [refFont, setRefFont] = useState<FontState | null>(null);
  const [expFont, setExpFont] = useState<FontState | null>(null);

  // Efeito para injetar as fontes no CSS (Pipeline Independente)
  useEffect(() => {
    if (refFont || expFont) {
      const styleId = 'compare-fonts-css';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      let css = '';
      if (refFont) css += `@font-face { font-family: '${refFont.fullFontFamily}'; src: url('${refFont.url}'); }\n`;
      if (expFont) css += `@font-face { font-family: '${expFont.fullFontFamily}'; src: url('${expFont.url}'); }\n`;
      styleTag.textContent = css;
    }
  }, [refFont, expFont]);

  const handleProcess = async () => {
    if (!refFile.buffer || !expFile.buffer) return;
    setIsProcessing(true);
    setProgress(10);

    try {
      // Passo 1: Parse Referência
      setProgress(30);
      const rFont = await createFontState(refFile.buffer.slice(0), MethodType.ORIGINAL);
      rFont.fullFontFamily = `Ref-${Date.now()}`;
      
      // Passo 2: Parse Experimental
      setProgress(60);
      const eFont = await createFontState(expFile.buffer.slice(0), MethodType.TRACY);
      eFont.fullFontFamily = `Exp-${Date.now()}`;

      setProgress(90);
      setRefFont(rFont);
      setExpFont(eFont);
      
      setTimeout(() => {
        setStep(AppStep.ANALYSIS);
        setIsProcessing(false);
        setProgress(100);
      }, 500);
    } catch (err) {
      console.error("Pipeline Error:", err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen dark:bg-zinc-950 bg-zinc-50 dark:text-zinc-200 text-zinc-800 overflow-hidden relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
      
      {/* INDICADOR DE PROGRESSO / OVERLAY */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 dark:bg-zinc-950/95 bg-white/95 backdrop-blur-md flex items-center justify-center flex-col"
          >
            <div className="relative w-32 h-32 mb-10">
              <Loader2 className="w-full h-full dark:text-white text-black animate-spin opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center dark:bg-zinc-950 bg-white rounded-full m-4 shadow-inner border dark:border-zinc-800 border-zinc-200">
                <span className="text-3xl font-black dark:text-white text-black tabular-nums">{progress}%</span>
              </div>
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-2 border-dashed dark:border-white/30 border-black/30 rounded-full"
              />
            </div>
            <h2 className="text-3xl font-black dark:text-white text-zinc-950 uppercase tracking-tighter mb-2">Sincronizando Fontes</h2>
            <div className="w-72 h-1.5 dark:bg-zinc-800 bg-zinc-200 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                className="h-full bg-black dark:bg-white" 
                animate={{ width: `${progress}%` }} 
              />
            </div>
            <p className="mt-6 text-xs dark:text-zinc-400 text-zinc-600 uppercase tracking-widest font-black animate-pulse">Alinhamento em andamento</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="flex items-center justify-between px-6 py-4 dark:bg-zinc-900/60 bg-white/80 backdrop-blur border-b dark:border-zinc-800 border-zinc-200 shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="p-2 dark:hover:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-all dark:text-zinc-400 text-zinc-600 dark:hover:text-white hover:text-black focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            aria-label="Voltar para a Página Inicial"
            title="Voltar ao Início"
          >
            <Home className="w-5 h-5" />
          </button>
          
          <div className="h-8 w-px dark:bg-zinc-800 bg-zinc-200 hidden md:block" />

          <div className="flex items-center gap-3">
            <div className="bg-black dark:bg-white p-2 rounded-xl shadow-md">
              <Activity className="w-6 h-6 text-white dark:text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black dark:text-white text-zinc-950 tracking-tighter uppercase leading-none flex items-center">
                <span>SAAME</span>
                <span className="text-zinc-500 font-light ml-2">Compare</span>
              </h1>
              <p className="text-[11px] dark:text-zinc-400 text-zinc-600 uppercase tracking-widest font-bold mt-0.5 opacity-70">Análise de resultados</p>
            </div>
          </div>
        </div>
        
        {step === AppStep.ANALYSIS && (
          <button 
            onClick={() => setStep(AppStep.UPLOAD)}
            className="text-xs font-black uppercase bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black px-6 py-2.5 rounded-full border dark:border-zinc-700 border-zinc-300 transition-all tracking-widest shadow-md focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
            aria-label="Iniciar Nova Comparação"
          >
            Nova Comparação
          </button>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 min-h-0 w-full relative flex flex-col overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar items-center justify-start">
        {step === AppStep.UPLOAD && (
          <div className="w-full max-w-5xl space-y-6 sm:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 my-auto p-2 sm:p-6">
            <div className="text-center space-y-2 sm:space-y-4">
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black dark:text-white text-zinc-950 tracking-tighter uppercase">Seleção de Fontes</h2>
              <div className="w-16 sm:w-20 h-1 bg-black dark:bg-white mx-auto rounded-full" />
              <p className="dark:text-zinc-400 text-zinc-600 text-sm sm:text-lg max-w-lg mx-auto font-medium leading-relaxed">Carregue um par de fontes para comparação</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 md:gap-10">
              {/* SLOT REFERÊNCIA */}
              <motion.div 
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-5 sm:p-8 md:p-10 rounded-2xl md:rounded-3xl border-2 transition-all duration-500 shadow-lg relative overflow-hidden group ${refFile.buffer ? 'dark:bg-zinc-900/60 bg-zinc-100/80 border-black dark:border-white' : 'dark:bg-zinc-900/40 bg-zinc-100/50 border-dashed dark:border-zinc-800 border-zinc-300'}`}
              >
                <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Activity className="w-8 h-8 sm:w-12 sm:h-12 dark:text-white text-black" />
                </div>
                <div className="flex items-center justify-between mb-4 sm:mb-8 relative z-10">
                   <span className="text-[10px] sm:text-xs font-black dark:text-white text-black uppercase tracking-[0.2em] sm:tracking-[0.3em] dark:bg-white/10 bg-black/5 px-3 sm:px-4 py-1.5 rounded-full border dark:border-white/20 border-black/10">01. Referência</span>
                  {refFile.buffer && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 dark:text-white text-black" />
                    </motion.div>
                  )}
                </div>
                <FileUpload onFileLoaded={(b, n) => setRefFile({ buffer: b, name: n })} compact={true} />
                {refFile.name && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mt-4 sm:mt-6 flex items-center gap-3 dark:bg-zinc-900 bg-white p-3 rounded-xl sm:rounded-2xl border dark:border-zinc-800 border-zinc-300 shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full dark:bg-white bg-black animate-pulse" />
                    <span className="text-[11px] dark:text-white text-zinc-950 font-bold tracking-tight truncate">{refFile.name}</span>
                  </motion.div>
                )}
              </motion.div>

              {/* SLOT EXPERIMENTAL */}
              <motion.div 
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-5 sm:p-8 md:p-10 rounded-2xl md:rounded-3xl border-2 transition-all duration-500 shadow-lg relative overflow-hidden group ${expFile.buffer ? 'dark:bg-zinc-900/60 bg-zinc-100/80 border-black dark:border-white' : 'dark:bg-zinc-900/40 bg-zinc-100/50 border-dashed dark:border-zinc-800 border-zinc-300'}`}
              >
                <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-10 group-hover:opacity-30 transition-opacity">
                    <Activity className="w-8 h-8 sm:w-12 sm:h-12 dark:text-white text-black" />
                </div>
                <div className="flex items-center justify-between mb-4 sm:mb-8 relative z-10">
                   <span className="text-[10px] sm:text-xs font-black dark:text-white text-black uppercase tracking-[0.2em] sm:tracking-[0.3em] dark:bg-white/10 bg-black/5 px-3 sm:px-4 py-1.5 rounded-full border dark:border-white/20 border-black/10">02. Experimental</span>
                  {expFile.buffer && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                         <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 dark:text-white text-black" />
                    </motion.div>
                  )}
                </div>
                <FileUpload onFileLoaded={(b, n) => setExpFile({ buffer: b, name: n })} compact={true} />
                {expFile.name && (
                   <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="mt-4 sm:mt-6 flex items-center gap-3 dark:bg-zinc-900 bg-white p-3 rounded-xl sm:rounded-2xl border dark:border-zinc-800 border-zinc-300 shadow-sm"
                  >
                    <div className="w-2 h-2 rounded-full dark:bg-white bg-black animate-pulse" />
                    <span className="text-[11px] dark:text-white text-zinc-950 font-bold tracking-tight truncate">{expFile.name}</span>
                  </motion.div>
                )}
              </motion.div>
            </div>

            <div className="flex justify-center pt-4 sm:pt-8 pb-6 sm:pb-10">
              <button 
                disabled={!refFile.buffer || !expFile.buffer}
                onClick={handleProcess}
                className={`group flex items-center justify-center gap-3 sm:gap-4 px-6 sm:px-12 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl uppercase tracking-tighter transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-black dark:focus:ring-white w-full sm:w-auto
                  ${(refFile.buffer && expFile.buffer) 
                    ? 'bg-black text-white dark:bg-white dark:text-black hover:scale-105 shadow-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer' 
                    : 'dark:bg-zinc-800 bg-zinc-200 text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-50'}`}
                aria-label="Carregar e Comparar Fontes"
              >
                Carregar e Comparar Fontes <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {step === AppStep.ANALYSIS && (
          <div className="w-full flex-1 flex flex-col p-2 sm:p-4 md:p-0 animate-in zoom-in-95 duration-700 min-h-[750px] min-w-0 pb-16">
            <LabStyleComparisonGrid 
              fontRef={refFont}
              fontExp={expFont}
              refName={refFile.name}
              expName={expFile.name}
            />
          </div>
        )}
      </main>
    </div>
  );
};
