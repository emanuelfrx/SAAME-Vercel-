
import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onFileLoaded: (buffer: ArrayBuffer, fileName: string) => void;
  compact?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState<string | null>(null);

  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'otf' && extension !== 'ttf') {
      setError('Formato inválido. Use arquivos .otf ou .ttf');
      setFileSelected(null);
      return;
    }

    setError(null);
    setFileSelected(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onFileLoaded(e.target.result as ArrayBuffer, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }, [onFileLoaded]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex flex-col items-center justify-center ${compact ? 'h-auto py-8' : 'min-h-[300px] h-[40vh] md:h-[50vh]'} border-2 border-dashed transition-all duration-300 rounded-3xl ${
        isDragging 
          ? 'border-black dark:border-white bg-black/5 dark:bg-white/5 scale-[1.02] shadow-xl' 
          : error 
          ? 'border-zinc-600 bg-zinc-500/5' 
          : 'dark:border-zinc-800 border-zinc-300 dark:bg-zinc-900/40 bg-zinc-100/40 dark:hover:bg-zinc-900/60 hover:bg-zinc-100/60 dark:hover:border-zinc-700 hover:border-zinc-400'
      }`}
    >
      <div className={`text-center ${compact ? 'p-4' : 'p-8'} flex flex-col items-center`}>
        <div className={`transition-all duration-500 rounded-2xl inline-flex p-4 mb-6 ${
          error ? 'dark:bg-zinc-800 bg-zinc-200 text-zinc-900 dark:text-white' : 
          fileSelected ? 'dark:bg-zinc-800 bg-zinc-200 text-zinc-900 dark:text-white' :
          'dark:bg-zinc-800 bg-zinc-200 text-zinc-900 dark:text-white'
        }`}>
          {error ? <AlertCircle className="w-8 h-8" /> : 
           fileSelected ? <CheckCircle2 className="w-8 h-8" /> :
           <Upload className="w-8 h-8" />}
        </div>
        
        <h3 className="text-2xl font-black dark:text-white text-zinc-950 mb-2 tracking-tight">
          {fileSelected ? 'Fonte Carregada!' : 'Importar Fontes'}
        </h3>
        
        <p className="dark:text-zinc-400 text-zinc-600 mb-8 max-w-xs text-base font-medium leading-relaxed">
          {error ? error : 
           fileSelected ? `Pronto para processar: ${fileSelected}` :
           'Arraste o arquivo ou clique para selecionar. Formatos .otf e .ttf suportados.'}
        </p>
        
        {!fileSelected && (
          <label 
            className="cursor-pointer bg-black hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black font-black py-3 px-10 rounded-xl transition-all shadow-md text-sm uppercase tracking-widest transform active:scale-95 focus-within:ring-2 focus-within:ring-black dark:focus-within:ring-white outline-none"
            title="Selecionar arquivo de fonte"
          >
            <span>Selecionar Arquivo</span>
            <input 
              type="file" 
              accept=".otf,.ttf" 
              className="sr-only" 
              onChange={handleFileChange}
              aria-label="Selecionar arquivo de fonte (.otf ou .ttf)"
            />
          </label>
        )}

        {fileSelected && !error && (
          <div className="flex items-center gap-2 text-xs dark:text-white text-zinc-950 font-bold uppercase tracking-widest dark:bg-white/10 bg-black/5 px-4 py-2 rounded-full border dark:border-white/20 border-black/10">
            Arquivo validado com sucesso
          </div>
        )}
      </div>
    </div>
  );
};
