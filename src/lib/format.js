/**
 * Formats a number as Moroccan Dirhams (MAD / DH)
 * Example: 12500 -> "12 500,00 DH"
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0,00 DH';
  }
  
  // Format with french locale spacing: 12 500,00
  const formattedNumber = Number(amount).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return `${formattedNumber} DH`;
}
