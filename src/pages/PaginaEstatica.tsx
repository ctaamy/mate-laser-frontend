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
  const { data: config } = useQuery<Record<string, any>>({
    queryKey: ['configuracion'],
    queryFn: () => api.get('/configuracion').then(r => r.data),
  });

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
