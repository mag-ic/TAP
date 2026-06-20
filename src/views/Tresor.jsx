import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions, mockPartners, mockCheques } from '../lib/mockData';
import { Plus, Search, Wallet, TrendingUp, TrendingDown, RefreshCw, FileText } from 'lucide-react';

export default function Tresor() {
  const [activeSubTab, setActiveSubTab] = useState('transactions'); // 'transactions' or 'cheques'
  const [transactions, setTransactions] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('vente');
  const [partnerId, setPartnerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [status, setStatus] = useState('confirmé');

  const fetchTreasuryData = async () => {
    try {
      setLoading(true);
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('id, name, type');

      const { data: chequeData, error: chequeError } = await supabase
        .from('cheques')
        .select('*')
        .order('due_date', { ascending: false });

      if (txError || partnerError || chequeError) throw new Error('DB tables missing');

      setTransactions(txData || []);
      setPartners(partnerData || []);
      setCheques(chequeData || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions(mockTransactions);
      setPartners(mockPartners);
      setCheques(mockCheques);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newTx = {
      id: Math.random().toString(),
      description,
      amount: parseFloat(amount),
      type,
      partner_id: partnerId || null,
      partner_name: partners.find(p => p.id === partnerId)?.name || '',
      date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      status
    };

    if (usingMockData) {
      setTransactions([newTx, ...transactions]);
    } else {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchTreasuryData();
      }
    }

    // Reset Form
    setDescription('');
    setAmount('');
    setPartnerId('');
    setShowModal(false);
  };

  // Calculate totals
  const totalInflow = transactions
    .filter(t => (t.type === 'vente' || t.type === 'revenu') && t.status === 'confirmé')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalOutflow = transactions
    .filter(t => (t.type === 'achat' || t.type === 'charge') && t.status === 'confirmé')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const currentSolde = totalInflow - totalOutflow;

  // Filter list
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.partner_name && t.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredCheques = cheques.filter(c => {
    const matchesSearch = (c.partner_name && c.partner_name.toLowerCase().includes(searchTerm.toLowerCase())) || 
                          (c.bank && c.bank.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.number && c.number.includes(searchTerm)) ||
                          (c.reference && c.reference.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchesType = filterType === 'all' || c.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={24} style={{ color: 'var(--primary)' }} /> Trésorerie
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchTreasuryData}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nouvelle Transaction
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper primary">
            <Wallet size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Solde Trésorerie</span>
            <span className="kpi-value">{currentSolde.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Recettes</span>
            <span className="kpi-value">+{totalInflow.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper danger">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Décaissements</span>
            <span className="kpi-value">-{totalOutflow.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="tab-switcher" style={{ marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${activeSubTab === 'transactions' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('transactions'); setFilterStatus('all'); }}
        >
          Mouvements Financiers ({transactions.length})
        </button>
        <button 
          className={`tab-btn ${activeSubTab === 'cheques' ? 'active' : ''}`}
          onClick={() => { setActiveSubTab('cheques'); setFilterStatus('all'); }}
        >
          Gestion des Chèques ({cheques.length})
        </button>
      </div>

      {/* Search and Filters */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={activeSubTab === 'transactions' ? "Rechercher une transaction..." : "Rechercher par banque, n° chèque, client..."}
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="form-input" 
            style={{ width: '180px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">Tous les flux</option>
            {activeSubTab === 'transactions' ? (
              <>
                <option value="vente">Ventes</option>
                <option value="achat">Achats</option>
                <option value="charge">Charges</option>
                <option value="revenu">Revenus</option>
              </>
            ) : (
              <>
                <option value="IN">Reçus (IN)</option>
                <option value="OUT">Émis (OUT)</option>
              </>
            )}
          </select>

          {activeSubTab === 'cheques' && (
            <select 
              className="form-input" 
              style={{ width: '180px' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="recouvré">Encaissé</option>
              <option value="impayé">Impayé</option>
            </select>
          )}
        </div>
      </div>

      {/* List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : activeSubTab === 'transactions' ? (
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
                {filteredTransactions.map((tx) => (
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
                    <td style={{ fontWeight: '600', color: (tx.type === 'vente' || tx.type === 'revenu') ? 'var(--success)' : 'var(--danger)' }}>
                      {(tx.type === 'vente' || tx.type === 'revenu') ? '+' : '-'} {Math.abs(tx.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
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
        ) : (
          /* Cheques view */
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Réception</th>
                  <th>Banque</th>
                  <th>N° Chèque</th>
                  <th>Partenaire</th>
                  <th>Réf Facture</th>
                  <th>Échéance</th>
                  <th>Flux</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheques.map((chq) => {
                  const isOverdue = new Date(chq.due_date) < new Date() && chq.status !== 'recouvré';
                  return (
                    <tr key={chq.id}>
                      <td>{new Date(chq.received_date).toLocaleDateString('fr-FR')}</td>
                      <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{chq.bank}</td>
                      <td style={{ fontFamily: 'monospace' }}>{chq.number}</td>
                      <td>{chq.partner_name}</td>
                      <td>{chq.reference || '-'}</td>
                      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isOverdue ? '600' : '400' }}>
                        {new Date(chq.due_date).toLocaleDateString('fr-FR')}
                        {isOverdue && ' (Échue)'}
                      </td>
                      <td>
                        <span className={`badge ${chq.type === 'IN' ? 'client' : 'fournisseur'}`}>
                          {chq.type === 'IN' ? 'Reçu' : 'Émis'}
                        </span>
                      </td>
                      <td style={{ fontWeight: '600' }}>
                        {chq.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td>
                        <span className={`badge ${chq.status}`}>
                          {chq.status === 'recouvré' ? 'Encaissé' : 'Impayé'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredCheques.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucun chèque correspondant à vos filtres.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for new transaction */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Nouvelle Transaction</h3>
            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: Facture F-2026-003, Achat matériel..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Montant (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select 
                    className="form-input" 
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="vente">Vente (Entrée)</option>
                    <option value="revenu">Revenu Autre (Entrée)</option>
                    <option value="achat">Achat (Sortie)</option>
                    <option value="charge">Charge (Sortie)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Partenaire</label>
                <select 
                  className="form-input" 
                  value={partnerId} 
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  <option value="">Sélectionner un partenaire</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type === 'client' ? 'Client' : 'Fournisseur'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mode de Paiement</label>
                  <select 
                    className="form-input" 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Carte">Carte</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select 
                    className="form-input" 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="confirmé">Confirmé</option>
                    <option value="en_attente">En Attente</option>
                    <option value="annulé">Annulé</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
