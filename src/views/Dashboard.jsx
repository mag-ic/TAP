import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions, mockStock, mockSavTickets } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { 
  TrendingUp, 
  Wallet, 
  AlertTriangle, 
  Wrench, 
  Database,
  ArrowRight
} from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [metrics, setMetrics] = useState({
    sales: 0,
    treasury: 0,
    lowStock: 0,
    savTickets: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        
        // Try fetching from Supabase
        const { data: txs, error: txError } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false })
          .limit(5);

        const { data: stockItems, error: stockError } = await supabase
          .from('inventaire')
          .select('stock, minstock');

        const { data: savTickets, error: savError } = await supabase
          .from('sav_tickets')
          .select('status')
          .neq('status', 'résolu');

        if (txError || stockError || savError) {
          throw new Error('Supabase tables not found');
        }

        // Calculate metrics from database
        const salesTotal = txs
          .filter(t => t.type === 'vente' && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const incomeTotal = txs
          .filter(t => (t.type === 'vente' || t.type === 'revenu') && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const expenseTotal = txs
          .filter(t => (t.type === 'achat' || t.type === 'charge') && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const lowStockCount = stockItems.filter(item => item.stock <= (item.minstock !== undefined ? item.minstock : item.minStock)).length;

        setMetrics({
          sales: salesTotal,
          treasury: incomeTotal - expenseTotal,
          lowStock: lowStockCount,
          savTickets: savTickets.length
        });
        setRecentTransactions(txs || []);
        setUsingMockData(false);
      } catch (err) {
        // Fallback to real parsed business mock data
        setUsingMockData(true);
        
        // Calculate totals from mock data
        const salesTotal = mockTransactions
          .filter(t => t.type === 'vente' && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const incomeTotal = mockTransactions
          .filter(t => (t.type === 'vente' || t.type === 'revenu') && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const expenseTotal = mockTransactions
          .filter(t => (t.type === 'achat' || t.type === 'charge') && t.status === 'confirmé')
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const lowStockCount = mockStock.filter(item => item.stock <= item.minStock).length;
        const openSavTickets = mockSavTickets.filter(t => t.status !== 'résolu').length;

        setMetrics({
          sales: salesTotal,
          treasury: incomeTotal - expenseTotal,
          lowStock: lowStockCount,
          savTickets: openSavTickets
        });
        
        // Show first 5 recent transactions
        setRecentTransactions(mockTransactions.slice(0, 5));
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px', color: 'var(--text-secondary)' }}>Chargement du tableau de bord...</div>;
  }

  return (
    <div>
      {usingMockData && (
        <div className="alert-banner">
          <Database size={24} style={{ flexShrink: 0 }} />
          <div>
            <div className="alert-title">Mode Démo Activé (Données de simulation réelles issues de vos CSV)</div>
            <div className="alert-message">
              L'application affiche les données de vos fichiers CSV locaux. Pour connecter votre base de données en ligne, exécutez le script SQL <code>supabase_schema.sql</code> dans l'éditeur SQL de Supabase.
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card" onClick={() => setActiveTab('ventes')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Chiffre d'Affaires</span>
            <span className="kpi-value">{formatCurrency(metrics.sales)}</span>
          </div>
        </div>

        <div className="glass-card kpi-card" onClick={() => setActiveTab('tresor')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper primary">
            <Wallet size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Solde Trésorerie</span>
            <span className="kpi-value">{formatCurrency(metrics.treasury)}</span>
          </div>
        </div>

        <div className="glass-card kpi-card" onClick={() => setActiveTab('stock')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper warning">
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Alertes Stock</span>
            <span className="kpi-value">{metrics.lowStock} article{metrics.lowStock > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="glass-card kpi-card" onClick={() => setActiveTab('sav')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon-wrapper info">
            <Wrench size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tickets SAV Actifs</span>
            <span className="kpi-value">{metrics.savTickets} ticket{metrics.savTickets > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Recent Transactions Table */}
        <div className="glass-card">
          <div className="section-header">
            <h3 className="section-title">Derniers Mouvements Financiers</h3>
            <button className="btn btn-secondary btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setActiveTab('tresor')}>
              Tout voir <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Partenaire</th>
                  <th>Méthode</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ fontWeight: '500' }}>{tx.description}</td>
                    <td>{tx.partner_name || '-'}</td>
                    <td>{tx.payment_method || 'Chèque'}</td>
                    <td>
                      <span className={`badge ${tx.type}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600', color: (tx.type === 'vente' || tx.type === 'revenu' || tx.type === 'bl') ? 'var(--success)' : 'var(--danger)' }}>
                      {(tx.type === 'vente' || tx.type === 'revenu' || tx.type === 'bl') ? '+' : '-'} {formatCurrency(Math.abs(tx.amount))}
                    </td>
                    <td>
                      <span className={`badge ${tx.status}`}>
                        {tx.status === 'confirmé' ? 'payé' : (tx.status === 'en_attente' ? 'impayé' : tx.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Informational Panel */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="section-title" style={{ marginBottom: '16px' }}>TAP Manager</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              Base de données chargée avec succès à partir de vos fichiers d'inventaire, de contacts clients, de facturation et de SAV.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '16px' }}>
              L'application s'adapte automatiquement aux structures de votre entreprise (chiffres d'affaires réels, suivi des chèques et de la trésorerie).
            </p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Base de Données</div>
            <div style={{ fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: usingMockData ? 'var(--warning)' : 'var(--success)' }} />
              <span>{usingMockData ? 'Connecté (Données Locales)' : 'Connecté à Supabase'}</span>
              {usingMockData && (
                <button 
                  onClick={() => {
                    if (window.confirm("Voulez-vous vraiment réinitialiser toutes les données locales à leur état d'origine ? Toutes vos modifications locales seront perdues.")) {
                      import('../lib/mockData').then(m => m.resetLocalDatabase());
                    }
                  }}
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(244, 63, 94, 0.12)',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    color: '#f43f5e',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
