import { Plus } from 'lucide-react';

export default function BotonNuevo({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#1D9E75] text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 hover:bg-[#0F6E56] transition-colors"
    >
      <Plus size={16} /> {label}
    </button>
  );
}
