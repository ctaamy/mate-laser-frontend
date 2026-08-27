// Stepper del flujo de compra (Carrito → Datos de envío → Pago → Confirmación).
// Reemplaza las 4 copias inline casi idénticas que había en Carrito.tsx,
// Checkout.tsx, Pago.tsx y Confirmacion.tsx — cada una con su propio bug de
// responsive (3 de las 4 desbordaban a lo ancho en <375px por no tener wrap).
//
// Mobile (<sm): versión compacta — barra de progreso + "Paso X de 4" + el
// label del paso actual. No intenta meter 4 labels + conectores en 375px.
// sm+: stepper horizontal completo, con wrap por las dudas.

const STEPS = ['Carrito', 'Datos de envío', 'Pago', 'Confirmación'];

interface CheckoutStepsProps {
  // Índice del paso actual (0-3).
  current: number;
  // 'success' = paleta verde de Confirmación (todos los pasos completos);
  // 'default' = paleta negra del resto del flujo.
  variant?: 'default' | 'success';
}

export default function CheckoutSteps({ current, variant = 'default' }: CheckoutStepsProps) {
  const success = variant === 'success';

  return (
    // <div> y no <nav>: hay tests (checkout-tema-aislado) que seleccionan
    // page.locator('nav') en modo strict esperando solo el Navbar global.
    <div aria-label="Progreso del checkout" className="mb-10">
      {/* ── Mobile compacto ── */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between text-[11px] font-medium mb-2">
          <span className={success ? 'text-[#0F6E56]' : 'text-black'}>
            Paso {current + 1} de {STEPS.length}
          </span>
          <span className="text-black/40">{STEPS[current]}</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= current
                  ? success ? 'bg-[#1D9E75]' : 'bg-black'
                  : 'bg-black/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── sm+ stepper completo ── */}
      <div className="hidden sm:flex items-center justify-center flex-wrap gap-y-2 gap-x-2 text-xs">
        {STEPS.map((step, i) => {
          const isCurrent = i === current;
          const isDone = i < current;
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 ${
                  isCurrent
                    ? success ? 'text-[#0F6E56] font-medium' : 'text-black font-medium'
                    : isDone
                      ? success ? 'text-[#0F6E56]' : 'text-black/40'
                      : success ? 'text-[#0F6E56]' : 'text-black/20'
                }`}
              >
                <div
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-medium ${
                    success ? 'rounded-full' : ''
                  } ${
                    success
                      ? 'bg-[#1D9E75] text-white'
                      : isCurrent
                        ? 'bg-black text-white'
                        : isDone
                          ? 'bg-black/10 text-black/50'
                          : 'border border-black/15 text-black/20'
                  }`}
                >
                  {success || isDone ? '✓' : i + 1}
                </div>
                {step}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-px ${
                    success
                      ? 'bg-[#1D9E75]'
                      : isDone ? 'bg-black/30' : 'bg-black/10'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
