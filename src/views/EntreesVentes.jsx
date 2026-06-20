import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions } from '../lib/mockData';
import { ArrowUpDown, RefreshCw, Search, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function EntreesVentes() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('entrees'); // 'entrees' or 'ventes'
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw new Error('DB tables missing');

      setTransactions(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions(mockTransactions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Filter based on subtab
  const displayedTxs = transactions.filter(t => {
    if (activeSubTab === 'entrees') {
      return t.type === 'achat' || t.type === 'charge';
    } else {
      return t.type === 'vente' || t.type === 'revenu';
    }
  });

  const filteredTxs = displayedTxs.filter(t => {
    return t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
           (t.partner_name && t.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Totals
  const sumAmount = filteredTxs.reduce((sum, t) => sum + Number(t.amount), 0);

  // Helper to parse JSON items safely
  const parseItems = (itemsStr) => {
    if (!itemsStr) return [];
    try {
      if (typeof itemsStr === 'object') return itemsStr;
      return JSON.parse(itemsStr);
    } catch (e) {
      return [];
    }
  };

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
          onClick={() => { setActiveSubTab('entrees'); setExpandedRows({}); }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowDownCircle size={16} /> Entrées Stock (Achats)
          </span>
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'ventes' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('ventes'); setExpandedRows({}); }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowUpCircle size={16} /> Ventes & Factures
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
            <span className="kpi-label">{activeSubTab === 'entrees' ? 'Total Approvisionnements' : 'Total Factures Clients'}</span>
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
                  <th style={{ width: '40px' }}></th>
                  <th>Date</th>
                  <th>Numéro / Réf</th>
                  <th>Partenaire</th>
                  <th>Montant Global</th>
                  <th>Méthode</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const itemsList = parseItems(tx.items);
                  const isExpanded = expandedRows[tx.id];
                  return (
                    <React.Fragment key={tx.id}>
                      <tr style={{ cursor: 'pointer' }} onClick={() => toggleRow(tx.id)}>
                        <td>
                          {itemsList.length > 0 ? (
                            isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
                          ) : null}
                        </td>
                        <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ fontWeight: '600' }}>{tx.description}</td>
                        <td>{tx.partner_name || '-'}</td>
                        <td style={{ fontWeight: '600', color: activeSubTab === 'entrees' ? 'var(--danger)' : 'var(--success)' }}>
                          {activeSubTab === 'entrees' ? '-' : '+'} {Math.abs(tx.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </td>
                        <td>{tx.payment_method || 'Chèque'}</td>
                        <td>
                          <span className={`badge ${tx.status}`}>
                            {tx.status === 'confirmé' ? 'payé' : (tx.status === 'en_attente' ? 'partiel / impayé' : tx.status)}
                          </span>
                        </td>
                      </tr>
                      {/* Expanded details row */}
                      {isExpanded && itemsList.length > 0 && (
                        <tr>
                          <td colSpan="7" style={{ padding: '0 16px 16px 56px', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                            <div style={{ padding: '12px', borderLeft: '3px solid var(--primary)', background: 'rgba(255,255,255,0.01)', borderRadius: '0 8px 8px 0' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', letterSpacing: '0.5px' }}>Détail des Articles :</div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: '6px 0' }}>SKU</th>
                                    <th>Désignation</th>
                                    <th>Quantité</th>
                                    <th>Prix Unitaire HT</th>
                                    <th style={{ textAlign: 'right' }}>Total HT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemsList.map((item, idx) => {
                                    const qty = item.quantity || 0;
                                    const price = item.unitPriceHT || item.costPrice || 0;
                                    const total = qty * price;
                                    return (
                                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}>
                                        <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>{item.sku}</td>
                                        <td style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{item.productName}</td>
                                        <td>{qty}</td>
                                        <td>{Number(price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-primary)' }}>{total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredTxs.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucun enregistrement trouvé.
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
