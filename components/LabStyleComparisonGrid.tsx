
import React from 'react';
import { FontState, MethodType } from '../types';
import { AnalysisCanvas } from './AnalysisCanvas';

interface LabStyleComparisonGridProps {
  fontRef: FontState | null;
  fontExp: FontState | null;
  refName?: string;
  expName?: string;
}

export const LabStyleComparisonGrid: React.FC<LabStyleComparisonGridProps> = ({
  fontRef,
  fontExp,
  refName,
  expName
}) => {
  // Font mapping for AnalysisCanvas:
  // MethodType.ORIGINAL -> Original Reference
  // MethodType.TRACY -> Adjusted Specimen (Experimental)
  // MethodType.SOUSA -> Ignored in Compare mode
  const fontsMap = {
    [MethodType.ORIGINAL]: fontRef,
    [MethodType.TRACY]: fontExp,
    [MethodType.SOUSA]: null,
  };

  return (
    <div className="flex-1 flex flex-col min-h-[650px] w-full bg-white dark:bg-zinc-950 border dark:border-zinc-800 border-zinc-200 rounded-xl shadow-2xl">
        <AnalysisCanvas 
            fonts={fontsMap} 
            isCompareMode={true} 
            customLabels={{
                original: refName || 'Referência',
                tracy: expName || 'Experimental'
            }}
        />
    </div>
  );
};
