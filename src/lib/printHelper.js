export function printDocument({ type, reference, date, clientName, clientICE, clientIF, items, paidAmount, paymentMethod, isPaidAmountOnly }) {
  const formattedDate = date || new Date().toISOString().split('T')[0];
  const docType = type || 'FACTURE'; // 'FACTURE' or 'BON DE LIVRAISON'
  const docRef = reference || 'INV-26-XXXX';
  const isPurchase = docType.toUpperCase().includes('ARRIVAGE') || docType.toUpperCase().includes('RÉCEPTION') || docType.toUpperCase().includes('ACHAT');
  const partnerLabel = isPurchase ? 'FOURNISSEUR' : 'CLIENT';

  const parsedItems = items || [];

  function formatNumber(num) {
    return Number(num).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const isPaidOnly = (isPaidAmountOnly || paidAmount !== undefined) && paidAmount !== null && Number(paidAmount) > 0;
  let totalTTC = 0;
  let itemsRows = '';

  if (isPaidOnly && parsedItems.length === 0) {
    totalTTC = Number(paidAmount);
    itemsRows = `
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; font-weight: 500;">
          Règlement Facture / Acompte ${paymentMethod ? `- ${paymentMethod}` : ''} (Réf: ${docRef})
        </td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; font-weight: 500; width: 80px;">
          1
        </td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 500; width: 120px;">
          ${formatNumber(totalTTC)}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 600; width: 140px;">
          ${formatNumber(totalTTC)}
        </td>
      </tr>
    `;
  } else if (isPaidOnly && parsedItems.length > 0) {
    let origTotal = 0;
    parsedItems.forEach(item => {
      const qty = Number(item.quantity || 0);
      const priceTTC = Number(item.priceTTC || item.unitPriceTTC || (item.unitPriceHT * 1.2) || item.costPrice * 1.2 || 0);
      origTotal += qty * priceTTC;
    });

    const ratio = origTotal > 0 ? Number(paidAmount) / origTotal : 1;
    totalTTC = Number(paidAmount);

    itemsRows = parsedItems.map(item => {
      const qty = Number(item.quantity || 0);
      const origPriceTTC = Number(item.priceTTC || item.unitPriceTTC || (item.unitPriceHT * 1.2) || item.costPrice * 1.2 || 0);
      const scaledPriceTTC = origPriceTTC * ratio;
      const totalItemTTC = qty * scaledPriceTTC;

      return `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; font-weight: 500;">
            ${item.productName || item.designation || 'Article'} (Montant réglé)
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; font-weight: 500; width: 80px;">
            ${qty}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 500; width: 120px;">
            ${formatNumber(scaledPriceTTC)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 600; width: 140px;">
            ${formatNumber(totalItemTTC)}
          </td>
        </tr>
      `;
    }).join('');
  } else {
    itemsRows = parsedItems.map(item => {
      const qty = Number(item.quantity || 0);
      const priceTTC = Number(item.priceTTC || item.unitPriceTTC || (item.unitPriceHT * 1.2) || item.costPrice * 1.2 || 0);
      const totalItemTTC = qty * priceTTC;
      totalTTC += totalItemTTC;

      return `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; font-size: 13px; font-weight: 500;">
            ${item.productName || item.designation || 'Article'}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; font-size: 13px; font-weight: 500; width: 80px;">
            ${qty}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 500; width: 120px;">
            ${formatNumber(priceTTC)}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: right; font-size: 13px; font-weight: 600; width: 140px;">
            ${formatNumber(totalItemTTC)}
          </td>
        </tr>
      `;
    }).join('');
  }

  const totalHT = totalTTC / 1.2;
  const totalTVA = totalTTC - totalHT;

  // Generate HTML for print
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Veuillez autoriser les fenêtres pop-up pour imprimer le document.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${docType} - ${docRef}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .container {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            justify-content: space-between;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
          }
          .logo-area {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-box {
            width: 44px;
            height: 44px;
            background-color: #2563eb;
            color: white;
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            letter-spacing: 0.5px;
          }
          .company-name {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.3px;
          }
          .company-details {
            font-size: 10px;
            color: #64748b;
            margin-top: 4px;
            font-weight: 500;
          }
          .doc-info {
            text-align: right;
          }
          .doc-title {
            font-size: 22px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
            letter-spacing: 0.5px;
          }
          .doc-meta {
            font-size: 12px;
            color: #334155;
            margin-top: 8px;
            font-weight: 500;
            line-height: 1.6;
          }
          .doc-meta span {
            font-weight: 700;
          }
          .client-section {
            margin-top: 35px;
            font-size: 13px;
          }
          .client-title {
            font-size: 11px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .client-name {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin: 0;
          }
          .client-details {
            font-size: 12px;
            color: #334155;
            margin-top: 6px;
            line-height: 1.6;
            font-weight: 500;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 35px;
          }
          .items-table th {
            background-color: #3b82f6;
            color: white;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 10px 12px;
            border: 1px solid #3b82f6;
          }
          .totals-table {
            margin-top: 25px;
            float: right;
            width: 280px;
            border-collapse: collapse;
          }
          .totals-table td {
            padding: 6px 12px;
            font-size: 13px;
          }
          .totals-label {
            font-weight: 700;
            color: #475569;
            text-align: right;
          }
          .totals-value {
            font-weight: 800;
            color: #0f172a;
            text-align: right;
            width: 120px;
          }
          .totals-ttc {
            color: #2563eb !important;
            font-size: 16px !important;
          }
          .stamp-container {
            margin: auto 0;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 0;
          }
          .stamp-box {
            border: 2px dashed #1d4ed8;
            border-radius: 12px;
            padding: 16px 24px;
            color: #1d4ed8;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            font-weight: 700;
            text-align: center;
            line-height: 1.5;
            transform: rotate(-3deg);
            opacity: 0.85;
            background-color: rgba(239, 246, 255, 0.4);
          }
          .stamp-title {
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
          }
          .footer {
            margin-top: auto;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            line-height: 1.6;
            font-weight: 500;
          }
          .footer-top {
            font-weight: 700;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div>
            <!-- Header Section -->
            <div class="header">
              <div class="logo-area">
                <div class="logo-box">TP</div>
                <div>
                  <h1 class="company-name">TRADING PARTNERSHIPS S.A.R.L</h1>
                  <div class="company-details">
                    ICE : 003338833000011 - RC : 591271 - IF : 53894480
                  </div>
                </div>
              </div>
              <div class="doc-info">
                <h2 class="doc-title">${docType}</h2>
                <div class="doc-meta">
                  N°: <span>${docRef}</span><br />
                  Date: <span>${formattedDate}</span><br />
                  Ville: <span>CASABLANCA</span>
                </div>
              </div>
            </div>

            <!-- Client Section -->
            <div class="client-section">
              <div class="client-title">${partnerLabel} :</div>
              <div class="client-name">${clientName}</div>
              <div class="client-details">
                ${clientICE ? `ICE: ${clientICE}<br />` : ''}
                ${clientIF ? `IF: ${clientIF}` : ''}
              </div>
            </div>

            ${isPaidOnly ? `
            <div style="margin-top: 15px; padding: 10px 14px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 12px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span>✅ FACTURE ÉMISE POUR MONTANT RÉGLÉ</span>
                ${paymentMethod ? `<div style="font-size: 11px; color: #15803d; margin-top: 2px; font-weight: 600;">Mode / Réf : ${paymentMethod}</div>` : ''}
              </div>
              <div style="font-size: 14px; font-weight: 800;">
                ${formatNumber(totalTTC)} DH TTC
              </div>
            </div>
            ` : ''}

            <!-- Items Table -->
            <table class="items-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Produit</th>
                  <th style="text-align: center; width: 80px;">Qté</th>
                  <th style="text-align: right; width: 120px;">P.U. TTC</th>
                  <th style="text-align: right; width: 140px;">Total TTC</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Totals Section -->
            <table class="totals-table">
              <tr>
                <td class="totals-label">TOTAL HT :</td>
                <td class="totals-value">${formatNumber(totalHT)} DH</td>
              </tr>
              <tr>
                <td class="totals-label">TVA (20%) :</td>
                <td class="totals-value">${formatNumber(totalTVA)} DH</td>
              </tr>
              <tr style="border-top: 1px solid #cbd5e1;">
                <td class="totals-label totals-ttc" style="padding-top: 10px;">TOTAL TTC :</td>
                <td class="totals-value totals-ttc" style="padding-top: 10px;">${formatNumber(totalTTC)} DH</td>
              </tr>
            </table>
          </div>

          <!-- Stamp Section -->
          <div class="stamp-container">
            <div class="stamp-box">
              <div class="stamp-title">TRADING PARTNERSHIPS S.A.R.L</div>
              ICE: 003338833000011<br />
              IF: 53894480<br />
              Tél: 06 79 41 48 46
            </div>
          </div>

          <!-- Footer Section -->
          <div class="footer">
            <div class="footer-top">
              TRADING PARTNERSHIPS S.A.R.L - ICE : 003338833000011 - RC : 591271 - PATENTE : 34105287 - IF : 53894480 - CNSS : 4930787
            </div>
            <div>
              ANGL RUE PRINCE MY ABDELLAH ET RUE NAKHLA IMM 1 ETG 4 APPT 7 20000 / CASABLANCA
            </div>
            <div>
              Tel : 06 79 41 48 46 - E-mail : contact@sivirappliances.com
            </div>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
