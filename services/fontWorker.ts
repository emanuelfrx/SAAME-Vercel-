import * as opentype from 'opentype.js';
import {
    stripLayoutTables,
    ensureGlyphNames,
    prepareFontForExport,
    setGlyphSB,
    cleanMetrics,
    applyTracyMethod,
    applySousaMethod,
    getCounterMetrics,
} from './fontService';

// NOTE (fix): this worker used to re-implement its own copies of DIACRITICS_MAP,
// stripLayoutTables, ensureGlyphNames, prepareFontForExport, setGlyphSB, cleanMetrics,
// applyTracyMethod, applySousaMethod and getCounterMetrics. Because Vite workers run
// with { type: 'module' }, they can import ES modules directly, so all of that logic
// is now imported from fontService.ts instead of hand-copied here. This removes the
// risk of the two copies quietly drifting apart (e.g. the worker's diacritics map had
// a typo mapping lowercase 'y' to the uppercase 'Ȳ' glyph, and its Sousa/Tracy methods
// could silently fall out of sync with the ones used in the live preview).

const updateHheaTable = (font: any) => {
    if (!font.tables.hhea) return;

    let minLSB = 32767;
    let minRSB = 32767;
    let maxExtent = -32768;
    let maxAdvance = 0;

    for (let i = 0; i < font.glyphs.length; i++) {
        const glyph = font.glyphs.get(i);
        const lsb = glyph.leftSideBearing || 0;
        const advance = glyph.advanceWidth || 0;
        const box = glyph.getBoundingBox();
        const rsb = advance - (box.x2 || 0);
        const extent = box.x2 || 0;

        if (lsb < minLSB) minLSB = lsb;
        if (rsb < minRSB) minRSB = rsb;
        if (extent > maxExtent) maxExtent = extent;
        if (advance > maxAdvance) maxAdvance = advance;
    }

    font.tables.hhea.minLeftSideBearing = minLSB;
    font.tables.hhea.minRightSideBearing = minRSB;
    font.tables.hhea.xMaxExtent = maxExtent;
    font.tables.hhea.advanceWidthMax = maxAdvance;
};

const prepareAndBuffer = (f: any, name: string): ArrayBuffer => {
    if (f.tables.kern) delete f.tables.kern;
    if (f.tables.gpos) delete f.tables.gpos;
    prepareFontForExport(f, name);
    ensureGlyphNames(f);

    // Crucial: Update hhea and hmtx-related values
    updateHheaTable(f);

    if (!f.tables.post) f.tables.post = {};
    f.tables.post.version = 3;
    return f.toArrayBuffer();
};

let cachedBaseFont: any = null;
let cachedCleanBuffer: ArrayBuffer | null = null;

