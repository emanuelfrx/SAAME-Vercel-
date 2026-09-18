import React from 'react';
import { Layout, Zap, Circle, ArrowRight, Activity, CheckCircle2, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FontState } from '../types';

// --- VISUAIS AUXILIARES ---

const SideBearingsVisual: React.FC = () => (
  <div className="w-full dark:bg-zinc-950/40 bg-zinc-50/40 rounded-xl p-4 md:p-6 flex flex-col items-center justify-center gap-4 min-h-[200px] border dark:border-zinc-800 border-zinc-300 overflow-hidden">
    <div className="relative flex items-end justify-center w-64 h-24">
      {/* LSB Line */}
      <motion.div 
        animate={{ width: [30, 45, 12, 38, 20, 50, 30], opacity: [0.3, 0.6, 0.4, 0.7, 0.3, 0.5, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 right-[50%] mr-6 h-24 dark:bg-zinc-800/60 bg-zinc-300/60 border-x dark:border-zinc-600 border-zinc-400 flex items-center justify-center origin-right"
      >
        <span className="absolute -top-6 text-[11px] font-black dark:text-zinc-300 text-zinc-700">LSB</span>
      </motion.div>

      {/* Character */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-24 w-12 dark:bg-white bg-black flex items-center justify-center z-10 shadow-lg">
        <span className="text-6xl font-serif font-black dark:text-black text-white select-none">H</span>
      </div>

      {/* RSB Line */}
      <motion.div 
        animate={{ width: [30, 18, 55, 25, 40, 15, 30], opacity: [0.3, 0.5, 0.7, 0.3, 0.6, 0.4, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-0 left-[50%] ml-6 h-24 dark:bg-zinc-800/60 bg-zinc-300/60 border-r dark:border-zinc-600 border-zinc-400 flex items-center justify-center origin-left"
      >
        <span className="absolute -top-6 text-[11px] font-black dark:text-zinc-300 text-zinc-700">RSB</span>
      </motion.div>
    </div>
    <div className="mt-8 px-3 py-1 dark:bg-zinc-800 bg-zinc-200 rounded border dark:border-zinc-700 border-zinc-300 text-[11px] font-black dark:text-zinc-300 text-zinc-700 uppercase tracking-widest">
      Margens de Segurança (Side Bearings)
    </div>
  </div>
);

const VisualRhythmVisual: React.FC = () => (
  <div className="w-full dark:bg-zinc-950/40 bg-zinc-50/40 rounded-xl p-4 md:p-6 flex flex-col items-center justify-center gap-6 min-h-[200px] border dark:border-zinc-800 border-zinc-300 overflow-hidden">
    <div className="flex flex-wrap items-end justify-center gap-4">
      {/* Reto */}
      <div className="flex items-end dark:bg-zinc-900 bg-zinc-100 p-1 rounded border dark:border-zinc-800 border-zinc-300">
        <div className="h-16 w-5 dark:bg-zinc-800 bg-zinc-200 border-l dark:border-zinc-700 border-zinc-300" />
        <div className="h-16 w-10 dark:bg-zinc-200 bg-zinc-800 flex items-center justify-center text-4xl font-serif font-black dark:text-zinc-950 text-white">H</div>
        <div className="h-16 w-5 dark:bg-zinc-800 bg-zinc-200 border-r dark:border-zinc-700 border-zinc-300" />
      </div>
      
      {/* Redondo com compensação */}
      <div className="flex items-end dark:bg-zinc-900 bg-zinc-100 p-1 rounded border dark:border-zinc-800 border-zinc-300">
        <motion.div 
          animate={{ width: [12, 6, 12] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-16 dark:bg-zinc-700 bg-zinc-300 border-l dark:border-zinc-600 border-zinc-400" 
        />
        <div className="h-16 w-12 dark:bg-zinc-300 bg-zinc-700 flex items-center justify-center text-4xl font-serif font-black dark:text-zinc-950 text-white rounded-full">O</div>
        <motion.div 
          animate={{ width: [12, 6, 12] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-16 dark:bg-zinc-700 bg-zinc-300 border-r dark:border-zinc-600 border-zinc-400" 
        />
      </div>
    </div>
    <p className="text-xs text-center font-black dark:text-zinc-400 text-zinc-600 uppercase tracking-widest italic">
      Compensação Óptica: Curvas invadem o espaço em branco
    </p>
  </div>
);


// --- COMPONENTE DE CONCEITOS ---

export const TypographicSpacingConcepts: React.FC = () => {
  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
      {/* Grid Principal */}
      <div className="grid grid-cols-1 gap-10">
        
        {/* Outros Conceitos em Coluna Única */}
        <div className="grid grid-cols-1 gap-12">
          {/* Side Bearings */}
          <div className="dark:bg-zinc-900/30 bg-zinc-100/40 p-8 md:p-10 rounded-3xl border dark:border-zinc-800 border-zinc-300 flex flex-col gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 dark:text-white text-black">
                <Layout className="w-5 h-5" />
                <h5 className="text-lg font-black uppercase tracking-[0.2em]">Side Bearings</h5>
              </div>
              <p className="dark:text-zinc-300 text-zinc-700 text-base md:text-lg leading-relaxed font-medium">
                Margens laterais (LSB/RSB) que garantem a <strong>zona de respiro</strong> de cada letra, permitindo que as formas não se toquem e mantenham legibilidade.
              </p>
            </div>
            <SideBearingsVisual />
          </div>

          {/* Ritmo Visual */}
          <div className="dark:bg-zinc-900/30 bg-zinc-100/40 p-8 md:p-10 rounded-3xl border dark:border-zinc-800 border-zinc-300 flex flex-col gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 dark:text-white text-black">
                <Zap className="w-5 h-5" />
                <h5 className="text-lg font-black uppercase tracking-[0.2em]">Ritmo Visual</h5>
              </div>
              <p className="dark:text-zinc-300 text-zinc-700 text-base md:text-lg leading-relaxed font-medium">
                Gestão de espaços entre diferentes formas geométricas (retas vs. curvas) para evitar <strong>buracos visuais</strong> e criar uma textura uniforme.
              </p>
            </div>
            <VisualRhythmVisual />
          </div>

          {/* Advance Width */}
          <div className="dark:bg-zinc-900/30 bg-zinc-100/40 p-8 md:p-10 rounded-3xl border dark:border-zinc-800 border-zinc-300 flex flex-col gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 dark:text-white text-black">
                <ArrowRight className="w-5 h-5" />
                <h5 className="text-lg font-black uppercase tracking-[0.2em]">Advance Width</h5>
              </div>
              <p className="dark:text-zinc-300 text-zinc-700 text-base md:text-lg leading-relaxed font-medium">
                A largura total de avanço do glifo, composta pelo desenho da letra somado às suas margens laterais. É o que define o passo de cada caractere na linha.
              </p>
            </div>
            <div className="h-[200px] md:h-[300px] dark:bg-zinc-950/40 bg-zinc-50/40 rounded-xl border dark:border-zinc-800 border-zinc-300 flex items-center justify-center flex-col gap-6">
               <div className="relative border-x-2 dark:border-white/30 border-black/30 px-12 py-4">
                 <span className="text-7xl font-serif dark:text-white text-black opacity-20 italic">n</span>
                 <motion.div 
                   animate={{ scaleX: [0, 1] }}
                   transition={{ duration: 2, repeat: Infinity }}
                   className="absolute bottom-0 left-0 right-0 h-1 bg-black dark:bg-white origin-left"
                 />
               </div>
               <span className="text-xs font-mono dark:text-white text-black font-black uppercase tracking-[0.3em]">Total: LSB + Desenho + RSB</span>
            </div>
          </div>

          {/* Contraforma */}
          <div className="dark:bg-zinc-900/30 bg-zinc-100/40 p-8 md:p-10 rounded-3xl border dark:border-zinc-800 border-zinc-300 flex flex-col gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 dark:text-white text-black">
                <Circle className="w-5 h-5" />
                <h5 className="text-lg font-black uppercase tracking-[0.2em]">Contraforma</h5>
              </div>
              <p className="dark:text-zinc-300 text-zinc-700 text-base md:text-lg leading-relaxed font-medium">
                O espaço negativo dentro e ao redor das letras, que interage com o espaço entre elas. Segundo a literatura acadêmica, o espaçamento é a gestão destas massas brancas.
              </p>
            </div>
            <div className="py-8 md:py-12 dark:bg-zinc-950/40 bg-zinc-50/40 rounded-xl border dark:border-zinc-800 border-zinc-300 flex flex-col items-center justify-center gap-8 overflow-visible w-full px-2 sm:px-4">
               {/* Linha 1 */}
               <div className="flex flex-row flex-nowrap items-center justify-center gap-2 sm:gap-4 md:gap-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-medium dark:text-white text-black tracking-normal w-full max-w-full leading-none">
                 <div className="relative inline-flex items-center text-center leading-none">
                    <span className="relative z-10 px-1">H</span>
                 </div>
                 
                 <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 dark:text-zinc-500 text-zinc-400 flex-shrink-0" />
                 
                 <div className="flex flex-col justify-between h-[0.7em] w-[0.45em] flex-shrink-0 relative">
                    <div className="bg-zinc-300 dark:bg-zinc-700 opacity-80 w-full h-[45%]" />
                    <div className="bg-zinc-300 dark:bg-zinc-700 opacity-80 w-full h-[45%]" />
                 </div>
                 
                 <span className="text-2xl sm:text-3xl md:text-4xl dark:text-zinc-400 text-zinc-600 font-sans flex-shrink-0">+</span>
                 
                 <span className="relative z-10 px-1">H</span>
               </div>

               {/* Linha 2 */}
               <div className="flex flex-row flex-nowrap items-center justify-center gap-2 sm:gap-4 md:gap-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-sans font-medium dark:text-white text-black tracking-tight w-full max-w-full leading-none">
                 <div className="relative inline-flex items-center text-center leading-none">
                    <span className="relative z-10 px-1">O</span>
                 </div>
                 
                 <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 dark:text-zinc-500 text-zinc-400 flex-shrink-0" />
                 
                 <div className="bg-zinc-300 dark:bg-zinc-700 opacity-80 rounded-[50%] w-[0.45em] h-[0.6em] flex-shrink-0 relative" />
                 
                 <span className="text-2xl sm:text-3xl md:text-4xl dark:text-zinc-400 text-zinc-600 font-sans flex-shrink-0">+</span>
                 
                 <span className="relative z-10 px-1">O</span>
               </div>
               
               <p className="text-xs md:text-sm dark:text-zinc-400 text-zinc-600 italic mt-6 font-medium">
                 Fonte: Banjanin e Nedeljković (2014)
               </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- DATA & ANIMATIONS FOR TRACY/SOUSA ---

const TRACY_GUIDE = [
  {
    title: "Caracteres Mestres: H, O, n, o",
    description: "Walter Tracy define o 'H' e 'O' (Maiúsculas) e 'n' e 'o' (minúsculas) como os pilares. O sistema começa identificando a contraforma desses glifos."
  },
  {
    title: "Geometria da Contraforma",
    description: "Medimos o espaço interno. Para letras retas (H, n), o side-bearing lateral deve ser ~50% da contraforma. Para redondas (O, o), o valor é reduzido para compensar a ilusão de ótica."
  },
  {
    title: "Equilíbrio Óptico",
    description: "Ajustamos o LSB e RSB para que o glifo pareça centralizado visualmente. Letras redondas exigem menos espaço lateral que as retas devido ao menor ponto de contato."
  },
  {
    title: "Propagação do Ritmo",
    description: "O valor calculado no mestre é propagado para seus 'herdeiros'. O LSB do 'H' é aplicado a todos os glifos com forma basica quadricular (B, D, E, F...)."
  }
];

const SOUSA_GUIDE = [
  {
    title: "Três Grandes Grupos",
    description: "O método divide as letras em três categorias: 1º Grupo (totalmente relacionado a outros glifos), 2º Grupo (um lado relacionado, outro visual) e 3º Grupo (totalmente visual)."
  },
  {
    title: "Herança de Mestres (l e o)",
    description: "Espaços laterais são herdados por semelhança: o lado redondo de 'd' ou 'q' herda de 'o'. Hastes retas como 'h' ou 'b' herdam o valor de 'l' (em nosso sistema, usamos 'n' como referência de haste)."
  },
  {
    title: "Ajuste Híbrido (Grupo 2)",
    description: "Glifos como 'r' possuem um lado relacional (haste esquerda herda de 'l') e um lado único (arco direito) que deve ser calculado e ajustado puramente pelo olhar do designer."
  },
  {
    title: "Expansão para Caixa-Alta",
    description: "Aplicamos a lógica de Fernando Mello: G1 (BDEFHINOQ - Relacional), G2 (CGJKLPR - Híbrido) e G3 (AMSTUVWXYZ - Visual), garantindo método mesmo sem regras matemáticas fechadas."
  }
];

const TracyAnimation: React.FC<{ idx: number; fontFamily?: string }> = ({ idx, fontFamily }) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div className="relative flex flex-col items-center w-full">
           <div className="flex items-center justify-center w-full gap-12">
              <div className="relative">
                  {idx === 0 || idx === 1 || idx === 3 ? (
                    <div className="flex gap-12 items-center">
                       <div 
                         style={{ fontFamily: fontFamily || 'serif' }}
                         className="text-7xl dark:text-white text-zinc-950 font-black relative flex items-center justify-center"
                       >
                          H
                       </div>
                       <div 
                         style={{ fontFamily: fontFamily || 'serif' }}
                         className="text-7xl dark:text-white text-zinc-950 font-black opacity-80"
                       >
                          O
                       </div>
                    </div>
                 ) : (
                    <div className="relative flex items-center justify-center px-4 md:px-20 py-10 w-full">
                       <div 
                         style={{ fontFamily: fontFamily || 'serif' }}
                         className="text-6xl md:text-8xl dark:text-white text-zinc-950 font-black relative"
                       >
                          n
                          <motion.div 
                            animate={{ x: [-20, -40, -20] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="absolute inset-y-0 left-[-15px] w-0.5 dark:bg-white bg-black" 
                          >
                             <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 rounded-full dark:bg-white bg-black" />
                          </motion.div>
                          
                          <motion.div 
                            animate={{ x: [20, 40, 20] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="absolute inset-y-0 right-[-15px] w-0.5 dark:bg-white bg-black" 
                          >
                             <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rounded-full dark:bg-white bg-black" />
                          </motion.div>

                          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-32 h-1 dark:bg-zinc-800 bg-zinc-200 rounded-full">
                             <motion.div 
                               animate={{ left: ['20%', '80%', '20%'] }}
                               transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                               className="absolute -top-1.5 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-black dark:border-white"
                             />
                          </div>
                       </div>
                    </div>
                 )}
              </div>
           </div>

           {idx === 3 && (
              <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }}
                 className="flex flex-wrap justify-center gap-2 mt-6 max-w-full"
              >
                 {['H', 'B', 'D', 'E', 'F', 'L'].map((char, i) => (
                   <motion.div 
                    key={char} 
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ delay: i * 0.15, repeat: Infinity, duration: 2 }}
                    style={{ fontFamily: fontFamily || 'serif' }}
                    className="text-2xl dark:text-zinc-400 text-zinc-600 font-bold"
                   >
                     {char}
                   </motion.div>
                 ))}
              </motion.div>
           )}
        </div>
    </div>
  );
};

const SousaAnimation: React.FC<{ idx: number; fontFamily?: string }> = ({ idx, fontFamily }) => {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4">
        {idx === 0 && (
          <div className="flex flex-col items-center gap-4 w-full">
             <div className="flex flex-wrap justify-center gap-3 w-full">
                <div 
                  style={{ fontFamily: fontFamily || 'serif' }}
                  className="p-4 rounded-xl dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-800 border-zinc-300 dark:text-white text-zinc-950 flex flex-col items-center shadow-sm"
                >
                   <span className="text-4xl font-black">H I</span>
                   <span className="text-xs dark:text-zinc-400 text-zinc-600 mt-2 uppercase font-black tracking-widest">Retas</span>
                </div>
                <div 
                  style={{ fontFamily: fontFamily || 'serif' }}
                  className="p-4 rounded-xl dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-700 border-zinc-400 dark:text-white text-zinc-950 flex flex-col items-center shadow-sm"
                >
                   <span className="text-4xl dark:text-zinc-200 text-zinc-800 font-black">O C</span>
                   <span className="text-xs dark:text-zinc-400 text-zinc-600 mt-2 uppercase font-black tracking-widest">Curvas</span>
                </div>
                <div 
                  style={{ fontFamily: fontFamily || 'serif' }}
                  className="p-4 rounded-xl dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-800 border-zinc-300 dark:text-white text-zinc-950 flex flex-col items-center shadow-sm"
                >
                   <span className="text-4xl font-black">A V</span>
                   <span className="text-xs dark:text-zinc-400 text-zinc-600 mt-2 uppercase font-black tracking-widest">Diagonais</span>
                </div>
             </div>
          </div>
        )}

        {idx === 1 && (
          <div className="flex items-center gap-4 relative">
             <div style={{ fontFamily: fontFamily || 'serif' }} className="text-5xl dark:text-white text-zinc-950 opacity-20">n</div>
             <div style={{ fontFamily: fontFamily || 'serif' }} className="text-8xl dark:text-white text-zinc-950 font-black relative">
                o
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 border-4 dark:border-white border-black rounded-full -m-2"
                />
             </div>
             <div style={{ fontFamily: fontFamily || 'serif' }} className="text-5xl dark:text-white text-zinc-950 opacity-20">n</div>
             
             <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-24 h-1 dark:bg-zinc-800 bg-zinc-200 rounded-full">
                <motion.div 
                  animate={{ left: ['10%', '90%', '10%'] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute -top-1 w-3 h-3 dark:bg-white bg-black rounded-full shadow-lg"
                />
             </div>
          </div>
        )}

        {idx === 2 && (
          <div className="flex items-center gap-6">
             <div className="relative">
                <div 
                  style={{ fontFamily: fontFamily || 'serif' }}
                  className="w-20 h-20 rounded-full border-4 dark:border-white border-black flex items-center justify-center text-4xl font-black dark:text-white text-zinc-950"
                >
                  o
                </div>
                <motion.div 
                   animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                   transition={{ repeat: Infinity }}
                   className="absolute -inset-4 border dark:border-zinc-500 border-zinc-400 rounded-full"
                />
             </div>
             <ArrowRight className="w-8 h-8 dark:text-zinc-400 text-zinc-600" />
             <div className="flex gap-3">
                <div style={{ fontFamily: fontFamily || 'serif' }} className="w-12 h-12 rounded-lg dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-700 border-zinc-300 flex items-center justify-center dark:text-white text-zinc-950 text-2xl font-bold">c</div>
                <div style={{ fontFamily: fontFamily || 'serif' }} className="dark:text-white text-zinc-950 text-4xl opacity-50">...</div>
                <div style={{ fontFamily: fontFamily || 'serif' }} className="w-12 h-12 rounded-lg dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-700 border-zinc-300 flex items-center justify-center dark:text-white text-zinc-950 text-2xl font-bold">e</div>
             </div>
          </div>
        )}

        {idx === 3 && (
          <div className="w-full max-w-[280px] space-y-3 relative p-4 dark:bg-zinc-900/50 bg-zinc-100/50 rounded-xl border dark:border-zinc-800 border-zinc-300">
             <div className="flex items-center gap-1 justify-center">
                {Array.from({length: 12}).map((_, i) => (
                  <motion.div 
                    key={i}
                    animate={{ height: [12, 16, 12] }}
                    transition={{ delay: i * 0.1, repeat: Infinity }}
                    className="w-2 dark:bg-zinc-600 bg-zinc-400 rounded-full" 
                  />
                ))}
             </div>
             <p className="text-[11px] text-center dark:text-zinc-400 text-zinc-600 font-black uppercase tracking-[0.25em]">Harmonia da Mancha</p>
          </div>
        )}
    </div>
  );
};

// --- COMPONENTE PRINCIPAL (EXPORTADO PARA O APP) ---

interface MethodVisualizerProps {
  method: 'TRACY' | 'SOUSA' | 'ORIGINAL' | 'ORIGINAL_CUSTOM';
  font: FontState | null;
}

export const MethodVisualizer: React.FC<MethodVisualizerProps> = ({ method, font }) => {
  if (method === 'ORIGINAL' || method === 'ORIGINAL_CUSTOM') {
    return (
      <div className="w-full dark:bg-zinc-950/40 bg-zinc-50/40 rounded-2xl border dark:border-zinc-800 border-zinc-300 overflow-hidden mb-8">
        <div className="dark:bg-zinc-900/90 bg-zinc-100/90 backdrop-blur-md p-4 border-b dark:border-zinc-800 border-zinc-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 dark:text-white text-black" />
            <span className="text-xs font-black dark:text-white text-zinc-950 uppercase tracking-[0.2em]">CONCEITOS BÁSICOS</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full dark:bg-white bg-black animate-pulse" />
          </div>
        </div>
        <div className="h-[500px] md:h-[800px] overflow-y-auto custom-scrollbar p-6">
          <TypographicSpacingConcepts />
          <div className="pt-10 flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full dark:bg-white/10 bg-black/5 border dark:border-white/20 border-black/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 dark:text-white text-black" />
            </div>
            <p className="text-[11px] font-black dark:text-zinc-400 text-zinc-600 uppercase tracking-[0.3em]">Conceitos Básicos Apresentados</p>
          </div>
        </div>
      </div>
    );
  }

  const steps = method === 'TRACY' ? TRACY_GUIDE : SOUSA_GUIDE;

  return (
    <div className="w-full dark:bg-zinc-950/40 bg-zinc-50/40 rounded-2xl border dark:border-zinc-800 border-zinc-300 overflow-hidden mb-8">
      {/* Tutorial Fixed Header */}
      <div className="dark:bg-zinc-900/90 bg-zinc-100/90 backdrop-blur-md p-4 border-b dark:border-zinc-800 border-zinc-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <Activity className="w-4 h-4 dark:text-white text-black" />
           <span className="text-xs font-black dark:text-white text-zinc-950 uppercase tracking-[0.2em]">{method === 'TRACY' ? 'TUTORIAL TRACY' : 'TUTORIAL SOUSA'}</span>
        </div>
        <div className="flex items-center gap-1">
           <div className="w-1.5 h-1.5 rounded-full dark:bg-white bg-black animate-pulse" />
           <span className="text-[10px] font-bold dark:text-zinc-400 text-zinc-600 uppercase tracking-tighter">Guia Visual</span>
        </div>
      </div>

      {/* Scrollable Tutorial Area */}
      <div className="h-[500px] md:h-[800px] overflow-y-auto custom-scrollbar p-6 space-y-12 pb-20">
        {steps.map((step, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className="dark:bg-zinc-900/30 bg-zinc-100/30 p-8 md:p-10 rounded-3xl border dark:border-zinc-800 border-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-500 flex flex-col gap-8"
          >
            {/* Explanatory Text */}
            <div className="space-y-4">
               <div className="flex items-center gap-3">
                 <div className="shrink-0 w-8 h-8 rounded-xl dark:bg-zinc-800 bg-zinc-200 border dark:border-zinc-700 border-zinc-300 flex items-center justify-center text-sm font-black dark:text-white text-zinc-950 shadow-sm">
                   {idx + 1}
                 </div>
                 <h5 className="text-lg md:text-xl font-black dark:text-white text-zinc-950 uppercase tracking-[0.2em] italic">{step.title}</h5>
               </div>
               <p className="dark:text-zinc-300 text-zinc-700 text-base md:text-lg leading-relaxed font-medium">
                 {step.description}
               </p>
            </div>

            {/* Concept Visualization */}
            <div className="space-y-6">
              <div className="h-48 md:h-64 dark:bg-zinc-950/40 bg-zinc-50/40 rounded-2xl border dark:border-zinc-800 border-zinc-300 relative flex items-center justify-center overflow-hidden">
                 <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" 
                      style={{ backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                 <div className="scale-[0.8] sm:scale-100 md:scale-125 transform origin-center transition-transform">
                   {method === 'TRACY' ? (
                     <TracyAnimation idx={idx} fontFamily={font?.fullFontFamily} />
                   ) : (
                     <SousaAnimation idx={idx} fontFamily={font?.fullFontFamily} />
                   )}
                 </div>
              </div>

              {/* Specific Callouts below the animation */}
              {method === 'TRACY' && idx === 1 && (
                <motion.div 
                   initial={{ opacity: 0, y: 10 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   className="flex justify-center"
                >
                   <div className="px-6 py-3 dark:bg-zinc-800 bg-zinc-200 rounded-2xl border dark:border-zinc-700 border-zinc-300 text-xs md:text-sm font-black dark:text-white text-zinc-950 uppercase tracking-[0.25em] italic">
                     Análise de Contraforma em Tempo Real
                   </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}

        <div className="pt-10 flex flex-col items-center gap-3">
           <div className="w-8 h-8 rounded-full dark:bg-white/10 bg-black/5 border dark:border-white/20 border-black/10 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 dark:text-white text-black" />
           </div>
           <p className="text-[11px] font-black dark:text-zinc-400 text-zinc-600 uppercase tracking-[0.3em]">Conceitos Absorvidos</p>
        </div>
      </div>
    </div>
  );
};
