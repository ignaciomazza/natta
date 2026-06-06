import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

export const metadata: Metadata = {
  title: "Comprobante | Natta",
};

export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const order = await prisma.order.findUnique({
    where: { publicReceiptCode: code },
    include: {
      items: {
        include: {
          flavor: true,
          size: true,
        },
      },
      payments: {
        orderBy: [{ createdAt: "asc" }],
      },
    },
  });

  if (!order) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-14">
        <article className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-zinc-900">Comprobante no encontrado</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Verificá el código y volvé a intentarlo.
          </p>
        </article>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-14">
      <article className="rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Natta · Comprobante</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Código {order.publicReceiptCode}</h1>
        <p className="mt-3 text-sm text-zinc-700">
          Estado del pedido: <strong>{order.status}</strong>
        </p>

        <div className="mt-5 grid gap-4 rounded-xl border border-zinc-200 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Fecha de entrega</p>
            <p className="mt-1 text-sm text-zinc-900">
              {new Intl.DateTimeFormat("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
              }).format(new Date(order.deliveryDate))}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Modalidad</p>
            <p className="mt-1 text-sm text-zinc-900">
              {order.fulfillmentMode === "PICKUP" ? "Retiro" : "Envío"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Total</p>
            <p className="mt-1 text-sm text-zinc-900">{formatMoney(order.subtotalArs)}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Resumen de pago
          </h2>
          <p className="mt-3 text-sm text-zinc-700">
            Pagado: <strong>{formatMoney(order.amountPaidArs)}</strong>
          </p>
          <p className="mt-1 text-sm text-zinc-700">
            Saldo: <strong>{formatMoney(order.amountBalanceArs)}</strong>
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-zinc-200 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Pedido
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-700">
            {order.items.map((item, index) => (
              <li className="flex items-center justify-between gap-3" key={`${item.flavor.slug}-${item.size.slug}-${index}`}>
                <span>
                  {item.quantity} x {item.flavor.name} {item.size.name}
                </span>
                <strong>{formatMoney(item.subtotalArs)}</strong>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </main>
  );
}
