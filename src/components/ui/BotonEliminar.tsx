import { Trash2 } from 'lucide-react';

export default function BotonEliminar({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 border border-gray-200 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-40 disabled:pointer-events-none"
    >
      <Trash2 size={13} />
    </button>
  );
}
