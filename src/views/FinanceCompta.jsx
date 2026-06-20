import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calculator, BarChart2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export default function FinanceCompta() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*');

      if (error) throw new Error('DB tables missing');

      setTransactions(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions([
        { id: '1', type: 'vente', amount: 1250.00, date: '2026-06-18', status: 'confirmé' },
        { id: '2', type: 'vente', amount: 850.00, date: '2026-06-19', status: 'confirmé' },
        { id: '3', type: 'achat', amount: 600.00, date: '2026-06-10', status: 'confirmé' },
        { id: '4', type: 'charge', amount: 150.00, date: '2026-06-13', status: 'confirmé' },
        { id: '5', type: 'revenu', amount: 2500.00, date: '2026-06-19', status: 'confirmé' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute financial totals
  const totalRevenue = transactions
    .filter(t => (t.type === 'vente' || t.type === 'revenu') && t.status === 'confirmé')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter(t => (t.type === 'achat' || t.type === 'charge') && t.status === 'confirmé')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netProfit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Custom CSS Chart values (scale max out of total revenue)
  const maxVal = Math.max(totalRevenue, totalExpense, 1000);
  const revenueHeight = totalRevenue > 0 ? (totalRevenue / maxVal) * 100 : 0;
  const expenseHeight = totalExpense > 0 ? (totalExpense / maxVal) * 100 : 0;
  const profitHeight = netProfit > 0 ? (netProfit / maxVal) * 100 : 0;

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calculator size={24} style={{ color: 'var(--primary)' }} /> Finance & Comptabilité
        </h2>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Financial Metrics Cards */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Produits (Revenus)</span>
            <span className="kpi-value">{totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper danger">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Charges (Dépenses)</span>
            <span className="kpi-value">{totalExpense.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper info">
            <BarChart2 size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Résultat Net (Bénéfice)</span>
            <span className="kpi-value" style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {netProfit.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* visual representation chart */}
        <div className="glass-card">
          <h3 className="section-title" style={{ marginBottom: '24px' }}>Comparatif Financier Actuel</h3>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', height: '240px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)', margin: '20px 0' }}>
            
            {/* Revenue bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--success)' }}>
                {totalRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
              <div style={{ width: '100%', height: `${revenueHeight}px`, background: 'linear-gradient(to top, rgba(16, 185, 129, 0.2), var(--success))', borderRadius: '6px 6px 0 0', minHeight: '10px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }} />
              <div style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary)' }}>Revenus</div>
            </div>

            {/* Expense bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--danger)' }}>
                {totalExpense.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
              <div style={{ width: '100%', height: `${expenseHeight}px`, background: 'linear-gradient(to top, rgba(239, 68, 68, 0.2), var(--danger))', borderRadius: '6px 6px 0 0', minHeight: '10px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }} />
              <div style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary)' }}>Dépenses</div>
            </div>

            {/* Net profit bar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '60px' }}>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: 'var(--info)' }}>
                {netProfit.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
              </div>
              <div style={{ width: '100%', height: `${Math.max(profitHeight, 0)}px`, background: 'linear-gradient(to top, rgba(6, 182, 212, 0.2), var(--info))', borderRadius: '6px 6px 0 0', minHeight: '10px', boxShadow: '0 4px 12px rgba(6, 182, 212, 0.2)' }} />
              <div style={{ fontSize: '13px', marginTop: '8px', color: 'var(--text-secondary)' }}>Résultat</div>
            </div>

          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)', marginTop: '16px' }}>
            <span>Marge Bénéficiaire Globale:</span>
            <span style={{ fontWeight: '600', color: profitMargin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Ledger Overview (Compta) */}
        <div className="glass-card">
          <h3 className="section-title" style={{ marginBottom: '16px' }}>Plan Comptable Simplifié (TAP)</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
            Suivi des comptes généraux de l'entreprise selon les classes comptables standard.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Classe 5 - Trésorerie</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Comptes Banques (512) & Caisse (53)</div>
              </div>
              <div style={{ fontWeight: '600', color: 'var(--primary)' }}>{netProfit.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Classe 6 - Charges</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Achats matières (601) & Services (62)</div>
              </div>
              <div style={{ fontWeight: '600', color: 'var(--danger)' }}>{totalExpense.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Classe 7 - Produits</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Ventes de marchandises & Prestations (70)</div>
              </div>
              <div style={{ fontWeight: '600', color: 'var(--success)' }}>{totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
