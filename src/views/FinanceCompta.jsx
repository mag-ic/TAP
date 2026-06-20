import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions, mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, RefreshCw, Download, Pencil, Clock, FileText, X, RotateCcw, Calendar, User, Info } from 'lucide-react';

export default function FinanceCompta() {
  const [transactions, setTransactions] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('factures'); // 'factures' | 'achats' | 'charges' | 'apports'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResponsable, setFilterResponsable] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (txError) throw new Error('DB tables missing');

      const { data: chqData } = await supabase.from('cheques').select('*');

      setTransactions(txData || []);
      setCheques(chqData || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions(mockTransactions);
      setCheques(mockCheques);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to extract BC/AR reference from description
  const getBCReference = (description) => {
    if (!description) return 'INV-26-XXXX';
    const match = description.match(/(BC-\d+-\d+|BC\d+|AR-\d+-\d+|AR\d+|INV-\d+-\d+)/);
    return match ? match[0] : (description.replace('Entrée ', '').replace('Facture ', '').split(' - ')[0] || description);
  };

  // Helper to compute total, regle, and reste for a transaction
  const getTxMetrics = (tx) => {
    const amount = Number(tx.amount || 0);
    
    if (tx.status === 'confirmé') {
      return { total: amount, regle: amount, reste: 0 };
    }
    if (tx.status === 'annulé') {
      return { total: amount, regle: 0, reste: amount };
    }
    
    const ref = getBCReference(tx.description);
    const txCheques = cheques.filter(c => c.reference === ref || tx.description.includes(c.reference));
    const regleCheques = txCheques.filter(c => c.status === 'recouvré').reduce((acc, c) => acc + (c.amount || 0), 0);
    
    const regle = regleCheques > 0 ? regleCheques : 0;
    const reste = Math.max(0, amount - regle);
    
    return { total: amount, regle, reste };
  };

  // Filter transactions based on active tab
  const displayedTxs = transactions.filter(t => {
    if (activeSubTab === 'factures') {
      return t.type === 'vente' || t.type === 'revenu';
    } else if (activeSubTab === 'achats') {
      return t.type === 'achat';
    } else if (activeSubTab === 'charges') {
      return t.type === 'charge' && !t.description?.toLowerCase().includes('avance');
    } else {
      // apports / deposits
      return t.type === 'depot' || t.type === 'apport';
    }
  });

  // Filter based on search bar and filters
  const filteredTxs = displayedTxs.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.partner_name && t.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesResponsable = true;
    if (filterResponsable !== 'all') {
      // In this demo, since there is no responsable column, we default to all or mock matches
      matchesResponsable = filterResponsable === '---';
    }

    let matchesStatut = true;
    if (filterStatut !== 'all') {
      const { regle, total } = getTxMetrics(t);
      if (filterStatut === 'payé') {
        matchesStatut = t.status === 'confirmé' || (total > 0 && regle === total);
      } else if (filterStatut === 'partiel') {
        matchesStatut = t.status === 'en_attente' && regle > 0 && regle < total;
      } else if (filterStatut === 'impayé') {
        matchesStatut = t.status === 'en_attente' && regle === 0;
      } else if (filterStatut === 'annulé') {
        matchesStatut = t.status === 'annulé';
      }
    }

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && t.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && t.date <= endDate;
    }

    return matchesSearch && matchesResponsable && matchesStatut && matchesDate;
  });

  // Totals calculations
  const totalAmount = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).total, 0);
  const totalRegle = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).regle, 0);
  const totalReste = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).reste, 0);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterResponsable('all');
    setFilterStatut('all');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ["Référence / Libellé", "Date", "Tiers / Partenaire", "Responsable", "Statut", "Montant Global (DH)", "Réglé (DH)", "Reste (DH)"];
    
    const rows = filteredTxs.map(t => {
      const { total, regle, reste } = getTxMetrics(t);
      let statusStr = t.status === 'confirmé' ? 'Payé' : (t.status === 'annulé' ? 'Annulé' : (regle > 0 ? 'Partiel' : 'Impayé'));
      return [
        getBCReference(t.description),
        t.date,
        t.partner_name || 'N/A',
        '---',
        statusStr,
        total.toFixed(2),
        regle.toFixed(2),
        reste.toFixed(2)
      ];
    });

    const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `finance_${activeSubTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEditClick = (tx, e) => {
    e.stopPropagation();
    setEditingTx(tx);
    setEditStatus(tx.status || 'confirmé');
    setEditDescription(tx.description || '');
    setEditAmount(tx.amount?.toString() || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;

    const amount = parseFloat(editAmount);

    if (usingMockData) {
      setTransactions(transactions.map(t => t.id === editingTx.id ? { ...t, status: editStatus, description: editDescription, amount } : t));
      alert("Transaction modifiée avec succès (Mode Démo) !");
    } else {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: editStatus,
          description: editDescription,
          amount
        })
        .eq('id', editingTx.id);

      if (error) {
        alert("Erreur lors de la modification : " + error.message);
      } else {
        fetchData();
        alert("Transaction modifiée avec succès !");
      }
    }

    setShowEditModal(false);
    setEditingTx(null);
  };

  return (
    <div className="stock-page-container">
      {/* Header matching image */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1>Finance & Trésorerie</h1>
          <p className="catalog-subtitle">Gestion des flux financiers basés sur les règlements réels.</p>
        </div>
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>

          {/* Red-accented active switcher matching image */}
          <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'inline-flex' }}>
            {['factures', 'achats', 'charges', 'apports'].map((tab) => (
              <button 
                key={tab}
                className={`tab-btn ${activeSubTab === tab ? 'active' : ''}`}
                style={{ 
                  textTransform: 'uppercase', 
                  fontSize: '11px', 
                  letterSpacing: '0.5px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: activeSubTab === tab ? '#ffffff' : 'transparent',
                  color: activeSubTab === tab ? '#ef4444' : '#64748b',
                  boxShadow: activeSubTab === tab ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
                onClick={() => setActiveSubTab(tab)}
              >
                {tab === 'factures' ? 'Factures' : tab === 'achats' ? 'Achats' : tab === 'charges' ? 'Charges' : 'Apports'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar in white rounded card matching image */}
      <div className="catalog-filter-bar" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end', height: 'auto', padding: '16px' }}>
        {/* Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>RECHERCHE</span>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={16} className="search-icon" style={{ color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Tiers, Référence..."
              className="form-input search-input-catalog"
              style={{ height: '38px', paddingLeft: '38px', borderRadius: '10px', fontSize: '12px', border: '1px solid #cbd5e1' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Responsable */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>RESPONSABLE</span>
          <select
            className="select-category-catalog"
            style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid #cbd5e1', width: '100%', minWidth: 'unset' }}
            value={filterResponsable}
            onChange={(e) => setFilterResponsable(e.target.value)}
          >
            <option value="all">TOUS</option>
            <option value="---">---</option>
          </select>
        </div>

        {/* Statuts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>STATUTS</span>
          <select
            className="select-category-catalog"
            style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid #cbd5e1', width: '100%', minWidth: 'unset' }}
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
          >
            <option value="all">TOUS</option>
            <option value="payé">PAYÉ</option>
            <option value="partiel">PARTIEL</option>
            <option value="impayé">IMPAYÉ</option>
            <option value="annulé">ANNULÉ</option>
          </select>
        </div>

        {/* Date start */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>DU</span>
          <input
            type="date"
            className="form-input"
            style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid #cbd5e1' }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        {/* Date end */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>AU</span>
          <input
            type="date"
            className="form-input"
            style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid #cbd5e1' }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Reset filter button */}
        <button 
          onClick={handleResetFilters}
          className="btn btn-white"
          style={{ height: '38px', width: '38px', padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Réinitialiser les filtres"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* KPI Cards Grid matching image */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Card 1: Total Montant */}
        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.01)', padding: '24px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL MONTANT</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '12px' }}>
            {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
          </div>
        </div>

        {/* Card 2: Total Régle (Light green bg) */}
        <div className="glass-card" style={{ backgroundColor: '#ecfdf5', borderRadius: '24px', border: '1px solid #a7f3d0', boxShadow: '0 4px 18px rgba(16, 185, 129, 0.02)', padding: '24px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL RÉGLÉ</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#10b981', marginTop: '12px' }}>
            {totalRegle.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
          </div>
        </div>

        {/* Card 3: Total Reste (Light pink bg) */}
        <div className="glass-card" style={{ backgroundColor: '#fdf2f2', borderRadius: '24px', border: '1px solid #fecaca', boxShadow: '0 4px 18px rgba(239, 68, 68, 0.02)', padding: '24px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL RESTE</span>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#ef4444', marginTop: '12px' }}>
            {totalReste.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
          </div>
        </div>
      </div>

      {/* History table matching image */}
      <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>
            Chargement des transactions...
          </div>
        ) : filteredTxs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '500', fontStyle: 'italic' }}>
            Aucune transaction trouvée.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>RÉFÉRENCE / LIBELLÉ</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>DATE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>TIERS</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>RESPONSABLE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>STATUT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>MONTANT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>RESTE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxs.map((tx) => {
                  const { total, regle, reste } = getTxMetrics(tx);
                  
                  // Color codes for status badge
                  let statusText = 'IMPAYÉ';
                  let statusColor = '#ef4444';
                  let statusBg = '#fdf2f2';

                  if (tx.status === 'confirmé' || regle === total) {
                    statusText = 'PAYÉ';
                    statusColor = '#10b981';
                    statusBg = '#ecfdf5';
                  } else if (tx.status === 'annulé') {
                    statusText = 'ANNULÉ';
                    statusColor = '#64748b';
                    statusBg = '#f1f5f9';
                  } else if (regle > 0 && regle < total) {
                    statusText = 'PARTIEL';
                    statusColor = '#f59e0b';
                    statusBg = '#fffbeb';
                  }

                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      {/* Ref */}
                      <td style={{ padding: '20px 16px', fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                        {getBCReference(tx.description)}
                      </td>
                      
                      {/* Date */}
                      <td style={{ padding: '20px 16px', color: '#475569', fontWeight: '600' }}>
                        {tx.date}
                      </td>

                      {/* Tiers Badge */}
                      <td style={{ padding: '20px 16px' }}>
                        <span style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase' }}>
                          {tx.partner_name || 'N/A'}
                        </span>
                      </td>

                      {/* Responsable */}
                      <td style={{ padding: '20px 16px', color: '#475569', fontWeight: '600' }}>
                        ---
                      </td>

                      {/* Status */}
                      <td style={{ padding: '20px 16px' }}>
                        <span style={{ 
                          color: statusColor, 
                          backgroundColor: statusBg, 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          padding: '4px 10px', 
                          borderRadius: '6px', 
                          letterSpacing: '0.5px' 
                        }}>
                          {statusText}
                        </span>
                      </td>

                      {/* Montant */}
                      <td style={{ padding: '20px 16px', fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>
                        {formatCurrency(total)}
                      </td>

                      {/* Reste */}
                      <td style={{ padding: '20px 16px', fontWeight: '800', color: reste > 0 ? '#ef4444' : '#10b981', fontSize: '15px' }}>
                        {formatCurrency(reste)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '12px', color: '#cbd5e1' }}>
                          <button 
                            className="action-icon-btn" 
                            style={{ color: '#cbd5e1', cursor: 'pointer' }}
                            onClick={(e) => handleEditClick(tx, e)} 
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            className="action-icon-btn" 
                            style={{ color: '#cbd5e1', cursor: 'pointer' }}
                            onClick={() => alert("Historique du règlement pour " + getBCReference(tx.description))} 
                            title="Historique"
                          >
                            <Clock size={16} />
                          </button>
                          <button 
                            className="action-icon-btn" 
                            style={{ color: '#cbd5e1', cursor: 'pointer' }}
                            onClick={() => alert("Impression du reçu comptable pour " + getBCReference(tx.description))} 
                            title="PDF Justificatif"
                          >
                            <FileText size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {showEditModal && editingTx && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Modifier la Transaction</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Référence / Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Montant Global (DH)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select 
                    className="form-input" 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="confirmé">Payé (Confirmé)</option>
                    <option value="en_attente">Partiel / Impayé (En attente)</option>
                    <option value="annulé">Annulé</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-blue-action">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
