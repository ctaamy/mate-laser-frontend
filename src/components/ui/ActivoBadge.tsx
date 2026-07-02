export default function ActivoBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${activo ? 'bg-[#E1F5EE] text-[#0F6E56]' : 'bg-gray-100 text-gray-500'}`}>
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}
