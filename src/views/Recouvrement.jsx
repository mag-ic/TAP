import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Search, Download, AlertCircle, ArrowDown, ArrowUp, Pencil, RotateCcw, X, Upload, Clock, Calendar, Trash2, FileText } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';
import { printDocument } from '../lib/printHelper';
import { useIsReadOnly } from '../lib/UserContext';

export default function Recouvrement() {
  const isReadOnly = useIsReadOnly();
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('TOUS'); // 'TOUS' | 'CLIENTS' | 'FOURNIS.'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'recouvré' | 'impayé' | 'en_attente'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'due_date', direction: 'asc' });

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCheque, setEditingCheque] = useState(null);
  const [editStatus, setEditStatus] = useState('');

  // Verser Modal State
  const [showVerserModal, setShowVerserModal] = useState(false);
  const [verserCheque, setVerserCheque] = useState(null);
  const [verserBank, setVerserBank] = useState('ATW');
  const [customBank, setCustomBank] = useState('');
  const [verserResponsable, setVerserResponsable] = useState('');
  const [verserDate, setVerserDate] = useState(new Date().toISOString().split('T')[0]);

  // History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCheque, setHistoryCheque] = useState(null);

  const fetchCheques = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
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
        await fetchCheques(true);
      } catch (err) {
        alert("Erreur lors de la mise à jour : " + err.message);
      }
    }

    setShowEditModal(false);
    setEditingCheque(null);
  };

  const handleSaveVersement = async (e) => {
    e.preventDefault();
    if (!verserCheque) return;

    const finalBank = verserBank === 'AUTRE' ? customBank : verserBank;
    const finalNumber = `Versé sur ${finalBank} par ${verserResponsable}`;
    const updateData = {
      bank: verserCheque.bank || 'Espèce',
      number: finalNumber,
      status: 'recouvré',
      due_date: verserDate
    };

    if (usingMockData) {
      setCheques(prev => prev.map(c => c.id === verserCheque.id ? { ...c, ...updateData } : c));
      const chq = mockCheques.find(c => c.id === verserCheque.id);
      if (chq) {
        chq.bank = verserCheque.bank || 'Espèce';
        chq.number = finalNumber;
        chq.status = 'recouvré';
        chq.due_date = verserDate;
      }
      alert("Versement enregistré avec succès (Mode Démo) !");
    } else {
      try {
        const { error } = await supabase
          .from('cheques')
          .update(updateData)
          .eq('id', verserCheque.id);

        if (error) throw error;
        alert("Versement enregistré avec succès !");
        await fetchCheques(true);
      } catch (err) {
        alert("Erreur lors de l'enregistrement du versement : " + err.message);
      }
    }

    setShowVerserModal(false);
    setVerserCheque(null);
    setVerserResponsable('');
    setCustomBank('');
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
        await fetchCheques(true);
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
        await fetchCheques(true);
      } catch (err) {
        alert("Erreur lors de la mise à jour du statut : " + err.message);
      }
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType('TOUS');
    setFilterStatus('all');
    setStartDate('');
    setEndDate('');
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
          await fetchCheques(true);
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter Logic for Cheques only (excluding Espèce/Virement)
  const filteredCheques = cheques.filter(c => {
    if (c.bank === 'Espèce' || c.bank === 'Espèces' || c.bank === 'Virement') return false;

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

    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && c.due_date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && c.due_date <= endDate;
    }

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  // Filter Logic for Bank Wire Transfers (Virements émis et reçus)
  const filteredVirements = cheques.filter(c => {
    if (c.bank !== 'Virement') return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (c.number && c.number.toLowerCase().includes(searchLower)) ||
      (c.partner_name && c.partner_name.toLowerCase().includes(searchLower)) ||
      (c.reference && c.reference.toLowerCase().includes(searchLower));

    const matchesType = 
      filterType === 'TOUS' ||
      (filterType === 'CLIENTS' && c.type === 'IN') ||
      (filterType === 'FOURNIS.' && c.type === 'OUT');

    const matchesStatus = 
      filterStatus === 'all' || 
      c.status === filterStatus;

    let matchesDate = true;
    const pDate = c.received_date || c.due_date;
    if (startDate) {
      matchesDate = matchesDate && pDate >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && pDate <= endDate;
    }

    return matchesSearch && matchesType && matchesStatus && matchesDate;
  });

  // Filter Logic for Sales Cash Payments (Règlements Espèces Clients)
  const filteredCashPayments = cheques.filter(c => {
    if (c.bank !== 'Espèce' && c.bank !== 'Espèces') return false;
    if (filterType === 'CLIENTS' && c.type !== 'IN') return false;
    if (filterType === 'FOURNIS.' && c.type !== 'OUT') return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (c.number && c.number.toLowerCase().includes(searchLower)) ||
      (c.partner_name && c.partner_name.toLowerCase().includes(searchLower)) ||
      (c.reference && c.reference.toLowerCase().includes(searchLower));

    const matchesStatus = 
      filterStatus === 'all' || 
      c.status === filterStatus;

    let matchesDate = true;
    const pDate = c.received_date || c.due_date;
    if (startDate) {
      matchesDate = matchesDate && pDate >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && pDate <= endDate;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const sortItems = (items) => {
    let sortableItems = [...items];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (sortConfig.key === 'amount') {
          return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        }

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  };

  // Calculate dynamic stats
  const totalClients = cheques
    .filter(c => c.type === 'IN' && c.bank !== 'Espèce' && c.bank !== 'Espèces' && c.bank !== 'Virement')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const pendingEncaissement = cheques
    .filter(c => c.type === 'IN' && c.bank !== 'Espèce' && c.bank !== 'Espèces' && c.bank !== 'Virement' && (c.status === 'impayé' || c.status === 'en_attente' || c.status === 'déposé'))
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const totalFournisseurs = cheques
    .filter(c => c.type === 'OUT' && c.bank !== 'Espèce' && c.bank !== 'Espèces' && c.bank !== 'Virement')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  // Dynamic passed echeances count (only count deposited cheques that are past due)
  const passedCount = cheques.filter(c => c.bank !== 'Espèce' && c.bank !== 'Espèces' && c.bank !== 'Virement' && c.status === 'déposé' && new Date(c.due_date) < new Date()).length;

  return (
    <div className="stock-page-container">
      {/* Header */}
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Recouvrement Chèques
          </h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '4px' }}>
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
          {!isReadOnly && (
            <button className="btn btn-white" onClick={() => document.getElementById('csv-import-cheques-input').click()}>
              <Upload size={16} /> IMPORTER CSV
            </button>
          )}
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>
          
          {passedCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: '30px', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' }}>
              <AlertCircle size={14} style={{ color: '#ef4444' }} />
              <span>{passedCount} ÉCHÉANCES PASSÉES</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        {/* Card 1 */}
        <div className="glass-card">
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Clients
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>
            {Math.round(totalClients)} DH
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-card">
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            En attente d'encaissement
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#fbbf24' }}>
            {Math.round(pendingEncaissement)} DH
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-card">
          <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Total Chèques Fournisseurs
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#ef4444' }}>
            {formatCurrency(totalFournisseurs)}
          </div>
        </div>
      </div>

      {/* Filter Capsule Bar */}
      <div className="catalog-filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '16px', marginBottom: '28px' }}>
        {/* Search */}
        <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
          <Search size={18} className="search-icon" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="N°, Tiers, Réf..."
            className="form-input search-input-catalog"
            style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', paddingLeft: '42px', height: '40px', width: '100%', borderRadius: '12px', outline: 'none' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Switch Type Tabs */}
        <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: 'var(--bg-sidebar)', borderRadius: '12px', display: 'inline-flex' }}>
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
                backgroundColor: filterType === type ? 'var(--primary)' : 'transparent',
                color: filterType === type ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: filterType === type ? '0 4px 12px var(--primary-glow)' : 'none',
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
          <Search size={18} className="search-icon" style={{ color: 'var(--text-secondary)' }} />
          <select
            className="select-category-catalog"
            style={{ paddingLeft: '42px', width: '100%', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', height: '40px', borderRadius: '12px', outline: 'none' }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all" style={{ backgroundColor: 'var(--bg-card)' }}>Tous les statuts</option>
            <option value="recouvré" style={{ backgroundColor: 'var(--bg-card)' }}>Encaissé</option>
            <option value="déposé" style={{ backgroundColor: 'var(--bg-card)' }}>Déposé</option>
            <option value="impayé" style={{ backgroundColor: 'var(--bg-card)' }}>Impayé</option>
            <option value="en_attente" style={{ backgroundColor: 'var(--bg-card)' }}>En attente</option>
          </select>
        </div>

        {/* Date filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)' }}>DU</span>
          <input
            type="date"
            onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
            style={{ 
              height: '40px', 
              borderRadius: '12px', 
              fontSize: '13px', 
              fontWeight: '600',
              padding: '0 12px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-main)', 
              color: 'var(--text-primary)', 
              cursor: 'pointer',
              outline: 'none'
            }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)' }}>AU</span>
          <input
            type="date"
            onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
            style={{ 
              height: '40px', 
              borderRadius: '12px', 
              fontSize: '13px', 
              fontWeight: '600',
              padding: '0 12px', 
              border: '1px solid var(--border-color)', 
              backgroundColor: 'var(--bg-main)', 
              color: 'var(--text-primary)', 
              cursor: 'pointer',
              outline: 'none'
            }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Reset */}
        <button
          onClick={handleResetFilters}
          className="btn"
          title="Réinitialiser les filtres"
          style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Cheques list table */}
      <div className="glass-card" style={{ padding: '24px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '24px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>Chargement des données...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('number')}>N° / BANQUE{getSortIndicator('number')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('received_date')}>REÇU LE{getSortIndicator('received_date')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('due_date')}>ÉCHÉANCE{getSortIndicator('due_date')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>TIERS / RÉF.{getSortIndicator('partner_name')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>STATUT</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>MONTANT{getSortIndicator('amount')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'right', padding: '16px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortItems(filteredCheques).map((chq) => {
                  const isClient = chq.type === 'IN';
                  const isOverdue = chq.status === 'déposé' && new Date(chq.due_date) < new Date();

                  // Badges status color mapping
                  let statusBg = 'rgba(239, 68, 68, 0.15)';
                  let statusColor = '#f87171';
                  let statusLabel = 'IMPAYÉ';

                  if (chq.status === 'recouvré') {
                    statusBg = 'rgba(16, 185, 129, 0.15)';
                    statusColor = '#34d399';
                    statusLabel = 'ENCAISSÉ';
                  } else if (chq.status === 'en_attente') {
                    statusBg = 'rgba(245, 158, 11, 0.15)';
                    statusColor = '#fbbf24';
                    statusLabel = 'EN ATTENTE';
                  } else if (chq.status === 'déposé') {
                    statusBg = 'rgba(59, 130, 246, 0.15)';
                    statusColor = '#60a5fa';
                    statusLabel = 'DÉPOSÉ';
                  }

                  return (
                    <tr key={chq.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            backgroundColor: isClient ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                            color: isClient ? '#34d399' : '#f87171', 
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
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>{chq.number || 'N/A'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', marginTop: '2px' }}>{chq.bank || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 12px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                        {chq.received_date || 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px', color: isOverdue ? '#ef4444' : 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>
                        {chq.due_date || 'N/A'}
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>{chq.partner_name || 'N/A'}</div>
                        <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: '700', marginTop: '2px', cursor: 'pointer' }}>{chq.reference || 'N/A'}</div>
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
                      <td style={{ padding: '16px 12px', fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>
                        {formatCurrency(chq.amount)}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                          {!isReadOnly && (
                            <>
                              <button 
                                onClick={(e) => handleUpdateStatusDirect(chq.id, 'déposé', e)}
                                className="btn"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  borderRadius: '6px',
                                  backgroundColor: chq.status === 'déposé' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(37, 99, 235, 0.12)',
                                  color: chq.status === 'déposé' ? 'rgba(255, 255, 255, 0.25)' : '#60a5fa',
                                  border: '1px solid ' + (chq.status === 'déposé' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(37, 99, 235, 0.3)'),
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
                                  backgroundColor: chq.status === 'recouvré' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(16, 185, 129, 0.12)',
                                  color: chq.status === 'recouvré' ? 'rgba(255, 255, 255, 0.25)' : '#34d399',
                                  border: '1px solid ' + (chq.status === 'recouvré' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(16, 185, 129, 0.3)'),
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
                                onClick={(e) => handleUpdateStatusDirect(chq.id, 'impayé', e)}
                                className="btn"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  borderRadius: '6px',
                                  backgroundColor: chq.status === 'impayé' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(239, 68, 68, 0.12)',
                                  color: chq.status === 'impayé' ? 'rgba(255, 255, 255, 0.25)' : '#f87171',
                                  border: '1px solid ' + (chq.status === 'impayé' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(239, 68, 68, 0.3)'),
                                  cursor: chq.status === 'impayé' ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.2s',
                                  height: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  lineHeight: '1'
                                }}
                                title="Marquer comme Impayé"
                                disabled={chq.status === 'impayé'}
                              >
                                Impayé
                              </button>
                            </>
                          )}
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
                            style={{ color: '#3b82f6' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              printDocument({
                                type: 'FACTURE',
                                reference: chq.reference || `CHQ-${chq.number || chq.id}`,
                                date: chq.due_date || chq.received_date,
                                clientName: chq.partner_name || 'Client Inconnu',
                                paidAmount: chq.amount,
                                paymentMethod: `Chèque N° ${chq.number || 'N/A'}${chq.bank ? ` (${chq.bank})` : ''}`,
                                isPaidAmountOnly: true
                              });
                            }} 
                            title="Imprimer Facture PDF (Montant Réglé)"
                          >
                            <FileText size={15} />
                          </button>
                          {!isReadOnly && (
                            <>
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
                            </>
                          )}
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

      {/* Card: Virements Bancaires (Émis & Reçus) */}
      <div className="glass-card" style={{ padding: '24px', marginTop: '28px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={16} />
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>Virements Bancaires (Émis & Reçus)</h3>
        </div>

        {filteredVirements.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontWeight: '600' }}>
            Aucun virement bancaire enregistré.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('type')}>TYPE{getSortIndicator('type')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>PARTENAIRE{getSortIndicator('partner_name')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('reference')}>RÉFÉRENCE FACTURE{getSortIndicator('reference')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('due_date')}>DATE RÈGLEMENT{getSortIndicator('due_date')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>MONTANT TTC{getSortIndicator('amount')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('number')}>N° VIREMENT{getSortIndicator('number')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortItems(filteredVirements).map((chq) => (
                  <tr key={chq.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '20px 16px' }}>
                      <span style={{
                        backgroundColor: chq.type === 'IN' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: chq.type === 'IN' ? '#34d399' : '#f87171',
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        border: chq.type === 'IN' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                      }}>
                        {chq.type === 'IN' ? 'Reçu' : 'Émis'}
                      </span>
                    </td>
                    <td style={{ padding: '20px 16px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                      {chq.partner_name || 'N/A'}
                    </td>
                    <td style={{ padding: '20px 16px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>
                      {chq.reference || 'N/A'}
                    </td>
                    <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      {chq.received_date || chq.due_date || 'N/A'}
                    </td>
                    <td style={{ padding: '20px 16px', fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>
                      {formatCurrency(chq.amount)}
                    </td>
                    <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '700', fontSize: '13px' }}>
                      {chq.number || 'N/A'}
                    </td>
                    <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '14px', alignItems: 'center' }}>
                        <button 
                          className="action-icon-btn" 
                          style={{ color: '#3b82f6' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            printDocument({
                              type: 'FACTURE',
                              reference: chq.reference || `VIR-${chq.number || chq.id}`,
                              date: chq.due_date || chq.received_date,
                              clientName: chq.partner_name || 'Client Inconnu',
                              paidAmount: chq.amount,
                              paymentMethod: `Virement N° ${chq.number || 'N/A'}`,
                              isPaidAmountOnly: true
                            });
                          }} 
                          title="Imprimer Facture PDF (Montant Réglé)"
                        >
                          <FileText size={16} />
                        </button>
                        {!isReadOnly && (
                          <button 
                            className="action-icon-btn delete" 
                            style={{ color: 'var(--danger)' }} 
                            onClick={(e) => handleDeleteCheque(chq.id, e)} 
                            title="Supprimer le règlement"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Card: Règlements Espèces */}
      <div className="glass-card" style={{ padding: '24px', marginTop: '28px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={16} />
          </div>
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase', margin: 0 }}>Règlements Espèces</h3>
        </div>

        {filteredCashPayments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontStyle: 'italic', fontWeight: '600' }}>
            Aucun règlement en espèces enregistré.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>PARTENAIRE / TIERS{getSortIndicator('partner_name')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('reference')}>RÉFÉRENCE{getSortIndicator('reference')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('type')}>TYPE{getSortIndicator('type')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('due_date')}>DATE RÈGLEMENT{getSortIndicator('due_date')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>MONTANT TTC{getSortIndicator('amount')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortItems(filteredCashPayments).map((chq) => {
                  const isIncoming = chq.type === 'IN';
                  return (
                    <tr key={chq.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '20px 16px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {chq.partner_name || 'N/A'}
                      </td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>
                        {chq.reference || 'N/A'}
                      </td>
                      <td style={{ padding: '20px 16px' }}>
                        <span style={{
                          backgroundColor: isIncoming ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                          color: isIncoming ? 'var(--success)' : '#f43f5e',
                          fontSize: '10px',
                          fontWeight: '800',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-block'
                        }}>
                          {isIncoming ? 'Encaissement' : 'Décaissement'}
                        </span>
                      </td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                        {chq.received_date || chq.due_date || 'N/A'}
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: '800', color: isIncoming ? 'var(--success)' : '#f43f5e', fontSize: '15px' }}>
                        {isIncoming ? '+' : '-'}{formatCurrency(chq.amount)}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '14px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                          {!isReadOnly && (
                            <>
                              {chq.status === 'en_attente' ? (
                                <button 
                                  className="btn"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                    color: 'var(--success)',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontFamily: 'inherit'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVerserCheque(chq);
                                    setVerserDate(new Date().toISOString().split('T')[0]);
                                    setShowVerserModal(true);
                                  }}
                                >
                                  Verser
                                </button>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span style={{ 
                                    backgroundColor: 'rgba(59, 130, 246, 0.15)', 
                                    color: '#60a5fa', 
                                    fontSize: '10px', 
                                    fontWeight: '800', 
                                    padding: '2px 8px', 
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    display: 'inline-block'
                                  }}>
                                    VERSÉ
                                  </span>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
                                    {chq.number}
                                  </span>
                                </div>
                              )}
                              <button 
                                className="action-icon-btn" 
                                style={{ color: '#3b82f6' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  printDocument({
                                    type: 'FACTURE',
                                    reference: chq.reference || `ESP-${chq.id}`,
                                    date: chq.due_date || chq.received_date,
                                    clientName: chq.partner_name || 'Client Inconnu',
                                    paidAmount: chq.amount,
                                    paymentMethod: 'Règlement Espèces',
                                    isPaidAmountOnly: true
                                  });
                                }} 
                                title="Imprimer Facture PDF (Montant Réglé)"
                              >
                                <FileText size={16} />
                              </button>
                              <button 
                                className="action-icon-btn delete" 
                                style={{ color: 'var(--danger)' }} 
                                onClick={(e) => handleDeleteCheque(chq.id, e)} 
                                title="Supprimer le règlement"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
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

      {/* Edit Status Modal */}
      {showEditModal && editingCheque && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowEditModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Modifier le Statut</h3>
            
            <form onSubmit={handleSaveStatus}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '16px', marginBottom: '20px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Détails du Chèque</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700' }}>N°: {editingCheque.number || 'N/A'} ({editingCheque.bank ? editingCheque.bank.toUpperCase() : '-'})</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Tiers: {editingCheque.partner_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Montant: {formatCurrency(editingCheque.amount)}</div>
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

      {/* Verser Modal */}
      {showVerserModal && verserCheque && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)', width: '400px' }}>
            <button className="modal-close" onClick={() => setShowVerserModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Verser en Banque</h3>
            
            <form onSubmit={handleSaveVersement}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '16px', marginBottom: '20px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Détails du Versement</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700' }}>Tiers: {verserCheque.partner_name || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Référence: {verserCheque.reference || 'N/A'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Montant: {formatCurrency(verserCheque.amount)}</div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Banque de Dépôt</label>
                <select 
                  className="form-input" 
                  value={verserBank}
                  onChange={(e) => setVerserBank(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="ATW">ATW (Attijariwafa Bank)</option>
                  <option value="CDM">CDM (Crédit du Maroc)</option>
                  <option value="BP">BP (Banque Populaire)</option>
                  <option value="CIH">CIH (CIH Bank)</option>
                  <option value="BMCE">BMCE (Bank of Africa)</option>
                  <option value="AUTRE">Autre Banque...</option>
                </select>
              </div>

              {verserBank === 'AUTRE' && (
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Nom de la Banque</label>
                  <input 
                    type="text"
                    className="form-input"
                    placeholder="Ex: Société Générale..."
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Responsable du Versement</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="Ex: Ali, Omar..."
                  value={verserResponsable}
                  onChange={(e) => setVerserResponsable(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Date de Versement</label>
                <input 
                  type="date"
                  className="form-input"
                  value={verserDate}
                  onChange={(e) => setVerserDate(e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowVerserModal(false)}>Annuler</button>
                <button type="submit" className="btn btn-blue-action">Valider le Versement</button>
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
              <div style={{ padding: '16px', backgroundColor: 'rgba(37, 99, 235, 0.15)', borderRadius: '16px', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Document / Invoice Lié</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {historyCheque.reference || 'N/A'}
                </div>
              </div>

              {/* Date details */}
              <div className="glass-card" style={{ padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Date du Règlement (Échéance)</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    {historyCheque.due_date || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Date de Réception</span>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: '#64748b' }} />
                    {historyCheque.received_date || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Tiers and details */}
              <div className="glass-card" style={{ padding: '18px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Tiers / Partenaire :</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{historyCheque.partner_name || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>N° du Chèque :</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{historyCheque.number || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '600' }}>Banque émettrice :</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{historyCheque.bank ? historyCheque.bank.toUpperCase() : 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Montant réglé :</span>
                  <span style={{ fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>{formatCurrency(historyCheque.amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b', fontWeight: '700' }}>Statut :</span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '800',
                    color: historyCheque.status === 'recouvré' ? '#34d399' : historyCheque.status === 'en_attente' ? '#fbbf24' : '#f87171',
                    backgroundColor: historyCheque.status === 'recouvré' ? 'rgba(16, 185, 129, 0.15)' : historyCheque.status === 'en_attente' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
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
