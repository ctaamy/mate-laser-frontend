import { Trash2 } from 'lucide-react';

export default function BotonEliminar({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors"
    >
      <Trash2 size={13} />
    </button>
  );
}
