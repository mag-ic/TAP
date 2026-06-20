import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ArrowUpDown, RefreshCw, Search, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function EntreesVentes() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('entrees'); // 'entrees' or 'ventes'
  const [searchTerm, setSearchTerm] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*, partners(name, type)')
        .order('date', { ascending: false });

      if (error) throw new Error('DB tables missing');

      setTransactions(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      const mockPartners = [
        { name: 'Jean Dupont', type: 'client' },
        { name: 'Marie Leroux', type: 'client' },
        { name: 'Industries Métal-Pro', type: 'fournisseur' },
        { name: 'ElectroComposants', type: 'fournisseur' }
      ];
      setTransactions([
        { id: '1', type: 'vente', amount: 1250.00, description: 'Facture F-2026-001 - Travaux électricité', date: '2026-06-18', partners: mockPartners[0], status: 'confirmé' },
        { id: '2', type: 'vente', amount: 850.00, description: 'Facture F-2026-002 - Dépannage plomberie', date: '2026-06-19', partners: mockPartners[1], status: 'confirmé' },
        { id: '3', type: 'achat', amount: 600.00, description: 'Achat de bobines de câble cuivre', date: '2026-06-10', partners: mockPartners[2], status: 'confirmé' },
        { id: '4', type: 'charge', amount: 150.00, description: 'Abonnement Télécom & Internet', date: '2026-06-13', partners: null, status: 'confirmé' },
        { id: '5', type: 'revenu', amount: 2500.00, description: 'Apport en capital / Remboursement TVA', date: '2026-06-19', partners: null, status: 'confirmé' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Filter based on subtab
  // 'entrees' corresponds to achats / stock purchases (charges count as outflows too)
  // 'ventes' corresponds to ventes / customer sales (revenus count as inflows too)
  const displayedTxs = transactions.filter(t => {
    if (activeSubTab === 'entrees') {
      return t.type === 'achat' || t.type === 'charge';
    } else {
      return t.type === 'vente' || t.type === 'revenu';
    }
  });

  const filteredTxs = displayedTxs.filter(t => {
    return t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (t.partners && t.partners.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Totals
  const sumAmount = filteredTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={24} style={{ color: 'var(--primary)' }} /> Entrées & Ventes
        </h2>
        <button className="btn btn-secondary" onClick={fetchTransactions}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="tab-switcher" style={{ marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${activeSubTab === 'entrees' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('entrees')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowDownCircle size={16} /> Entrées (Achats & Charges)
          </span>
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'ventes' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('ventes')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpCircle size={16} /> Ventes (Facturation Clients)
          </span>
        </button>
      </div>

      {/* Summary KPI */}
      <div className="kpi-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '300px', marginBottom: '24px' }}>
        <div className="glass-card kpi-card">
          <div className={`kpi-icon-wrapper ${activeSubTab === 'entrees' ? 'danger' : 'success'}`}>
            {activeSubTab === 'entrees' ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
          </div>
          <div className="kpi-info">
            <span className="kpi-label">{activeSubTab === 'entrees' ? 'Total Approvisionnements' : 'Total Facturé'}</span>
            <span className="kpi-value">{sumAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={activeSubTab === 'entrees' ? "Rechercher par achat, fournisseur..." : "Rechercher par vente, client..."}
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Partenaire</th>
                  <th>Mode Paiement</th>
                  <th>Catégorie</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                    <td style={{ fontWeight: '500' }}>{tx.description}</td>
                    <td>{tx.partners ? tx.partners.name : '-'}</td>
                    <td>{tx.payment_method}</td>
                    <td>
                      <span className={`badge ${tx.type}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600', color: activeSubTab === 'entrees' ? 'var(--danger)' : 'var(--success)' }}>
                      {activeSubTab === 'entrees' ? '-' : '+'} {Math.abs(tx.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td>
                      <span className={`badge ${tx.status}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucune transaction enregistrée sous cet onglet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
