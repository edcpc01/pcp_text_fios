import { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportReport, exportElementToPptx } from '../utils/exportPptx';

// Botão "PPT" para exportar slides nativos (gráfico + tabela editáveis).
//
// Modo nativo (preferido):
//   <ExportPptButton report={() => ({ title, subtitle, slides: [...] })} />
//
// Modo imagem (fallback — captura DOM):
//   <ExportPptButton targetRef={ref} title="..." subtitle="..." />
export default function ExportPptButton({
  report,           // () => { title, subtitle, fileName, slides }
  targetRef,        // ref para captura DOM (modo fallback)
  title, subtitle, fileName,
  className = '',
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const onClick = useCallback(async (e) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      if (typeof report === 'function') {
        const built = await report();
        if (!built || !built.slides?.length) throw new Error('Sem dados para exportar.');
        await exportReport({
          title:    built.title    ?? title,
          subtitle: built.subtitle ?? subtitle,
          fileName: built.fileName ?? fileName,
          slides:   built.slides,
        });
      } else if (targetRef?.current) {
        await exportElementToPptx(targetRef.current, { title, subtitle, fileName });
      } else {
        throw new Error('Conteúdo indisponível.');
      }
    } catch (ex) {
      console.error('Export PPTX falhou:', ex);
      setErr(ex.message || 'Falha ao exportar.');
    } finally {
      setBusy(false);
      setTimeout(() => setErr(null), 4000);
    }
  }, [busy, report, targetRef, title, subtitle, fileName]);

  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={err || 'Exportar como PPTX'}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold
        bg-brand-surface/60 border border-brand-border text-brand-muted
        hover:text-white hover:border-orange-400/40
        disabled:opacity-50 transition-all ${className}`}>
      {busy
        ? <Loader2 size={11} className="animate-spin" />
        : <Download size={11} />}
      <span>PPT</span>
    </button>
  );
}
