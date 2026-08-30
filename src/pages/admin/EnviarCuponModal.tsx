import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Send } from 'lucide-react';
import api from '../../lib/api';
import AdminButton from '../../components/admin/ui/AdminButton';
import AdminModal from '../../components/admin/ui/AdminModal';
import { AdminInput, AdminLabel } from '../../components/admin/ui/AdminInput';
import { useAuthStore } from '../../store/auth.store';

interface CuponRow {
  id: string;
  codigo: string;
}

interface Resumen {
  destinatarios: number;
  puede_enviar: boolean;
  avisos: string[];
  cupon: { codigo: string; tipo: string; valor: number; monto_minimo: number | null; vence_en: string | null };
}

export default function EnviarCuponModal({ cupon, onClose }: { cupon: CuponRow | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const adminEmail = useAuthStore((s) => s.usuario?.email ?? '');

  const [asunto, setAsunto] = useState('');
  const [intro, setIntro] = useState('');
  const [pruebaEmail, setPruebaEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setPruebaEmail(adminEmail);
    setFeedback('');
    setError('');
    setAsunto('');
    setIntro('');
  }, [cupon, adminEmail]);

  const { data: resumen, isLoading } = useQuery<Resumen>({
    queryKey: ['cupon-campania', cupon?.id],
    queryFn: () => api.get(`/cupones/${cupon!.id}/campania`).then((r) => r.data),
    enabled: !!cupon,
  });

  const pruebaMutation = useMutation({
    mutationFn: () =>
      api.post(`/cupones/${cupon!.id}/campania`, { asunto, intro, prueba: true, prueba_email: pruebaEmail }),
    onSuccess: () => setFeedback(`Te mandamos una prueba a ${pruebaEmail}.`),
    onError: (e: any) => setError(e.response?.data?.message || 'No se pudo enviar la prueba.'),
  });

  const enviarMutation = useMutation({
    mutationFn: () => api.post(`/cupones/${cupon!.id}/campania`, { asunto, intro }),
    onSuccess: (r) => {
      setFeedback(`Encolado para ${r.data.destinatarios} suscriptores.`);
      queryClient.invalidateQueries({ queryKey: ['cupones'] });
      queryClient.invalidateQueries({ queryKey: ['cupon-campania', cupon?.id] });
    },
    onError: (e: any) => setError(e.response?.data?.message || 'No se pudo enviar la campaña.'),
  });

  const enviando = pruebaMutation.isPending || enviarMutation.isPending;

  const confirmarYEnviar = () => {
    setError('');
    setFeedback('');
    const n = resumen?.destinatarios ?? 0;
    if (n === 0) {
      setError('No hay suscriptores confirmados a quienes enviar.');
      return;
    }
    if (!confirm(`Vas a enviar el cupón ${cupon!.codigo} a ${n} suscriptores. No se puede deshacer.`)) return;
    enviarMutation.mutate();
  };

  return (
    <AdminModal
      open={!!cupon}
      onClose={onClose}
      title={`Enviar cupón ${cupon?.codigo ?? ''} por email`}
      maxWidth="lg"
      footer={
        <>
          <AdminButton variant="secondary" onClick={onClose}>Cerrar</AdminButton>
          <AdminButton
            variant="primary"
            icon={<Send size={14} />}
            disabled={enviando || isLoading || !resumen?.puede_enviar}
            onClick={confirmarYEnviar}
          >
            {enviarMutation.isPending ? 'Enviando…' : `Enviar a ${resumen?.destinatarios ?? '…'}`}
          </AdminButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {isLoading ? (
          <p className="text-sm text-[var(--ink-soft)]">Cargando…</p>
        ) : (
          <>
            <p className="text-sm text-[var(--ink)]">
              Se envía <strong>solo a suscriptores confirmados del newsletter</strong>:{' '}
              <strong>{resumen?.destinatarios ?? 0}</strong> personas.
            </p>

            {resumen?.avisos.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5 border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-xs">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <span>{a}</span>
              </div>
            ))}

            <div>
              <AdminLabel>Asunto</AdminLabel>
              <AdminInput value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Un cupón de Mate Laser Studio para vos" />
            </div>
            <div>
              <AdminLabel>Texto de intro (opcional)</AdminLabel>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Arranca el invierno y queremos que estrenes mate…"
                className="w-full border border-[var(--line)] rounded-[var(--radius-el)] px-3 py-2 text-sm bg-[var(--panel)] text-[var(--ink)] focus:outline-none focus:border-[var(--ink)]"
              />
              <p className="text-[11px] text-[var(--ink-soft)] mt-1">
                El código, el descuento y el vencimiento se arman solos desde el cupón. El footer incluye link de baja.
              </p>
            </div>

            <div className="border-t border-[var(--line)] pt-3">
              <AdminLabel>Enviarme una prueba a</AdminLabel>
              <div className="flex gap-2">
                <AdminInput value={pruebaEmail} onChange={(e) => setPruebaEmail(e.target.value)} placeholder="tu@email.com" />
                <AdminButton
                  variant="secondary"
                  disabled={enviando || !pruebaEmail}
                  onClick={() => { setError(''); setFeedback(''); pruebaMutation.mutate(); }}
                >
                  {pruebaMutation.isPending ? 'Enviando…' : 'Probar'}
                </AdminButton>
              </div>
            </div>

            {feedback && <p className="text-xs text-green-700">{feedback}</p>}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </>
        )}
      </div>
    </AdminModal>
  );
}
