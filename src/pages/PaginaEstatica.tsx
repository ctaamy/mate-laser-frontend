import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import api from '../lib/api';
import { useTemaGlobalData } from '../hooks/useThemeGlobal';

// Página estática de contenido editable (título + Markdown) desde el
// admin — reusa el mismo mecanismo genérico de configuración clave/valor que
// ya existe para el tema global (GET /configuracion público = publicado,
// PUT /configuracion:clave admin = borrador), sin agregar tablas ni
// endpoints nuevos. El contenido real se carga después desde el admin; acá
// solo existen la ruta y el template. Se renderiza con react-markdown (sin
// rehype-raw), que no interpreta HTML embebido — evita XSS sin necesidad de
// sanitizar manualmente.
export default function PaginaEstatica({ claveBase, tituloDefault }: { claveBase: string; tituloDefault: string }) {
  const tema = useTemaGlobalData();
  const { data: config, isLoading } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
  });

  // Mientras la respuesta de /configuracion no llegó, `config` es undefined y
  // el `||` de abajo caía en el placeholder como si fuera el estado real —
  // hallazgo #10 del plan de seguridad/performance (2026-08-17). Con este
  // guard, "todavía no fue cargado" solo aparece si de verdad no hay
  // contenido cargado en el admin.
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 animate-pulse">
        <div className="h-8 w-2/3 rounded bg-black/10 mb-8" />
        <div className="space-y-3">
          <div className="h-4 rounded bg-black/10" />
          <div className="h-4 rounded bg-black/10" />
          <div className="h-4 w-5/6 rounded bg-black/10" />
        </div>
      </div>
    );
  }

  const titulo: string = config?.[`${claveBase}_titulo`] || tituloDefault;
  const markdown: string = config?.[`${claveBase}_markdown`] || 'Este contenido todavía no fue cargado.';

  return (
    <div className="max-w-3xl mx-auto px-6 py-16" style={{ color: tema.texto_color, fontFamily: tema.font_family || undefined }}>
      <h1 className="text-3xl font-bold tracking-tight mb-8">{titulo}</h1>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
