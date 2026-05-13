import { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportElementToPptx } from '../utils/exportPptx';

// Botão "PPT" para exportar um elemento DOM como slide PPTX.
//   targetRef  — ref para o nó que será capturado
//   title      — título do slide
//   subtitle   — linha secundária (mês, unidade, etc.)
//   fileName   — opcional; default = <title>.pptx
export default function ExportPptButton({ targetRef, title, subtitle, fileName, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const onClick = useCallback(async (e) => {
    e.stopPropagation();
    if (busy) return;
    if (!targetRef?.current) { setErr('Conteúdo indisponível.'); return; }
    setBusy(true); setErr(null);
    try {
      await exportElementToPptx(targetRef.current, { title, subtitle, fileName });
    } catch (ex) {
      console.error('Export PPTX falhou:', ex);
      setErr('Falha ao exportar.');
    } finally {
      setBusy(false);
      setTimeout(() => setErr(null), 3000);
    }
  }, [busy, targetRef, title, subtitle, fileName]);

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
