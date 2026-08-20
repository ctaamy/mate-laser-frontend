export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  categoria_id?: number;
  precio_base: number;
  precio_tachado?: number;
  // stock/stock_alerta/sku: solo vienen en /productos/admin/* (ver
  // ProductosService.aVistaPublica en el backend). Los endpoints públicos
  // (GET /productos, GET /productos/:slug) devuelven en su lugar
  // disponible/pocas_unidades/cantidad_maxima, sin exponer el número real
  // (hallazgo #8 del plan de seguridad/performance).
  stock?: number;
  stock_alerta?: number;
  sku?: string;
  disponible?: boolean;
  pocas_unidades?: boolean;
  cantidad_maxima?: number;
  material?: string;
  dimensiones?: string;
  peso_kg?: number;
  apto_grabado: boolean;
  colores_disponibles: string[];
  personalizado_habilitado: boolean;
  personalizado_max_chars: number;
  personalizado_placeholder?: string;
  activo: boolean;
  destacado: boolean;
  orden: number;
  creado_en: string;
  categorias?: Categoria;
  imagenes_producto?: ImagenProducto[];
  variantes_producto?: VarianteProducto[];
  tipos_opcion?: TipoOpcion[];
  resenas_producto?: Resena[];
}

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  descripcion?: string;
  padre_id?: number;
  orden: number;
  activo: boolean;
  imagen_configurador_url?: string | null;
  other_categorias?: Categoria[];
}

export interface ImagenProducto {
  id: string;
  producto_id: string;
  url: string;
  alt_texto?: string;
  orden: number;
  es_principal: boolean;
}

export interface VarianteProducto {
  id: string;
  producto_id: string;
  /** @deprecated reemplazado por variante_valores */
  color?: string;
  /** @deprecated reemplazado por variante_valores */
  atributos: Record<string, any>;
  precio_override?: number;
  // Ídem Producto.stock: solo en admin. Público trae disponible/pocas_unidades/cantidad_maxima.
  stock?: number;
  disponible?: boolean;
  pocas_unidades?: boolean;
  cantidad_maxima?: number;
  imagen_id?: string;
  imagenes_producto?: ImagenProducto;
  activo: boolean;
  variante_valores?: VarianteValor[];
}

export interface TipoOpcion {
  id: string;
  producto_id: string;
  nombre: string;
  orden: number;
  valores: ValorOpcion[];
}

export interface ValorOpcion {
  id: string;
  tipo_opcion_id: string;
  valor: string;
  orden: number;
}

export interface VarianteValor {
  variante_id: string;
  valor_opcion_id: string;
  valores_opcion: ValorOpcion & { tipos_opcion: TipoOpcion };
}

export interface Resena {
  id: string;
  producto_id: string;
  usuario_id?: string;
  puntuacion: number;
  comentario?: string;
  nombre_revisor?: string;
  ciudad_revisor?: string;
  verificado: boolean;
  visible: boolean;
  creado_en: string;
}

export interface DireccionEnvio {
  tipo?: string;
  calle?: string;
  piso?: string;
  cp?: string;
  ciudad?: string;
  provincia?: string;
  pais?: string;
  partido?: string;
  quien_recibe?: string;
  recibe_comprador?: boolean;
  especificaciones?: string;
  dni_receptor?: string;
  entre_calles?: string;
  // Solo para tipo 'venta_manual' (ver OrdenesService.crearVentaManual en
  // el backend) — nombre/telefono de contacto del cliente, opcionales.
  nombre?: string;
  telefono?: string;
  email?: string;
}

export interface Orden {
  id: string;
  usuario_id?: string;
  estado: string;
  direccion_envio: DireccionEnvio;
  subtotal: number;
  costo_envio: number;
  descuento: number;
  total: number;
  metodo_pago?: string;
  metodo_envio_nombre?: string;
  numero_seguimiento?: string;
  url_seguimiento?: string;
  notas?: string;
  nombre_cliente?: string;
  apellido_cliente?: string;
  email_cliente?: string;
  telefono_cliente?: string;
  creado_en: string;
  // 'web' (checkout público, default) o 'admin_manual' (venta cargada a
  // mano en el admin — presencial, redes, feria). Ver CLAUDE.md.
  canal?: string;
  cargado_por_id?: string;
  items_orden?: ItemOrden[];
  pagos?: Pago[];
  envios_orden?: { tracking_number?: string; estado?: string }[];
  usuarios?: { nombre: string; apellido: string };
  metodos_envio?: { nombre: string };
}

export interface ItemOrden {
  id: string;
  orden_id: string;
  producto_id?: string;
  nombre_producto: string;
  color?: string;
  texto_grabado?: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

export interface Pago {
  id: string;
  orden_id: string;
  proveedor: string;
  estado: string;
  monto: number;
  reserva_vence_en?: string;
  pagado_en?: string;
}

export interface MetodoEnvio {
  id: number;
  nombre: string;
  proveedor: string;
  descripcion?: string;
  costo: number | null;
  api_conectada: boolean;
  envio_gratis_disponible: boolean;
  monto_envio_gratis: number;
  // false cuando el método existe pero no aplica para la selección actual
  // (ej. logística privada fuera de zona de cobertura) — se muestra
  // deshabilitado en vez de ocultarse.
  disponible?: boolean;
}

export interface Cupon {
  id: string;
  codigo: string;
  tipo: string;
  valor: number;
  descuento: number;
}

export interface Usuario {
  id: string;
  email: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  rol: string;
  activo: boolean;
  email_verificado?: boolean;
  ultimo_login?: string;
  creado_en: string;
}

// Shape acotado de GET /ordenes/mis-ordenes (sin pagos, ver ordenes.service.ts findMisOrdenes)
export interface OrdenResumen {
  id: string;
  estado: string;
  total: number;
  creado_en: string;
  metodo_pago?: string;
  items_orden?: { id: string; nombre_producto: string; cantidad: number }[];
}