export default function FormError({ mensaje }: { mensaje: string }) {
  if (!mensaje) return null;
  return (
    <div className="bg-red-50 text-red-600 text-xs px-3 py-2">
      {mensaje}
    </div>
  );
}
