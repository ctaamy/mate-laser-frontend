import type { DireccionEnvio } from '../../types';

interface Props {
  direccion: DireccionEnvio;
  /** 'public': página de confirmación del comprador. 'admin': modal de gestión de órdenes. */
  variant?: 'public' | 'admin';
}

export default function ResumenDireccionEnvio({ direccion, variant = 'public' }: Props) {
  if (direccion.tipo === 'retiro') return null;

  const label = (texto: string) =>
    variant === 'admin' ? <span className="text-gray-400">{texto}: </span> : null;

  return (
    <>
      <div>
        {label('Dirección')}
        {direccion.calle}
        {direccion.piso && `, ${direccion.piso}`}
      </div>
      <div>
        {variant === 'public' && (
          <>{direccion.ciudad}, {direccion.provincia}{direccion.cp && ` (CP ${direccion.cp})`}</>
        )}
        {variant === 'admin' && (
          <>
            {direccion.ciudad && `, ${direccion.ciudad}`}
            {direccion.provincia && `, ${direccion.provincia}`}
            {direccion.cp && ` (CP ${direccion.cp})`}
          </>
        )}
      </div>
      {direccion.quien_recibe && (
        <div>
          {label('Recibe')}
          {direccion.quien_recibe}
          {direccion.recibe_comprador === false && (
            <span className="ml-1.5 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded align-middle">
              Recibe: tercero
            </span>
          )}
          {direccion.dni_receptor && ` · DNI ${direccion.dni_receptor}`}
        </div>
      )}
      {direccion.entre_calles && <div>{label('Entre calles')}{direccion.entre_calles}</div>}
      {direccion.especificaciones && (
        <div className={variant === 'public' ? 'text-gray-400 italic' : ''}>
          {label('Especificaciones')}
          {direccion.especificaciones}
        </div>
      )}
    </>
  );
}
