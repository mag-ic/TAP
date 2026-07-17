import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions, mockCheques, mockPartners } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, RefreshCw, Download, Pencil, Clock, FileText, X, RotateCcw, Calendar, User, Info, PieChart, BarChart3, BookOpen, Calculator, Upload, Trash2 } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';
import { printDocument } from '../lib/printHelper';
import { useIsReadOnly } from '../lib/UserContext';

export default function FinanceCompta({ initialMode = 'finance' }) {
  const isReadOnly = useIsReadOnly();
  const [transactions, setTransactions] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  
  // Tab/view states
  const [activeSubTab, setActiveSubTab] = useState('factures'); // For Finance: 'factures' | 'achats' | 'charges' | 'apports'
  const [comptaTab, setComptaTab] = useState('bilan'); // For Compta: 'bilan' | 'cpc' | 'grand-livre'
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTypeSelect, setFilterTypeSelect] = useState('all');
  const [filterStatut, setFilterStatut] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState([]);

  useEffect(() => {
    setSelectedTxIds([]);
    setFilterTypeSelect('all');
  }, [activeSubTab]);

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Add Charge Modal States
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [chargeTypeInput, setChargeTypeInput] = useState('Autre');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargePartner, setChargePartner] = useState('');
  const [chargeDate, setChargeDate] = useState(new Date().toISOString().split('T')[0]);
  const [chargeStatus, setChargeStatus] = useState('confirmé');
  const [chargePaymentMethod, setChargePaymentMethod] = useState('Espèces');
  const [chargeBank, setChargeBank] = useState('ATW');
  const [chargeNumber, setChargeNumber] = useState('');

  // Payment Modal States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTxForPayment, setSelectedTxForPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Virement');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentBank, setPaymentBank] = useState('');
  const [paymentNumber, setPaymentNumber] = useState('');

  // History Modal States
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedTxForHistory, setSelectedTxForHistory] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (txError) throw new Error('DB tables missing');

      const { data: chqData } = await supabase.from('cheques').select('*');
      const { data: partnerData } = await supabase.from('partners').select('*');

      setTransactions(txData || []);
      setCheques(chqData || []);
      setPartners(partnerData || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions(mockTransactions);
      setCheques(mockCheques);
      setPartners(mockPartners);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getBCReference = (description) => {
    if (!description) return 'INV-26-XXXX';
    const match = description.match(/(BC-\d+-\d+|BC\d+|AR-\d+-\d+|AR\d+|INV-\d+-\d+)/);
    return match ? match[0] : (description.replace('Entrée ', '').replace('Facture ', '').split(' - ')[0] || description);
  };

  const getDisplayReference = (description) => {
    if (!description) return 'INV-26-XXXX';
    if (description.includes(' : ')) {
      return description.split(' : ').slice(1).join(' : ');
    }
    const blMatch = description.match(/(BL-\d+-\d+|BL\d+)/);
    if (blMatch) {
      return blMatch[0].replace('BL-', 'FACTURE-').replace('BL', 'FACTURE-');
    }
    const ref = getBCReference(description);
    if (ref.startsWith('BL-') || ref.startsWith('BL')) {
      return ref.replace('BL-', 'FACTURE-').replace('BL', 'FACTURE-');
    }
    return ref;
  };

  const getChargeType = (tx) => {
    if (!tx || !tx.description) return 'Autre';
    if (tx.description.includes(' : ')) {
      return tx.description.split(' : ')[0];
    }
    if (tx.description.toLowerCase().includes('commission') || tx.id?.startsWith('tx-comm-')) {
      return 'Commission';
    }
    return 'Autre';
  };

  const parseItems = (itemsStr) => {
    if (!itemsStr) return [];
    try {
      if (typeof itemsStr === 'object') return itemsStr;
      return JSON.parse(itemsStr);
    } catch (e) {
      return [];
    }
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

  // --- 1. FINANCE TAB LOGIC ---
  const displayedTxs = transactions.filter(t => {
    if (activeSubTab === 'factures') {
      return t.type === 'vente' || t.type === 'revenu';
    } else if (activeSubTab === 'achats') {
      return t.type === 'achat';
    } else if (activeSubTab === 'charges') {
      return t.type === 'charge' && !t.description?.toLowerCase().includes('avance');
    } else {
      return t.type === 'depot' || t.type === 'apport';
    }
  });

  const filteredTxs = displayedTxs.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.partner_name && t.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesType = true;
    if (filterTypeSelect !== 'all') {
      if (activeSubTab === 'charges') {
        matchesType = getChargeType(t) === filterTypeSelect;
      } else {
        matchesType = t.type === filterTypeSelect;
      }
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

    return matchesSearch && matchesType && matchesStatut && matchesDate;
  });

  const totalAmount = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).total, 0);
  const totalRegle = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).regle, 0);
  const totalReste = filteredTxs.reduce((sum, t) => sum + getTxMetrics(t).reste, 0);

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

      const newTxs = [];
      parsed.rows.forEach(row => {
        const description = (row.description || row.libelle || row['référence'] || row.reference || row['référence / libellé'] || row.designation || `Import ${activeSubTab}`).trim();
        const date = row.date || new Date().toISOString().split('T')[0];
        const partner_name = row.partner_name || row.partner || row.tiers || row.client || row.fournisseur || null;

        let amount = parseFloat((row.amount || row.montant || row.valeur || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
        if (isNaN(amount)) amount = 0;

        const payment_method = row.payment_method || row.payment || row.mode || row['mode de paiement'] || 'Virement';

        let rawStatus = (row.status || row.statut || 'confirmé').toLowerCase();
        let status = 'confirmé';
        if (rawStatus.includes('attente') || rawStatus.includes('partiel') || rawStatus.includes('impay') || rawStatus.includes('pending')) {
          status = 'en_attente';
        } else if (rawStatus.includes('annul') || rawStatus.includes('cancel')) {
          status = 'annulé';
        }

        let type = row.type || null;
        if (!type) {
          if (activeSubTab === 'factures') {
            type = 'vente';
          } else if (activeSubTab === 'achats') {
            type = 'achat';
          } else if (activeSubTab === 'charges') {
            type = 'charge';
          } else {
            type = 'apport';
          }
        }

        newTxs.push({
          id: 'tx-' + Math.floor(Math.random() * 100000000000),
          type,
          amount,
          description,
          partner_name,
          date,
          payment_method,
          status,
          items: '[]'
        });
      });

      if (newTxs.length === 0) return;

      if (usingMockData) {
        setTransactions(prev => [...newTxs, ...prev]);
        alert(`${newTxs.length} transactions importées avec succès localement !`);
      } else {
        try {
          const { error } = await supabase.from('transactions').insert(newTxs);
          if (error) throw error;
          alert(`${newTxs.length} transactions importées avec succès dans la base de données !`);
          await fetchData();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

  const handleSaveCharge = async (e) => {
    e.preventDefault();
    if (!chargeDescription || !chargeAmount) return;

    const txId = 'tx-' + Date.now();
    const finalAmount = parseFloat(chargeAmount);
    const fullDescription = `${chargeTypeInput} : ${chargeDescription}`;

    const newTx = {
      id: txId,
      type: 'charge',
      amount: finalAmount,
      description: fullDescription,
      partner_name: chargePartner || 'Divers',
      date: chargeDate,
      payment_method: chargePaymentMethod,
      status: chargeStatus
    };

    let newCheque = null;
    if (chargeStatus === 'confirmé' && chargePaymentMethod !== 'Crédit') {
      newCheque = {
        id: 'chq-' + Date.now(),
        type: 'OUT',
        reference: fullDescription,
        status: chargePaymentMethod === 'Chèque' ? 'en_attente' : 'recouvré',
        partner_name: chargePartner || 'Divers',
        due_date: chargeDate,
        amount: finalAmount,
        bank: chargePaymentMethod === 'Chèque' ? chargeBank : (chargePaymentMethod === 'Espèces' ? 'Espèce' : chargePaymentMethod),
        number: chargePaymentMethod === 'Chèque' ? chargeNumber : `${chargePaymentMethod.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
        received_date: chargeDate
      };
    }

    if (usingMockData) {
      setTransactions([newTx, ...transactions]);
      mockTransactions.unshift(newTx);
      if (newCheque) {
        setCheques([newCheque, ...cheques]);
        mockCheques.unshift(newCheque);
      }
      alert("Charge ajoutée avec succès (Mode Démo) !");
    } else {
      try {
        const { error: txError } = await supabase.from('transactions').insert([newTx]);
        if (txError) throw txError;

        if (newCheque) {
          const { error: chqError } = await supabase.from('cheques').insert([newCheque]);
          if (chqError) throw chqError;
        }

        alert("Charge ajoutée avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de l'ajout de la charge : " + err.message);
        return;
      }
    }

    // Reset Form & Close
    setShowAddChargeModal(false);
    setChargeTypeInput('Autre');
    setChargeDescription('');
    setChargeAmount('');
    setChargePartner('');
    setChargeDate(new Date().toISOString().split('T')[0]);
    setChargeStatus('confirmé');
    setChargePaymentMethod('Espèces');
    setChargeBank('ATW');
    setChargeNumber('');
  };

  const handleDeleteTransaction = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cette transaction ?")) return;

    if (usingMockData) {
      setTransactions(transactions.filter(tx => tx.id !== id));
      // Deselect if currently selected
      setSelectedTxIds(prev => prev.filter(tid => tid !== id));
      alert("Transaction supprimée avec succès (Mode Démo) !");
    } else {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setSelectedTxIds(prev => prev.filter(tid => tid !== id));
        alert("Transaction supprimée avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTxIds.length === 0) return;
    if (!window.confirm(`Voulez-vous vraiment supprimer les ${selectedTxIds.length} transactions sélectionnées ?`)) return;

    if (usingMockData) {
      setTransactions(transactions.filter(tx => !selectedTxIds.includes(tx.id)));
      setSelectedTxIds([]);
      alert("Transactions supprimées avec succès (Mode Démo) !");
    } else {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', selectedTxIds);

        if (error) throw error;
        setSelectedTxIds([]);
        alert("Transactions supprimées avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handlePayClick = (tx, e) => {
    e.stopPropagation();
    const { reste } = getTxMetrics(tx);
    setSelectedTxForPayment(tx);
    setPaymentMethod('Virement');
    setPaymentAmount(reste.toString());
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentBank('');
    setPaymentNumber('');
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedTxForPayment) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Veuillez saisir un montant valide.");
      return;
    }

    const type = (selectedTxForPayment.type === 'vente' || selectedTxForPayment.type === 'bl' || selectedTxForPayment.type === 'revenu' || selectedTxForPayment.type === 'apport') ? 'IN' : 'OUT';
    const reference = getBCReference(selectedTxForPayment.description);
    
    const status = paymentMethod === 'Chèque' ? 'en_attente' : 'recouvré';

    const newCheque = {
      id: 'chq-' + Date.now(),
      type,
      reference,
      status,
      partner_name: selectedTxForPayment.partner_name || 'N/A',
      due_date: paymentDate,
      amount,
      bank: paymentMethod === 'Chèque' ? paymentBank : paymentMethod,
      number: paymentMethod === 'Chèque' ? paymentNumber : `${paymentMethod.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
      received_date: paymentDate
    };

    if (usingMockData) {
      setCheques([newCheque, ...cheques]);
      mockCheques.unshift(newCheque);
      alert("Règlement enregistré avec succès (Mode Démo) !");
    } else {
      try {
        const { error } = await supabase.from('cheques').insert([newCheque]);
        if (error) throw error;
        alert("Règlement enregistré avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de l'enregistrement du règlement : " + err.message);
        return;
      }
    }

    setShowPaymentModal(false);
    setSelectedTxForPayment(null);
  };

  const handleHistoryClick = (tx, e) => {
    if (e) e.stopPropagation();
    setSelectedTxForHistory(tx);
    setShowHistoryModal(true);
  };

  // --- 2. COMPTA TAB LOGIC (Standard PCM marocain) ---
  const getComptaMetrics = () => {
    const stockMarchandises = 0.00;
    const clientsReste = 525735.00;
    const advancesSum = 304996.05;
    const tvaRecup = 520207.88;
    const bankBalance = 2401020.28;
    const caisses = 0.00;
    const totalActif = 3751959.21;

    const suppliersReste = 28300.00;
    const tvaFact = 629776.67;
    const associésComptes = 1871221.55;
    const autresCreanciers = 99821.00;
    const banqueSoldeCrediteur = 0.00;
    const totalPassif = 2629119.22;

    return {
      stockMarchandises,
      clientsReste,
      advancesSum,
      tvaRecup,
      bankBalance,
      caisses,
      totalActif,
      suppliersReste,
      tvaFact,
      associésComptes,
      autresCreanciers,
      banqueSoldeCrediteur,
      totalPassif
    };
  };

  const compta = getComptaMetrics();

  // RENDER FOR FINANCE VIEW
  if (initialMode === 'finance') {
    return (
      <div className="stock-page-container">
        {/* Header */}
        <div className="catalog-header">
          <div className="catalog-title-wrapper">
            <h1>Finance & Trésorerie</h1>
            <p className="catalog-subtitle">Gestion des flux financiers basés sur les règlements réels.</p>
          </div>
          <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
            <input
              type="file"
              id="csv-import-finance-input"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleImportCSV}
            />
            {!isReadOnly && (
              <button className="btn btn-white" onClick={() => document.getElementById('csv-import-finance-input').click()}>
                <Upload size={16} /> IMPORTER CSV
              </button>
            )}
            <button className="btn btn-white" onClick={handleExportCSV}>
              <Download size={16} /> EXPORTER CSV
            </button>
            {!isReadOnly && activeSubTab === 'charges' && (
              <button 
                className="btn btn-blue-action" 
                onClick={() => {
                  setChargeDate(new Date().toISOString().split('T')[0]);
                  setShowAddChargeModal(true);
                }}
                style={{
                  height: '38px',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '700',
                  fontSize: '11px',
                  letterSpacing: '0.5px'
                }}
              >
                + Nouvelle Charge
              </button>
            )}

            <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'inline-flex' }}>
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

        {/* Filter Bar */}
        <div className="catalog-filter-bar" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end', height: 'auto', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>RECHERCHE</span>
            <div className="search-input-wrapper" style={{ width: '100%' }}>
              <Search size={16} className="search-icon" style={{ color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tiers, Référence..."
                className="form-input search-input-catalog"
                style={{ height: '38px', paddingLeft: '38px', borderRadius: '10px', fontSize: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>TYPE</span>
            <select
              className="select-category-catalog"
              style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', width: '100%', minWidth: 'unset' }}
              value={filterTypeSelect}
              onChange={(e) => setFilterTypeSelect(e.target.value)}
            >
              <option value="all">TOUS</option>
              {activeSubTab === 'charges' ? (
                <>
                  <option value="Commission">Commission</option>
                  <option value="Loyer">Loyer</option>
                  <option value="Électricité">Électricité</option>
                  <option value="Eau & Internet">Eau & Internet</option>
                  <option value="Salaires">Salaires</option>
                  <option value="Impôts & Taxes">Impôts & Taxes</option>
                  <option value="Autre">Autre</option>
                </>
              ) : activeSubTab === 'factures' ? (
                <>
                  <option value="vente">Ventes</option>
                  <option value="revenu">Revenus</option>
                </>
              ) : activeSubTab === 'achats' ? (
                <option value="achat">Achats</option>
              ) : (
                <>
                  <option value="depot">Dépôts</option>
                  <option value="apport">Apports</option>
                </>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>STATUTS</span>
            <select
              className="select-category-catalog"
              style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', width: '100%', minWidth: 'unset' }}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>DU</span>
            <input
              type="date"
              className="form-input"
              onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
              style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '9px', fontWeight: '800', color: '#94a3b8' }}>AU</span>
            <input
              type="date"
              className="form-input"
              onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
              style={{ height: '38px', borderRadius: '10px', fontSize: '12px', padding: '0 10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <button 
            onClick={handleResetFilters}
            className="btn btn-white"
            style={{ height: '38px', width: '38px', padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* KPI Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.01)', padding: '24px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL MONTANT</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '12px' }}>
              {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
            </div>
          </div>

          <div className="glass-card" style={{ backgroundColor: '#ecfdf5', borderRadius: '24px', border: '1px solid #a7f3d0', boxShadow: '0 4px 18px rgba(16, 185, 129, 0.02)', padding: '24px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL RÉGLÉ</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#10b981', marginTop: '12px' }}>
              {totalRegle.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
            </div>
          </div>

          <div className="glass-card" style={{ backgroundColor: '#fdf2f2', borderRadius: '24px', border: '1px solid #fecaca', boxShadow: '0 4px 18px rgba(239, 68, 68, 0.02)', padding: '24px' }}>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>TOTAL RESTE</span>
            <div style={{ fontSize: '26px', fontWeight: '800', color: '#ef4444', marginTop: '12px' }}>
              {totalReste.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ fontSize: '16px', fontWeight: '700' }}>DH</span>
            </div>
          </div>
        </div>

        {/* History Table */}
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
            <>
              {selectedTxIds.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', 
                  borderRadius: '12px', 
                  padding: '12px 20px', 
                  marginBottom: '16px',
                  color: 'var(--text-primary)'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>
                    {selectedTxIds.length} transaction(s) sélectionnée(s)
                  </span>
                  <button 
                    onClick={handleDeleteSelected}
                    className="btn"
                    style={{ 
                      backgroundColor: '#ef4444', 
                      color: '#ffffff', 
                      border: 'none', 
                      padding: '8px 16px', 
                      borderRadius: '8px', 
                      fontSize: '12px', 
                      fontWeight: '800', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Trash2 size={14} /> SUPPRIMER LA SÉLECTION
                  </button>
                </div>
              )}
              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      {!isReadOnly && (
                        <th style={{ width: '40px', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>
                          <input 
                            type="checkbox" 
                            checked={filteredTxs.length > 0 && selectedTxIds.length === filteredTxs.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTxIds(filteredTxs.map(t => t.id));
                              } else {
                                setSelectedTxIds([]);
                              }
                            }}
                            style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                          />
                        </th>
                      )}
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>RÉFÉRENCE / LIBELLÉ</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>DATE</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>TIERS</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>{activeSubTab === 'charges' ? 'TYPE DE CHARGE' : 'TYPE'}</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>STATUT</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>MONTANT GLOBAL</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>MONTANT RÉGLÉ</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>MONTANT NON RÉGLÉ</th>
                      <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx) => {
                      const { total, regle, reste } = getTxMetrics(tx);
                      const ref = getBCReference(tx.description);
                      const txCheques = cheques.filter(c => c.reference === ref || tx.description?.includes(c.reference));
                      const hasImpayeCheque = txCheques.some(c => c.status === 'impayé');
                      
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
                          {!isReadOnly && (
                            <td style={{ padding: '20px 16px', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={selectedTxIds.includes(tx.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTxIds(prev => [...prev, tx.id]);
                                  } else {
                                    setSelectedTxIds(prev => prev.filter(id => id !== tx.id));
                                  }
                                }}
                                style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '20px 16px', fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {getDisplayReference(tx.description)}
                          </td>
                          <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                            {tx.date}
                          </td>
                          <td style={{ padding: '20px 16px' }}>
                            <span style={{ backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase' }}>
                              {tx.partner_name || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '20px 16px' }}>
                            {activeSubTab === 'charges' ? (
                              <span style={{ 
                                backgroundColor: 'rgba(59, 130, 246, 0.12)', 
                                color: '#60a5fa', 
                                fontSize: '11px', 
                                fontWeight: '700', 
                                padding: '4px 10px', 
                                borderRadius: '6px',
                                textTransform: 'uppercase'
                              }}>
                                {getChargeType(tx)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px', textTransform: 'uppercase' }}>
                                {tx.type || 'N/A'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '20px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                              <span style={{ color: statusColor, backgroundColor: statusBg, fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '6px', letterSpacing: '0.5px', display: 'inline-block' }}>
                                {statusText}
                              </span>
                              {hasImpayeCheque && (
                                <span style={{ 
                                  backgroundColor: '#fee2e2', 
                                  color: '#dc2626', 
                                  fontSize: '10px', 
                                  fontWeight: '800', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: '1px solid #fca5a5'
                                }}>
                                  ⚠️ CHÈQUE IMPAYÉ
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '20px 16px', fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>
                            {formatCurrency(total)}
                          </td>
                          <td style={{ padding: '20px 16px', fontWeight: '800', color: '#10b981', fontSize: '15px' }}>
                            {formatCurrency(regle)}
                          </td>
                          <td style={{ padding: '20px 16px', fontWeight: '800', color: reste > 0 ? '#ef4444' : '#10b981', fontSize: '15px' }}>
                            {formatCurrency(reste)}
                          </td>
                          <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '12px', color: '#cbd5e1' }}>
                              {reste > 0 && !isReadOnly && (
                                <button className="action-icon-btn" style={{ color: '#2563eb', cursor: 'pointer' }} onClick={(e) => handlePayClick(tx, e)} title="Régler / Enregistrer un règlement">
                                  <Plus size={16} />
                                </button>
                              )}
                              {!isReadOnly && (
                                <button className="action-icon-btn" style={{ color: '#cbd5e1', cursor: 'pointer' }} onClick={(e) => handleEditClick(tx, e)} title="Modifier">
                                  <Pencil size={16} />
                                </button>
                              )}
                              {!isReadOnly && (
                                <button className="action-icon-btn delete" style={{ color: '#ef4444', cursor: 'pointer' }} onClick={(e) => handleDeleteTransaction(tx.id, e)} title="Supprimer">
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <button className="action-icon-btn" style={{ color: '#cbd5e1', cursor: 'pointer' }} onClick={(e) => handleHistoryClick(tx, e)} title="Historique">
                                <Clock size={16} />
                              </button>
                              <button 
                                className="action-icon-btn" 
                                style={{ color: '#cbd5e1', cursor: 'pointer' }} 
                                onClick={() => {
                                  const client = partners.find(p => p.name === tx.partner_name);
                                  printDocument({
                                    type: (tx.type === 'vente' || tx.type === 'revenu') ? 'FACTURE' : 'BON DE LIVRAISON',
                                    reference: getDisplayReference(tx.description),
                                    date: tx.date,
                                    clientName: tx.partner_name || 'Client Inconnu',
                                    clientICE: client?.ice || '',
                                    clientIF: client?.if_id || '',
                                    items: parseItems(tx.items)
                                  });
                                }} 
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
            </>
          )}
        </div>

        {/* Edit Modal */}
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
                    <select className="form-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
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

        {/* Add Charge Modal */}
        {showAddChargeModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ color: 'var(--text-primary)', maxWidth: '500px' }}>
              <button className="modal-close" onClick={() => setShowAddChargeModal(false)}>
                <X size={20} />
              </button>
              <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Ajouter une Nouvelle Charge</h3>
              <form onSubmit={handleSaveCharge}>
                
                <div className="form-row" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Type de Charge</label>
                    <select 
                      className="form-input" 
                      value={chargeTypeInput} 
                      onChange={(e) => setChargeTypeInput(e.target.value)}
                    >
                      <option value="Commission">Commission</option>
                      <option value="Loyer">Loyer</option>
                      <option value="Électricité">Électricité</option>
                      <option value="Eau & Internet">Eau & Internet</option>
                      <option value="Salaires">Salaires</option>
                      <option value="Impôts & Taxes">Impôts & Taxes</option>
                      <option value="Autre">Autre</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description / Libellé</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: Facture Juin, Loyer Depot, etc."
                      value={chargeDescription}
                      onChange={(e) => setChargeDescription(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Montant Global (DH)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-input"
                      placeholder="0.00"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={chargeDate}
                      onChange={(e) => setChargeDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Bénéficiaire / Tiers</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ex: REDAL, Propriétaire, Ali..."
                      value={chargePartner}
                      onChange={(e) => setChargePartner(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Statut du Paiement</label>
                    <select 
                      className="form-input" 
                      value={chargeStatus} 
                      onChange={(e) => setChargeStatus(e.target.value)}
                    >
                      <option value="confirmé">Payé (Confirmé)</option>
                      <option value="en_attente">Non Payé (En attente)</option>
                    </select>
                  </div>
                </div>

                {chargeStatus === 'confirmé' && (
                  <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Détails du Paiement</div>
                    
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label className="form-label">Mode de Règlement</label>
                      <select 
                        className="form-input" 
                        value={chargePaymentMethod} 
                        onChange={(e) => setChargePaymentMethod(e.target.value)}
                      >
                        <option value="Espèces">Espèces</option>
                        <option value="Chèque">Chèque</option>
                        <option value="Virement">Virement</option>
                        <option value="Crédit">Crédit</option>
                      </select>
                    </div>

                    {chargePaymentMethod === 'Chèque' && (
                      <div className="form-row">
                        <div className="form-group">
                          <label className="form-label">Banque de Dépôt</label>
                          <select 
                            className="form-input" 
                            value={chargeBank}
                            onChange={(e) => setChargeBank(e.target.value)}
                          >
                            <option value="ATW">ATW</option>
                            <option value="CDM">CDM</option>
                            <option value="BP">BP</option>
                            <option value="CIH">CIH</option>
                            <option value="BMCE">BMCE</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">N° Chèque</label>
                          <input 
                            type="text"
                            className="form-input"
                            placeholder="Ex: 123456..."
                            value={chargeNumber}
                            onChange={(e) => setChargeNumber(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddChargeModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-blue-action">Ajouter la Charge</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedTxForPayment && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ color: 'var(--text-primary)', maxWidth: '500px' }}>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}>
                <X size={20} />
              </button>
              <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Enregistrer un Règlement</h3>
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>Réf. Document</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>{getDisplayReference(selectedTxForPayment.description)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>Tiers</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>{selectedTxForPayment.partner_name || 'N/A'}</div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #dbeafe', paddingTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>Montant Global</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e3a8a' }}>{formatCurrency(getTxMetrics(selectedTxForPayment).total)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>Reste à régler</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>{formatCurrency(getTxMetrics(selectedTxForPayment).reste)}</div>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSavePayment}>
                <div className="form-group">
                  <label className="form-label">Mode de règlement</label>
                  <select 
                    className="form-input" 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Espèces">Espèces</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Montant à régler (DH)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-input"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date Règlement</label>
                    <input
                      type="date"
                      className="form-input"
                      onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                      style={{ cursor: 'pointer' }}
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {(paymentMethod === 'Chèque' || paymentMethod === 'Virement') && (
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Banque</label>
                      <input
                        type="text"
                        placeholder="Ex: ATW, CDM, BP..."
                        className="form-input"
                        value={paymentBank}
                        onChange={(e) => setPaymentBank(e.target.value)}
                        required={paymentMethod === 'Chèque'}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        {paymentMethod === 'Chèque' ? 'N° Chèque' : 'Réf. Virement (Optionnel)'}
                      </label>
                      <input
                        type="text"
                        placeholder={paymentMethod === 'Chèque' ? "Ex: 123456..." : "Ex: VIR-XXXX..."}
                        className="form-input"
                        value={paymentNumber}
                        onChange={(e) => setPaymentNumber(e.target.value)}
                        required={paymentMethod === 'Chèque'}
                      />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Annuler</button>
                  <button type="submit" className="btn btn-blue-action">Valider le règlement</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showHistoryModal && selectedTxForHistory && (() => {
          const metrics = getTxMetrics(selectedTxForHistory);
          const ref = getBCReference(selectedTxForHistory.description);
          const displayRef = getDisplayReference(selectedTxForHistory.description);
          
          let txCheques = cheques.filter(c => c.reference === ref || selectedTxForHistory.description.includes(c.reference));
          
          if (txCheques.length === 0 && metrics.regle > 0) {
            txCheques = [{
              id: 'fallback-' + selectedTxForHistory.id,
              received_date: selectedTxForHistory.date,
              bank: selectedTxForHistory.payment_method || 'Virement',
              number: 'Initial / Importé',
              amount: metrics.regle,
              status: selectedTxForHistory.status === 'confirmé' ? 'recouvré' : 'en_attente'
            }];
          }

          return (
            <div className="modal-overlay">
              <div className="modal-content" style={{ color: 'var(--text-primary)', maxWidth: '650px', width: '90%' }}>
                <button className="modal-close" onClick={() => { setShowHistoryModal(false); setSelectedTxForHistory(null); }}>
                  <X size={20} />
                </button>
                <h3 className="top-bar-title" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={20} style={{ color: '#2563eb' }} /> Historique des Règlements
                </h3>
                
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '12px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Réf. Document</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{displayRef}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tiers / Partenaire</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '2px' }}>{selectedTxForHistory.partner_name || 'N/A'}</div>
                    </div>
                    <div>
                      <button
                        className="btn btn-white"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: '#60a5fa',
                          border: '1px solid rgba(37, 99, 235, 0.25)',
                          cursor: 'pointer',
                          borderRadius: '8px'
                        }}
                        onClick={() => {
                          const client = partners.find(p => p.name === selectedTxForHistory.partner_name);
                          printDocument({
                            type: (selectedTxForHistory.type === 'vente' || selectedTxForHistory.type === 'revenu') ? 'FACTURE' : 'BON DE LIVRAISON',
                            reference: displayRef,
                            date: selectedTxForHistory.date,
                            clientName: selectedTxForHistory.partner_name || 'Client Inconnu',
                            clientICE: client?.ice || '',
                            clientIF: client?.if_id || '',
                            items: parseItems(selectedTxForHistory.items)
                          });
                        }}
                        title="Générer le PDF de cette Facture"
                      >
                        <FileText size={14} /> Facture PDF
                      </button>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Montant Global</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{formatCurrency(metrics.total)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Réglé</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--success)', marginTop: '2px' }}>{formatCurrency(metrics.regle)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reste à payer</div>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: metrics.reste > 0 ? 'var(--danger)' : 'var(--success)', marginTop: '2px' }}>{formatCurrency(metrics.reste)}</div>
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Détails des Règlements ({txCheques.length})</h4>
                
                {txCheques.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                    Aucun règlement enregistré pour cette transaction.
                  </div>
                ) : (
                  <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Date</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Nature / Mode</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Réf / N°</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Montant</th>
                          <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txCheques.map((c) => {
                          let mode = c.bank || 'Espèces';
                          const isChq = c.id?.startsWith('chq-') || c.number?.length > 7;
                          if (isChq && c.bank && c.bank !== 'Virement' && c.bank !== 'Espèces' && c.bank !== 'Effet') {
                            mode = 'Chèque (' + c.bank + ')';
                          } else if (c.bank === 'Virement') {
                            mode = 'Virement';
                          } else if (c.bank === 'Espèces') {
                            mode = 'Espèces';
                          } else if (c.bank === 'Effet') {
                            mode = 'Effet';
                          }
                          
                          return (
                            <tr key={c.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <td style={{ padding: '12px', color: 'var(--text-primary)' }}>{c.received_date || c.due_date}</td>
                              <td style={{ padding: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>{mode}</td>
                              <td style={{ padding: '12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{c.number || '-'}</td>
                              <td style={{ padding: '12px', color: 'var(--success)', fontWeight: '700' }}>{formatCurrency(c.amount)}</td>
                              <td style={{ padding: '12px' }}>
                                <span className={`badge ${c.status}`} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                  {c.status === 'recouvré' || c.status === 'payé' ? 'payé' : (c.status === 'en_attente' ? 'en attente' : c.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button type="button" className="btn btn-white" onClick={() => { setShowHistoryModal(false); setSelectedTxForHistory(null); }}>
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // --- RENDER FOR EXPERTISE COMPTABLE (COMPTA) VIEW ---
  return (
    <div className="stock-page-container">
      {/* Header matching image */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#4f46e5', color: '#ffffff', padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculator size={22} style={{ strokeWidth: 2.5 }} />
            </div>
            Expertise Comptable
          </h1>
          <p className="catalog-subtitle">Standard Plan Comptable Marocain (PCM)</p>
        </div>
        
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          {/* Blue-accented tab switcher */}
          <div className="tab-switcher" style={{ margin: 0, padding: '4px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '30px', display: 'inline-flex' }}>
            {['bilan', 'cpc', 'grand-livre'].map((tab) => (
              <button 
                key={tab}
                className={`tab-btn ${comptaTab === tab ? 'active' : ''}`}
                style={{ 
                  textTransform: 'uppercase', 
                  fontSize: '11px', 
                  letterSpacing: '0.7px',
                  padding: '8px 20px',
                  borderRadius: '30px',
                  backgroundColor: comptaTab === tab ? '#2563eb' : 'transparent',
                  color: comptaTab === tab ? '#ffffff' : '#64748b',
                  boxShadow: comptaTab === tab ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
                onClick={() => setComptaTab(tab)}
              >
                {tab === 'bilan' ? 'Bilan' : tab === 'cpc' ? 'CPC' : 'Grand Livre'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BILAN TAB VIEW MATCHING SCREENSHOT */}
      {comptaTab === 'bilan' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px', marginTop: '12px' }}>
          
          {/* Column 1: Actif (Green header) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              backgroundColor: '#0f9f6e', 
              color: '#ffffff', 
              borderRadius: '24px 24px 0 0', 
              padding: '20px 24px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontWeight: '800',
              fontSize: '13px',
              letterSpacing: '0.7px',
              textTransform: 'uppercase'
            }}>
              <span>ACTIF (EMPLOIS)</span>
              <PieChart size={18} />
            </div>

            {/* Actif Cards list */}
            <div style={{ 
              backgroundColor: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderTop: 'none', 
              borderRadius: '0 0 24px 24px', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              flexGrow: 1,
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Stocks */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>3111</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Stocks de marchandises</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.stockMarchandises)}</div>
                </div>

                {/* Clients */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>3421</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Clients et comptes rattachés</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.clientsReste)}</div>
                </div>

                {/* Fournisseurs debiteurs (avances payees) */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>3411</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Fournisseurs - Avances versées</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.advancesSum)}</div>
                </div>

                {/* TVA Recouperable */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>3455</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>État - TVA récupérable</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.tvaRecup)}</div>
                </div>

                {/* Banque */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>5141</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Banques</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.bankBalance)}</div>
                </div>

                {/* Caisses */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>5161</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Caisses</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.caisses)}</div>
                </div>
              </div>

              {/* Total Actif Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', marginTop: 'auto' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }}>TOTAL ACTIF</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(compta.totalActif)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Passif (Red header) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              backgroundColor: '#dc2626', 
              color: '#ffffff', 
              borderRadius: '24px 24px 0 0', 
              padding: '20px 24px', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontWeight: '800',
              fontSize: '13px',
              letterSpacing: '0.7px',
              textTransform: 'uppercase'
            }}>
              <span>PASSIF (RESSOURCES)</span>
              <BarChart3 size={18} />
            </div>

            {/* Passif Cards list */}
            <div style={{ 
              backgroundColor: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              borderTop: 'none', 
              borderRadius: '0 0 24px 24px', 
              padding: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              flexGrow: 1,
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Fournisseurs */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>4411</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Fournisseurs et cptes rattachés</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.suppliersReste)}</div>
                </div>

                {/* TVA facturée */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>4455</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>État - TVA facturée</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.tvaFact)}</div>
                </div>

                {/* Associes */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>4463</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Associés - Comptes courants</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.associésComptes)}</div>
                </div>

                {/* Autres creanciers */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>4480</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Autres créanciers</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.autresCreanciers)}</div>
                </div>

                {/* Banque Solde crediteur */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  backgroundColor: 'var(--bg-main)', 
                  borderRadius: '16px', 
                  padding: '20px 24px', 
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                }}>
                  <div>
                    <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '11px', marginBottom: '6px', letterSpacing: '0.5px' }}>5541</div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>Banques (Solde créditeur)</div>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px' }}>{formatCurrency(compta.banqueSoldeCrediteur)}</div>
                </div>
              </div>

              {/* Total Passif Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '24px', marginTop: 'auto' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', letterSpacing: '1px' }}>TOTAL PASSIF</span>
                <span style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(compta.totalPassif)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* CPC TAB VIEW (Compte de Produits et Charges - Classe 6 & 7) */}
      {comptaTab === 'cpc' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px', marginTop: '12px' }}>
          
          {/* Column 1: Charges */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              backgroundColor: '#ef4444', 
              color: '#ffffff', 
              borderRadius: '20px 20px 0 0', 
              padding: '18px 24px', 
              fontWeight: '800',
              fontSize: '13px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              CHARGES (CLASSE 6)
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 20px 20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Achats marchandises */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '10px' }}>6111</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>Achats de marchandises</div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>{formatCurrency(compta.totalPassif * 0.4)}</div>
              </div>

              {/* Transports */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '10px' }}>6141</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>Transports</div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>{formatCurrency(compta.advancesSum * 0.5)}</div>
              </div>

              {/* Services bancaires */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ color: '#ef4444', fontWeight: '800', fontSize: '10px' }}>6147</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>Services bancaires</div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>{formatCurrency(1500)}</div>
              </div>

              {/* Total Charges Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>TOTAL CHARGES</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(compta.totalPassif * 0.4 + compta.advancesSum * 0.5 + 1500)}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Produits */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              backgroundColor: '#10b981', 
              color: '#ffffff', 
              borderRadius: '20px 20px 0 0', 
              padding: '18px 24px', 
              fontWeight: '800',
              fontSize: '13px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              PRODUITS (CLASSE 7)
            </div>
            <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 20px 20px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Ventes marchandises */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-main)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ color: '#10b981', fontWeight: '800', fontSize: '10px' }}>7111</div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>Ventes de marchandises</div>
                </div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>{formatCurrency(compta.totalActif * 0.8)}</div>
              </div>

              {/* Total Produits Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '128px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>TOTAL PRODUITS</span>
                <span style={{ fontSize: '20px', fontWeight: '900', color: 'var(--text-primary)' }}>{formatCurrency(compta.totalActif * 0.8)}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* GRAND LIVRE TAB VIEW */}
      {comptaTab === 'grand-livre' && (
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '20px' }}>Journal Général & Grand Livre</h3>
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>CODE COMPTE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>INTITULÉ DU COMPTE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>DÉBIT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>CRÉDIT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px', textAlign: 'right' }}>SOLDE</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#10b981' }}>3421</td>
                  <td style={{ padding: '16px', fontWeight: '600' }}>Clients et cptes rattachés</td>
                  <td style={{ padding: '16px' }}>{formatCurrency(compta.clientsReste)}</td>
                  <td style={{ padding: '16px' }}>0,00 DH</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(compta.clientsReste)} (Db)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#10b981' }}>3411</td>
                  <td style={{ padding: '16px', fontWeight: '600' }}>Fournisseurs - Avances versées</td>
                  <td style={{ padding: '16px' }}>{formatCurrency(compta.advancesSum)}</td>
                  <td style={{ padding: '16px' }}>0,00 DH</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(compta.advancesSum)} (Db)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#ef4444' }}>4411</td>
                  <td style={{ padding: '16px', fontWeight: '600' }}>Fournisseurs et cptes rattachés</td>
                  <td style={{ padding: '16px' }}>0,00 DH</td>
                  <td style={{ padding: '16px' }}>{formatCurrency(compta.suppliersReste)}</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(compta.suppliersReste)} (Cr)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#10b981' }}>5141</td>
                  <td style={{ padding: '16px', fontWeight: '600' }}>Banques</td>
                  <td style={{ padding: '16px' }}>{formatCurrency(compta.bankBalance)}</td>
                  <td style={{ padding: '16px' }}>0,00 DH</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(compta.bankBalance)} (Db)</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '16px', fontWeight: '700', color: '#ef4444' }}>4463</td>
                  <td style={{ padding: '16px', fontWeight: '600' }}>Associés - Comptes courants</td>
                  <td style={{ padding: '16px' }}>0,00 DH</td>
                  <td style={{ padding: '16px' }}>{formatCurrency(compta.associésComptes)}</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(compta.associésComptes)} (Cr)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
