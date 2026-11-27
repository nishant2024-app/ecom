import type { SlipOrder } from '../pages/Orders';
import QRCode from 'qrcode';
import { rupees } from './format';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Open a print-ready window: one A5-ish slip per order, with a pick list and address label. */
export async function printPackingSlips(orders: SlipOrder[]) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return alert('Allow pop-ups for this site to print packing slips.');
  // QR codes the delivery partner scans to open turn-by-turn directions to the pinned door.
  const qr = new Map<string, string>();
  for (const o of orders) {
    const loc = o.shippingAddress.location;
    if (loc) qr.set(o.number, await QRCode.toDataURL(loc.directionsUrl, { margin: 0, width: 220, errorCorrectionLevel: 'M' }));
  }
  const slips = orders
    .map((o) => {
      const a = o.shippingAddress;
      return `<section class="slip">
  <header><div><b>Mulshi Dairy</b><br><small>Packing slip</small></div><div class="num big">${esc(o.number)}</div></header>
  <div class="cols">
    <div class="to"><small>Ship to</small><p><b>${esc(a.name)}</b><br>${esc(a.line1)}${a.line2 ? `<br>${esc(a.line2)}` : ''}${a.landmark ? `<br>Near ${esc(a.landmark)}` : ''}<br>${esc(a.city)}, ${esc(a.state)} <b class="num">${esc(a.pincode)}</b><br><span class="num">${esc(a.phone)}</span></p></div>
    <div><small>Placed</small><p class="num">${esc(new Date(o.placedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }))}</p>${qr.has(o.number) ? `<div class="qr"><img src="${qr.get(o.number)}" alt=""><small>Scan for directions</small></div>` : ''}<small>Zone</small><p>${esc(o.delivery.zone)} · ${o.delivery.etaMinDays}–${o.delivery.etaMaxDays} days</p><small>Paid online</small><p class="num">${esc(rupees(o.total.amount))}</p></div>
  </div>
  <table><thead><tr><th>✓</th><th>Item</th><th>SKU</th><th class="r">Qty</th></tr></thead><tbody>
  ${o.items.map((i) => `<tr><td class="box"></td><td>${esc(i.name)} <small>${esc(i.packSize)}</small></td><td class="num">${esc(i.sku)}</td><td class="r num big">${i.quantity}</td></tr>`).join('')}
  </tbody></table>
  ${o.note ? `<p class="note"><small>Customer note</small><br>${esc(o.note)}</p>` : ''}
  <footer>Pick oldest batch first (FEFO). Check seals and expiry dates before packing. Packed by: ____________</footer>
</section>`;
    })
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Packing slips (${orders.length})</title><style>
  @page { size: A5; margin: 10mm; }
  * { box-sizing: border-box; } body { font: 12px/1.45 system-ui, sans-serif; color: #111; margin: 0; }
  .slip { page-break-after: always; padding: 4mm 0; } .slip:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 6px; }
  .num { font-variant-numeric: tabular-nums; font-family: ui-monospace, monospace; } .big { font-size: 18px; font-weight: 700; }
  .cols { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; margin: 10px 0; } .to p { font-size: 14px; }
  small { color: #555; text-transform: uppercase; letter-spacing: .06em; font-size: 9px; } p { margin: 2px 0 8px; }
  table { width: 100%; border-collapse: collapse; } th, td { border-bottom: 1px solid #bbb; padding: 6px 4px; text-align: left; } .r { text-align: right; }
  .box { width: 18px; } .box::before { content: ''; display: inline-block; width: 12px; height: 12px; border: 1.5px solid #111; }
  .qr { float: right; text-align: center; margin: 0 0 6px 8px; } .qr img { width: 26mm; height: 26mm; display: block; }
  .note { border: 1px dashed #999; padding: 6px; margin-top: 8px; } footer { margin-top: 12px; font-size: 10px; color: #444; }
  </style></head><body>${slips}<script>window.onload = () => { window.print(); }</script></body></html>`);
  w.document.close();
}