self.onmessage = async (e: MessageEvent) => {
    const { action, buffer, tracySettings, sousaSettings, familyNamePrefix, context, method, settings } = e.data;

    try {
        if (action === 'PROCESS_ALL' || action === 'INITIAL_PARSE') {
             const isImport = context === 'IMPORT';
             if (buffer) {
                 cachedCleanBuffer = stripLayoutTables(buffer);
                 cachedBaseFont = opentype.parse(cachedCleanBuffer);
             }

             if (action === 'INITIAL_PARSE') {
                 self.postMessage({ action: 'INITIAL_SUCCESS' });
                 return;
             }

             const baseFont = cachedBaseFont;
             const cleanBuffer = cachedCleanBuffer;

             // 2. Metrics Measurement
             self.postMessage({ action: 'PROGRESS', progress: 15, status: isImport ? 'Calculando proporções iniciais...' : 'Avaliando métricas base...' });
             const measureMetric = (f: any, chars: string[], type: 'max' | 'min', fallback: number) => {
                let best = fallback;
                let found = false;
                chars.forEach(char => {
                    const glyph = f.charToGlyph(char);
                    if (glyph && glyph.path.commands.length > 0) {
                        const box = glyph.getBoundingBox();
                        if (type === 'max') {
                            if (!found || box.y2 > best) { best = box.y2; found = true; }
                        } else {
                            if (!found || box.y1 < best) { best = box.y1; found = true; }
                        }
                    }
                });
                return Math.round(best);
             };

             const visAscender = measureMetric(baseFont, ['d', 'h', 'l', 'b', 'k', 'H'], 'max', baseFont.ascender);
             const visDescender = measureMetric(baseFont, ['p', 'q', 'y', 'g'], 'min', baseFont.descender);

            const glyphsList: string[] = [];
            for (let i = 0; i < baseFont.glyphs.length; i++) {
                const g = baseFont.glyphs.get(i);
                if (g.unicode && g.unicode > 32) {
                    try { glyphsList.push(String.fromCodePoint(g.unicode)); } catch (e) {}
                }
            }

            const metrics: any = {
                ascender: visAscender,
                descender: visDescender,
                unitsPerEm: baseFont.unitsPerEm,
                xHeight: 0,
                capHeight: 0,
                chars: glyphsList
            };
             const xGlyph = baseFont.charToGlyph('x');
             const hGlyph = baseFont.charToGlyph('H');
             if (xGlyph && xGlyph.unicode) {
                 const box = xGlyph.getBoundingBox();
                 metrics.xHeight = box.y2 - box.y1;
             }
             if (hGlyph && hGlyph.unicode) {
                 const box = hGlyph.getBoundingBox();
                 metrics.capHeight = box.y2 - box.y1;
             }

             // 3. Process Method Variants
             // We need fresh parses for each to avoid mutating original for buffer generation
             self.postMessage({ action: 'PROGRESS', progress: 20, status: isImport ? 'Configurando ambiente de análise...' : 'Preparando instâncias...' });
             const tFont = opentype.parse(cleanBuffer!);
             const sFont = opentype.parse(cleanBuffer!);

             self.postMessage({ action: 'PROGRESS', progress: 30, status: isImport ? 'Limpando kerning nativo...' : 'Limpando métricas originais (Tracy)...' });
             cleanMetrics(tFont, (p) => {
                 self.postMessage({ action: 'PROGRESS', progress: 30 + (p * 0.20), status: isImport ? 'Limpando kerning nativo...' : 'Limpando métricas originais (Tracy)...' });
             });
             self.postMessage({ action: 'PROGRESS', progress: 50, status: isImport ? 'Normalizando larguras...' : 'Limpando métricas originais (Sousa)...' });
             cleanMetrics(sFont, (p) => {
                 self.postMessage({ action: 'PROGRESS', progress: 50 + (p * 0.15), status: isImport ? 'Normalizando larguras...' : 'Limpando métricas originais (Sousa)...' });
             });

             self.postMessage({ action: 'PROGRESS', progress: 65, status: isImport ? 'Preparando método Tracy...' : 'Aplicando método Tracy...' });
             applyTracyMethod(tFont, tracySettings);
             self.postMessage({ action: 'PROGRESS', progress: 75, status: isImport ? 'Preparando método Sousa...' : 'Aplicando método Sousa...' });
             applySousaMethod(sFont, sousaSettings);

             self.postMessage({ action: 'PROGRESS', progress: 80, status: isImport ? 'Processando contraformas...' : 'Analisando contraformas...' });
             const counterMap: Record<string, any> = {};
             const stdChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split('');
             stdChars.forEach(c => {
                 counterMap[c] = getCounterMetrics(baseFont, c);
             });

             const tName = `Tracy-${Date.now()}`;
             const sName = `Sousa-${Date.now()}`;

             self.postMessage({ action: 'PROGRESS', progress: 85, status: isImport ? 'Construindo fontes em memória...' : 'Gerando binário (Tracy)...' });
             const tBuffer = prepareAndBuffer(tFont, tName);
             self.postMessage({ action: 'PROGRESS', progress: 95, status: isImport ? 'Carregando interface...' : 'Gerando binário (Sousa)...' });
             const sBuffer = prepareAndBuffer(sFont, sName);

             self.postMessage({ action: 'PROGRESS', progress: 100, status: isImport ? 'Importação Concluída!' : 'Finalizando...' });
             (self as any).postMessage({
                 action: 'PROCESS_SUCCESS',
                 metrics: { ...metrics, counterMap },
                 tracy: { buffer: tBuffer, family: tName },
                 sousa: { buffer: sBuffer, family: sName }
             }, [tBuffer, sBuffer]);
        } else if (action === 'APPLY_METHOD') {
            if (!cachedCleanBuffer) {
                throw new Error("No font buffer cached in worker");
            }

            const tempFont = opentype.parse(cachedCleanBuffer);
            if (method === 'TRACY') {
                cleanMetrics(tempFont);
                applyTracyMethod(tempFont, settings);
            } else if (method === 'SOUSA') {
                cleanMetrics(tempFont);
                applySousaMethod(tempFont, settings);
            } else if (method === 'ORIGINAL_CUSTOM') {
                // For Original Custom, we don't clean so we preserve original SB
                Object.keys(settings.overrides).forEach(char => {
                    const { lsb, rsb } = settings.overrides[char];
                    setGlyphSB(tempFont, char, lsb, rsb);
                });
            }

            const familyName = `${method}-Live-${Date.now()}`;
            if (tempFont.tables.kern) delete tempFont.tables.kern;
            if (tempFont.tables.gpos) delete tempFont.tables.gpos;
            prepareFontForExport(tempFont, familyName);
            ensureGlyphNames(tempFont);
            if (!tempFont.tables.post) tempFont.tables.post = {} as any;
            tempFont.tables.post.version = 3;

            const buffer = tempFont.toArrayBuffer();
            (self as any).postMessage({
                action: 'APPLY_METHOD_SUCCESS',
                buffer,
                familyName,
                method
            }, [buffer]);
        }
    } catch (error: any) {
        self.postMessage({ action: 'ERROR', error: error.message });
    }
};