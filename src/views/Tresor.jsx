import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Search, Wallet, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

export default function Tresor() {
  const [transactions, setTransactions] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('vente');
  const [partnerId, setPartnerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [status, setStatus] = useState('confirmé');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*, partners(name, type)')
        .order('date', { ascending: false });

      const { data: partnerData, error: partnerError } = await supabase
        .from('partners')
        .select('id, name, type');

      if (txError || partnerError) throw new Error('DB tables missing');

      setTransactions(txData || []);
      setPartners(partnerData || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      // Mock partners
      const mockPartners = [
        { id: 'p1', name: 'Jean Dupont', type: 'client' },
        { id: 'p2', name: 'Marie Leroux', type: 'client' },
        { id: 'p3', name: 'Industries Métal-Pro', type: 'fournisseur' },
        { id: 'p4', name: 'ElectroComposants', type: 'fournisseur' }
      ];
      setPartners(mockPartners);

      // Mock transactions
      setTransactions([
        { id: '1', type: 'vente', amount: 1250.00, description: 'Facture F-2026-001 - Travaux électricité', date: '2026-06-18', partner_id: 'p1', partners: mockPartners[0], payment_method: 'Virement', status: 'confirmé' },
        { id: '2', type: 'vente', amount: 850.00, description: 'Facture F-2026-002 - Dépannage plomberie', date: '2026-06-19', partner_id: 'p2', partners: mockPartners[1], payment_method: 'Carte', status: 'confirmé' },
        { id: '3', type: 'achat', amount: 600.00, description: 'Achat de bobines de câble cuivre', date: '2026-06-10', partner_id: 'p3', partners: mockPartners[2], payment_method: 'Virement', status: 'confirmé' },
        { id: '4', type: 'charge', amount: 150.00, description: 'Abonnement Télécom & Internet', date: '2026-06-13', partner_id: '', partners: null, payment_method: 'Espèces', status: 'confirmé' },
        { id: '5', type: 'revenu', amount: 2500.00, description: 'Apport en capital / Remboursement TVA', date: '2026-06-19', partner_id: '', partners: null, payment_method: 'Virement', status: 'confirmé' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newTx = {
      description,
      amount: parseFloat(amount),
      type,
      partner_id: partnerId || null,
      date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      status
    };

    if (usingMockData) {
      const selectedPartner = partners.find(p => p.id === partnerId);
      const mockNewTx = {
        ...newTx,
        id: Math.random().toString(),
        partners: selectedPartner || null
      };
      setTransactions([mockNewTx, ...transactions]);
    } else {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchTransactions();
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
                          (t.partners && t.partners.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={24} style={{ color: 'var(--primary)' }} /> Trésorerie
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchTransactions}>
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
            <span className="kpi-label">Solde Actuel</span>
            <span className="kpi-value">{currentSolde.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Entrées</span>
            <span className="kpi-value">+{totalInflow.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper danger">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Sorties</span>
            <span className="kpi-value">-{totalOutflow.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher une transaction..."
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
            <option value="all">Tous les types</option>
            <option value="vente">Vente</option>
            <option value="achat">Achat</option>
            <option value="charge">Charge</option>
            <option value="revenu">Revenu</option>
          </select>
        </div>
      </div>

      {/* Transactions List */}
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
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                    <td>{tx.description}</td>
                    <td>{tx.partners ? tx.partners.name : '-'}</td>
                    <td>{tx.payment_method}</td>
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
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucune transaction trouvée.
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
                <label className="form-label">Partenaire (Optionnel)</label>
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
                    <option value="Virement">Virement</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Carte">Carte</option>
                    <option value="Chèque">Chèque</option>
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
