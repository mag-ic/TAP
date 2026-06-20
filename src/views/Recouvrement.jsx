import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CreditCard, Search, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

export default function Recouvrement() {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('debts')
        .select('*, partners(name, phone, email)')
        .order('due_date', { ascending: true });

      if (error) throw new Error('DB tables missing');

      setDebts(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      const mockPartners = [
        { name: 'Jean Dupont', phone: '+33 6 1234 5678', email: 'jean.dupont@email.com' },
        { name: 'Marie Leroux', phone: '+33 6 8765 4321', email: 'marie.leroux@email.com' }
      ];
      setDebts([
        { id: '1', partner_id: '1', amount: 450.00, due_date: '2026-06-30', status: 'impayé', invoice_number: 'FAC-2026-003', partners: mockPartners[0] },
        { id: '2', partner_id: '2', amount: 1200.00, due_date: '2026-06-17', status: 'impayé', invoice_number: 'FAC-2026-004', partners: mockPartners[1] }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, []);

  const handleMarkAsRecovered = async (debtId) => {
    if (usingMockData) {
      setDebts(debts.map(d => d.id === debtId ? { ...d, status: 'recouvré' } : d));
    } else {
      const { error } = await supabase
        .from('debts')
        .update({ status: 'recouvré' })
        .eq('id', debtId);
      if (error) {
        alert("Erreur lors de la mise à jour : " + error.message);
      } else {
        fetchDebts();
      }
    }
  };

  // Filter
  const filteredDebts = debts.filter(d => {
    const matchesSearch = d.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (d.partners && d.partners.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalUnpaid = debts
    .filter(d => d.status === 'impayé' || d.status === 'partiel')
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalOverdue = debts
    .filter(d => (d.status === 'impayé' || d.status === 'partiel') && new Date(d.due_date) < new Date())
    .reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={24} style={{ color: 'var(--primary)' }} /> Recouvrement
        </h2>
        <button className="btn btn-secondary" onClick={fetchDebts}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* KPI stats */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper warning">
            <CreditCard size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Encours Client Total</span>
            <span className="kpi-value">{totalUnpaid.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper danger">
            <AlertCircle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Créances Échues (En retard)</span>
            <span className="kpi-value">{totalOverdue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher par facture, client..."
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="form-input" 
            style={{ width: '180px' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous les statuts</option>
            <option value="impayé">Impayé</option>
            <option value="partiel">Partiel</option>
            <option value="recouvré">Recouvré</option>
          </select>
        </div>
      </div>

      {/* Table List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Facture N°</th>
                  <th>Client</th>
                  <th>Date d'échéance</th>
                  <th>Montant dû</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebts.map((debt) => {
                  const isOverdue = new Date(debt.due_date) < new Date() && debt.status !== 'recouvré';
                  return (
                    <tr key={debt.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{debt.invoice_number}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{debt.partners ? debt.partners.name : '-'}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{debt.partners?.phone || '-'}</div>
                      </td>
                      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isOverdue ? '600' : '400' }}>
                        {new Date(debt.due_date).toLocaleDateString('fr-FR')} 
                        {isOverdue && ' (En retard)'}
                      </td>
                      <td style={{ fontWeight: '600' }}>{Number(debt.amount).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                      <td>
                        <span className={`badge ${debt.status}`}>
                          {debt.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {debt.status !== 'recouvré' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success)' }}
                            onClick={() => handleMarkAsRecovered(debt.id)}
                          >
                            <CheckCircle size={14} /> Encaissé
                          </button>
                        )}
                        {debt.status === 'recouvré' && (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Recouvré</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredDebts.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucune créance enregistrée.
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
