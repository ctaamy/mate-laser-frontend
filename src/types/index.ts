export interface Producto {
  id: string;
  nombre: string;
  slug: string;
  descripcion?: string;
  categoria_id?: number;
  precio_base: number;
  precio_tachado?: number;
  stock: number;
  stock_alerta: number;
  sku?: string;
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
  color?: string;
  atributos: Record<string, any>;
  precio_override?: number;
  stock: number;
  activo: boolean;
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

export interface Orden {
  id: string;
  usuario_id?: string;
  estado: string;
  direccion_envio: Record<string, any>;
  subtotal: number;
  costo_envio: number;
  descuento: number;
  total: number;
  metodo_pago?: string;
  numero_seguimiento?: string;
  creado_en: string;
  items_orden?: ItemOrden[];
  pagos?: Pago[];
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
  costo: number;
  api_conectada: boolean;
  envio_gratis_disponible: boolean;
  monto_envio_gratis: number;
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
  ultimo_login?: string;
  creado_en: string;
}