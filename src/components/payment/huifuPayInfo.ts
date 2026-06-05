export function extractHuifuPayTarget(payInfo: unknown): string {
  if (!payInfo) return '';
  if (typeof payInfo === 'string') return payInfo.trim();
  if (typeof payInfo !== 'object') return '';

  const value = payInfo as Record<string, unknown>;
  const directValue =
    value.qr_code ??
    value.qrcode ??
    value.qrCode ??
    value.code_url ??
    value.codeUrl ??
    value.pay_url ??
    value.payUrl ??
    value.url ??
    value.paymentUrl;

  return typeof directValue === 'string' ? directValue.trim() : '';
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
