import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Search, Download, AlertCircle, ArrowDown, ArrowUp, Pencil, RotateCcw, X, Upload, Clock, Calendar, Trash2 } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';

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

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCheque, setHistoryCheque] = useState(null);

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

  const handleDeleteCheque = async (chequeId, e) => {
    e.stopPropagation();
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce règlement ?")) {
      return;
    }

    if (usingMockData) {
      setCheques(prev => prev.filter(c => c.id !== chequeId));
      const chqIndex = mockCheques.findIndex(c => c.id === chequeId);
      if (chqIndex !== -1) {
        mockCheques.splice(chqIndex, 1);
      }
      alert("Règlement supprimé avec succès (Mode Démo) !");
    } else {
      try {
        const { error } = await supabase
          .from('cheques')
          .delete()
          .eq('id', chequeId);

        if (error) throw error;
        alert("Règlement supprimé avec succès !");
        await fetchCheques();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handleUpdateStatusDirect = async (chequeId, newStatus, e) => {
    e.stopPropagation();
    
    if (usingMockData) {
      setCheques(prev => prev.map(c => c.id === chequeId ? { ...c, status: newStatus } : c));
      const chqIndex = mockCheques.findIndex(c => c.id === chequeId);
      if (chqIndex !== -1) {
        mockCheques[chqIndex].status = newStatus;
      }
    } else {
      try {
        const { error } = await supabase
          .from('cheques')
          .update({ status: newStatus })
          .eq('id', chequeId);

        if (error) throw error;
        await fetchCheques();
      } catch (err) {
        alert("Erreur lors de la mise à jour du statut : " + err.message);
      }
    }
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
      c.status === 'recouvré' ? 'Encaissé' : c.status === 'déposé' ? 'Déposé' : c.status === 'impayé' ? 'Impayé' : 'En attente',
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

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const parsed = parseCSV(text);
      if (!parsed || parsed.rows.length === 0) {
        alert("Le fichier CSV est vide ou invalide.");
        return;
      }

      const newCheques = [];
      parsed.rows.forEach(row => {
        let rawType = (row.type || row.role || 'IN').toLowerCase();
        let type = 'IN';
        if (rawType.includes('out') || rawType.includes('fournis') || rawType.includes('supplier') || rawType.includes('prov')) {
          type = 'OUT';
        }

        const due_date = row.due_date || row.echeance || row.due || new Date().toISOString().split('T')[0];
        const received_date = row.received_date || row['date recu'] || row.received || new Date().toISOString().split('T')[0];
        const bank = row.bank || row.banque || null;
        const number = row.number || row.numero || row['numero de cheque'] || null;
        const partner_name = row.partner_name || row.partner || row.tiers || row.client || row.fournisseur || null;
        const reference = row.reference || row['référence'] || null;

        let amount = parseFloat((row.amount || row.montant || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (isNaN(amount)) amount = 0;

        let rawStatus = (row.status || row.statut || 'en_attente').toLowerCase();
        let status = 'en_attente';
        if (rawStatus.includes('recouvr') || rawStatus.includes('encais') || rawStatus.includes('clear')) {
          status = 'recouvré';
        } else if (rawStatus.includes('depos') || rawStatus.includes('remis') || rawStatus.includes('sent')) {
          status = 'déposé';
        } else if (rawStatus.includes('impay') || rawStatus.includes('bounce') || rawStatus.includes('reject')) {
          status = 'impayé';
        }

        newCheques.push({
          id: 'chq-' + Math.floor(Math.random() * 100000000000),
          type,
          reference,
          status,
          partner_name,
          due_date,
          amount,
          bank,
          number,
          received_date
        });
      });

      if (newCheques.length === 0) return;

      if (usingMockData) {
        setCheques(prev => [...newCheques, ...prev]);
        alert(`${newCheques.length} chèques importés avec succès localement !`);
      } else {
        try {
          const { error } = await supabase.from('cheques').insert(newCheques);
          if (error) throw error;
          alert(`${newCheques.length} chèques importés avec succès dans la base de données !`);
          await fetchCheques();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    .filter(c => c.type === 'IN' && (c.status === 'impayé' || c.status === 'en_attente' || c.status === 'déposé'))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalFournisseurs = cheques
    .filter(c => c.type === 'OUT')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Dynamic passed echeances count (only count deposited cheques that are past due)
  const passedCount = cheques.filter(c => c.status === 'déposé' && new Date(c.due_date) < new Date()).length;

  return (
    <div className="stock-page-container">
      {/* Header */}
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            Recouvrement Chèques
          </h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', marginTop: '4px' }}>
            Suivi individuel et rigoureux de chaque titre de paiement.
          </p>
        </div>
        
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          <input
            type="file"
            id="csv-import-cheques-input"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button className="btn btn-white" onClick={() => document.getElementById('csv-import-cheques-input').click()}>
            <Upload size={16} /> IMPORTER CSV
          </button>
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
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
        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Clients
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>
            {Math.round(totalClients)} DH
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            En attente d'encaissement
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#d97706' }}>
            {Math.round(pendingEncaissement)} DH
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Fournisseurs
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626' }}>
            {formatCurrency(totalFournisseurs)}
          </div>
        </div>
      </div>

      {/* Filter Capsule Bar */}
      <div className="catalog-filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {/* Search */}
        <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
          <Search size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="N°, Tiers, Réf..."
            className="form-input search-input-catalog"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Switch Type Tabs */}
        <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'inline-flex' }}>
          {['TOUS', 'CLIENTS', 'FOURNIS.'].map(type => (
            <button
              key={type}
              className={`tab-btn ${filterType === type ? 'active' : ''}`}
              style={{
                textTransform: 'uppercase',
                fontSize: '11px',
                letterSpacing: '0.5px',
                padding: '8px 16px',
                borderRadius: '10px',
                backgroundColor: filterType === type ? '#2563eb' : 'transparent',
                color: filterType === type ? '#ffffff' : '#64748b',
                boxShadow: filterType === type ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
                transition: 'all 0.2s ease',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer'
              }}
              onClick={() => setFilterType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <div className="search-input-wrapper" style={{ width: '200px', flexShrink: 0 }}>
          <Search size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <select
            className="select-category-catalog"
            style={{ paddingLeft: '42px', width: '100%' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">Tous les statuts</option>
            <option value="recouvré">Encaissé</option>
            <option value="déposé">Déposé</option>
            <option value="impayé">Impayé</option>
            <option value="en_attente">En attente</option>
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={handleResetFilters}
          className="btn btn-white"
          title="Réinitialiser les filtres"
          style={{ padding: '12px', borderRadius: '12px' }}
        >
          <RotateCcw size={16} />
        </button>
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
                  const isOverdue = chq.status === 'déposé' && new Date(chq.due_date) < new Date();

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
                  } else if (chq.status === 'déposé') {
                    statusBg = '#e0f2fe';
                    statusColor = '#0369a1';
                    statusLabel = 'DÉPOSÉ';
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
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          <button 
                            onClick={(e) => handleUpdateStatusDirect(chq.id, 'déposé', e)}
                            className="btn"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              borderRadius: '6px',
                              backgroundColor: chq.status === 'déposé' ? '#f1f5f9' : '#eff6ff',
                              color: chq.status === 'déposé' ? '#94a3b8' : '#2563eb',
                              border: '1px solid ' + (chq.status === 'déposé' ? '#e2e8f0' : '#bfdbfe'),
                              cursor: chq.status === 'déposé' ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              lineHeight: '1'
                            }}
                            title="Marquer comme Déposé"
                            disabled={chq.status === 'déposé'}
                          >
                            Déposer
                          </button>
                          <button 
                            onClick={(e) => handleUpdateStatusDirect(chq.id, 'recouvré', e)}
                            className="btn"
                            style={{
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: '700',
                              borderRadius: '6px',
                              backgroundColor: chq.status === 'recouvré' ? '#f1f5f9' : '#ecfdf5',
                              color: chq.status === 'recouvré' ? '#94a3b8' : '#059669',
                              border: '1px solid ' + (chq.status === 'recouvré' ? '#e2e8f0' : '#a7f3d0'),
                              cursor: chq.status === 'recouvré' ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.2s',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              lineHeight: '1'
                            }}
                            title="Marquer comme Encaissé"
                            disabled={chq.status === 'recouvré'}
                          >
                            Encaisser
                          </button>
                          <button 
                            className="action-icon-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              setHistoryCheque(chq);
                              setShowHistoryModal(true);
                            }} 
                            title="Historique du règlement"
                          >
                            <Clock size={15} />
                          </button>
                          <button 
                            className="action-icon-btn" 
                            onClick={(e) => handleEditClick(chq, e)} 
                            title="Modifier le statut"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            className="action-icon-btn delete" 
                            onClick={(e) => handleDeleteCheque(chq.id, e)} 
                            title="Supprimer le règlement"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Modifier le Statut</h3>
            
            <form onSubmit={handleSaveStatus}>
              <div style={{ padding: '16px', backgroundColor: '#f1f5f9', borderRadius: '16px', marginBottom: '20px', border: '1px solid #e2e8f0', color: '#0f172a' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Détails du Chèque</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700' }}>N°: {editingCheque.number || 'N/A'} ({editingCheque.bank ? editingCheque.bank.toUpperCase() : '-'})</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Tiers: {editingCheque.partner_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Montant: {formatCurrency(editingCheque.amount)}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Nouveau Statut</label>
                <select 
                  className="form-input" 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  <option value="recouvré">Encaissé</option>
                  <option value="déposé">Déposé</option>
                  <option value="impayé">Impayé</option>
                  <option value="en_attente">En attente</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-blue-action">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* History Settlement Modal */}
      {showHistoryModal && historyCheque && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)', width: '450px' }}>
            <button className="modal-close" onClick={() => { setShowHistoryModal(false); setHistoryCheque(null); }}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} style={{ color: '#2563eb' }} />
              Historique de Règlement
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Reference invoice */}
              <div style={{ padding: '16px', backgroundColor: '#eff6ff', borderRadius: '16px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document / Invoice Lié</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1e3a8a', marginTop: '4px' }}>
                  {historyCheque.reference || 'N/A'}
                </div>
              </div>

              {/* Date details */}
              <div className="glass-card" style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Date du Règlement (Échéance)</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    {historyCheque.due_date || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Date de Réception</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    {historyCheque.received_date || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tiers and details */}
              <div className="glass-card" style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Tiers / Partenaire :</span>
                  <span style={{ fontWeight: '700', color: '#334155' }}>{historyCheque.partner_name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>N° du Chèque :</span>
                  <span style={{ fontWeight: '700', color: '#334155' }}>{historyCheque.number || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Banque émettrice :</span>
                  <span style={{ fontWeight: '700', color: '#334155' }}>{historyCheque.bank ? historyCheque.bank.toUpperCase() : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Montant réglé :</span>
                  <span style={{ fontWeight: '800', color: '#0f172a', fontSize: '15px' }}>{formatCurrency(historyCheque.amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Statut :</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: historyCheque.status === 'recouvré' ? '#065f46' : historyCheque.status === 'en_attente' ? '#92400e' : '#991b1b',
                    backgroundColor: historyCheque.status === 'recouvré' ? '#d1fae5' : historyCheque.status === 'en_attente' ? '#fef3c7' : '#fee2e2',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                  }}>
                    {historyCheque.status === 'recouvré' ? 'Encaissé' : historyCheque.status === 'en_attente' ? 'En attente' : 'Impayé'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowHistoryModal(false); setHistoryCheque(null); }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
