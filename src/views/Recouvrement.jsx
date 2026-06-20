import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Search, Download, AlertCircle, ArrowDown, ArrowUp, Pencil, RotateCcw, X } from 'lucide-react';

export default function Recouvrement() {
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('TOUS'); // 'TOUS' | 'CLIENTS' | 'FOURNIS.'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'recouvré' | 'impayé' | 'en_attente'

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCheque, setEditingCheque] = useState(null);
  const [editStatus, setEditStatus] = useState('');

  const fetchCheques = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cheques')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw new Error('DB tables missing');

      setCheques(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setCheques(mockCheques);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheques();
  }, []);

  const handleEditClick = (cheque, e) => {
    e.stopPropagation();
    setEditingCheque(cheque);
    setEditStatus(cheque.status);
    setShowEditModal(true);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!editingCheque) return;

    if (usingMockData) {
      setCheques(prev => prev.map(c => c.id === editingCheque.id ? { ...c, status: editStatus } : c));
    } else {
      try {
        const { error } = await supabase
          .from('cheques')
          .update({ status: editStatus })
          .eq('id', editingCheque.id);

        if (error) throw error;
        await fetchCheques();
      } catch (err) {
        alert("Erreur lors de la mise à jour : " + err.message);
      }
    }

    setShowEditModal(false);
    setEditingCheque(null);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('TOUS');
    setFilterStatus('all');
  };

  const handleExportCSV = () => {
    const headers = ['Type', 'Numero', 'Banque', 'Date Recu', 'Echeance', 'Tiers', 'Reference', 'Statut', 'Montant'];
    const rows = filteredCheques.map(c => [
      c.type === 'IN' ? 'Client' : 'Fournisseur',
      `"${c.number || ''}"`,
      c.bank || '',
      c.received_date || '',
      c.due_date || '',
      `"${c.partner_name || ''}"`,
      c.reference || '',
      c.status === 'recouvré' ? 'Encaissé' : c.status === 'impayé' ? 'Impayé' : 'En attente',
      c.amount || 0
    ]);

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `recouvrement_cheques_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Logic
  const filteredCheques = cheques.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (c.number && c.number.toLowerCase().includes(searchLower)) ||
      (c.partner_name && c.partner_name.toLowerCase().includes(searchLower)) ||
      (c.reference && c.reference.toLowerCase().includes(searchLower)) ||
      (c.bank && c.bank.toLowerCase().includes(searchLower));

    const matchesType = 
      filterType === 'TOUS' ||
      (filterType === 'CLIENTS' && c.type === 'IN') ||
      (filterType === 'FOURNIS.' && c.type === 'OUT');

    const matchesStatus = 
      filterStatus === 'all' || 
      c.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate dynamic stats
  const totalClients = cheques
    .filter(c => c.type === 'IN')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const pendingEncaissement = cheques
    .filter(c => c.type === 'IN' && (c.status === 'impayé' || c.status === 'en_attente'))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalFournisseurs = cheques
    .filter(c => c.type === 'OUT')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Dynamic passed echeances count
  const passedCount = cheques.filter(c => c.status !== 'recouvré' && new Date(c.due_date) < new Date()).length;

  return (
    <div style={{ color: '#1f2937' }}>
      {/* Header matching image */}
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Recouvrement Chèques
          </h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', marginTop: '4px' }}>
            Suivi individuel et rigoureux de chaque titre de paiement.
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#334155', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
            <Download size={16} />
            <span>EXPORTER</span>
          </button>
          
          {passedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fee2e2', color: '#dc2626', padding: '8px 16px', borderRadius: '30px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
              <AlertCircle size={14} style={{ color: '#dc2626' }} />
              <span>{passedCount} ÉCHÉANCES PASSÉES</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Card 1 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Clients
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
            {Math.round(totalClients)} DH
          </div>
        </div>

        {/* Card 2 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            En attente d'encaissement
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#d97706' }}>
            {Math.round(pendingEncaissement)} DH
          </div>
        </div>

        {/* Card 3 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Fournisseurs
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626' }}>
            {formatCurrency(totalFournisseurs)}
          </div>
        </div>
      </div>

      {/* Filter Capsule Bar */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '50px', border: '1px solid #e2e8f0', padding: '8px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '28px', boxShadow: '0 4px 18px rgba(0,0,0,0.01)' }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexGrow: 1, maxWidth: '300px' }}>
          <Search size={18} style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="N°, Tiers, Réf..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ border: 'none', backgroundColor: 'transparent', width: '100%', outline: 'none', color: '#1f2937', fontWeight: '600', fontSize: '13px' }}
          />
        </div>

        {/* Switch Type Tabs */}
        <div style={{ display: 'inline-flex', padding: '2px', backgroundColor: '#f1f5f9', borderRadius: '30px' }}>
          {['TOUS', 'CLIENTS', 'FOURNIS.'].map(type => (
            <button
              key={type}
              style={{
                padding: '6px 16px',
                borderRadius: '30px',
                border: 'none',
                backgroundColor: filterType === type ? '#ffffff' : 'transparent',
                color: filterType === type ? '#2563eb' : '#64748b',
                fontWeight: '800',
                fontSize: '11px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                boxShadow: filterType === type ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setFilterType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: '#0f172a',
              fontWeight: '800',
              fontSize: '12px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              outline: 'none',
              paddingRight: '12px'
            }}
          >
            <option value="all">Tous les statuts</option>
            <option value="recouvré">Encaissé</option>
            <option value="impayé">Impayé</option>
            <option value="en_attente">En attente</option>
          </select>
        </div>

        {/* Reset */}
        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
          <button
            onClick={handleResetFilters}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#64748b',
              fontWeight: '800',
              fontSize: '11px',
              letterSpacing: '0.5px',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={13} />
            <span>RESET</span>
          </button>
        </div>
      </div>

      {/* Cheques list table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>Chargement des données...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>N° / BANQUE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>REÇU LE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>ÉCHÉANCE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>TIERS / RÉF.</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>STATUT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>MONTANT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'right', padding: '16px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheques.map((chq) => {
                  const isClient = chq.type === 'IN';
                  const isOverdue = chq.status !== 'recouvré' && new Date(chq.due_date) < new Date();

                  // Badges status color mapping
                  let statusBg = '#fee2e2';
                  let statusColor = '#991b1b';
                  let statusLabel = 'IMPAYÉ';

                  if (chq.status === 'recouvré') {
                    statusBg = '#d1fae5';
                    statusColor = '#065f46';
                    statusLabel = 'ENCAISSÉ';
                  } else if (chq.status === 'en_attente') {
                    statusBg = '#fef3c7';
                    statusColor = '#92400e';
                    statusLabel = 'EN ATTENTE';
                  }

                  return (
                    <tr key={chq.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            backgroundColor: isClient ? '#d1fae5' : '#fee2e2', 
                            color: isClient ? '#10b981' : '#ef4444', 
                            borderRadius: '50%', 
                            width: '28px', 
                            height: '28px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center' 
                          }}>
                            {isClient ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>{chq.number || 'N/A'}</div>
                            <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>{chq.bank || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
                        {chq.received_date || 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px', color: isOverdue ? '#dc2626' : '#1f2937', fontSize: '13px', fontWeight: '700' }}>
                        {chq.due_date || 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '700', color: '#1f2937', fontSize: '13px' }}>{chq.partner_name || 'N/A'}</div>
                        <div style={{ color: '#2563eb', fontSize: '11px', fontWeight: '700', marginTop: '2px', cursor: 'pointer' }}>{chq.reference || 'N/A'}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ 
                          backgroundColor: statusBg, 
                          color: statusColor, 
                          fontSize: '10px', 
                          fontWeight: '800', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          letterSpacing: '0.5px',
                          display: 'inline-block'
                        }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>
                        {formatCurrency(chq.amount)}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <button 
                          className="action-icon-btn" 
                          style={{ color: '#cbd5e1', cursor: 'pointer', border: 'none', backgroundColor: 'transparent' }}
                          onClick={(e) => handleEditClick(chq, e)} 
                          title="Modifier le statut"
                        >
                          <Pencil size={15} style={{ color: '#94a3b8' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredCheques.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                      Aucun chèque enregistré ou ne correspond aux critères.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Status Modal */}
      {showEditModal && editingCheque && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '28px', width: '420px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Modifier le Statut</h3>
              <button style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveStatus}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Détails du Chèque</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700' }}>N°: {editingCheque.number || 'N/A'} ({editingCheque.bank})</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Tiers: {editingCheque.partner_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Montant: {formatCurrency(editingCheque.amount)}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '12px', color: '#475569', marginBottom: '8px', display: 'block' }}>Nouveau Statut</label>
                <select 
                  className="form-input" 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="recouvré">Encaissé</option>
                  <option value="impayé">Impayé</option>
                  <option value="en_attente">En attente</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="btn btn-blue-action" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', cursor: 'pointer' }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
