import React from 'react';

export default function Forecast() {
  return (
    <div className="stock-page-container">
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Forecast
          </h1>
          <p className="catalog-subtitle">Prévisions et analyses prédictives.</p>
        </div>
      </div>
      
      <div className="glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '20px', backgroundColor: 'var(--bg-card)' }}>
        <p style={{ fontSize: '15px', fontWeight: '600' }}>Page vide - Module Forecast à venir</p>
      </div>
    </div>
  );
}
