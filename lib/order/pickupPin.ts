/** Match Flutter pickup_info_dialog: 1000–9999 */
export function generatePickupPin(): string {
  const n = 1000 + Math.floor(Math.random() * 9000);
  return String(n);
}
