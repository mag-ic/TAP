import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockSavTickets, mockPartners, mockStock } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Pencil, Download, Trash2, FileText, X } from 'lucide-react';
import { useIsReadOnly } from '../lib/UserContext';

export default function SAV() {
  const isReadOnly = useIsReadOnly();
  const [tickets, setTickets] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });

  // Form states
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [panneText, setPanneText] = useState('');

  // Details/Edit modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editCost, setEditCost] = useState('0');
  const [editSolution, setEditSolution] = useState('');

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sav_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error('DB tables missing');

      setTickets(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTickets(mockSavTickets);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const { data: pData } = await supabase.from('partners').select('*').eq('type', 'client');
      const { data: sData } = await supabase.from('inventaire').select('*');
      setPartners(pData || []);
      
      const mappedStock = sData?.map(item => ({
        ...item,
        declassedStock: item.declassedstock !== undefined ? item.declassedstock : item.declassedStock
      })) || [];
      setProducts(mappedStock);
    } catch (err) {
      setPartners(mockPartners);
      setProducts(mockStock);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchInitialData();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!selectedClient || !selectedProduct || !panneText) return;

    const client = partners.find(p => p.id === selectedClient);
    const product = products.find(p => p.id === selectedProduct);
    if (!client || !product) return;

    const newTicket = {
      id: 'sav-' + Math.floor(Math.random() * 100000000000),
      client_name: client.name,
      client_id: client.id,
      product_name: product.name,
      product_id: product.id,
      ticket_number: 'SAV-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
      description: panneText,
      solution: null,
      cost: 0,
      status: 'ouvert',
      created_at: newDate,
      updated_at: newDate
    };

    if (usingMockData) {
      setTickets([newTicket, ...tickets]);
    } else {
      try {
        const { error } = await supabase.from('sav_tickets').insert([newTicket]);
        if (error) throw error;
        await fetchTickets();
      } catch (err) {
        alert("Erreur lors de l'insertion : " + err.message);
      }
    }

    // Reset Form
    setPanneText('');
    setSelectedClient('');
    setSelectedProduct('');
  };

  const handleOpenDetails = (ticket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditCost(ticket.cost ? ticket.cost.toString() : '0');
    setEditSolution(ticket.solution || '');
    setShowDetailsModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (usingMockData) {
      if (selectedTicket.status !== 'en_cours' && editStatus === 'en_cours') {
        const prod = mockStock.find(p => p.id === selectedTicket.product_id);
        if (prod) {
          prod.declassedStock = (prod.declassedStock || 0) + 1;
        }
      }
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { 
        ...t, 
        status: editStatus, 
        cost: Number(editCost) || 0,
        solution: editSolution || null
      } : t));
    } else {
      try {
        if (selectedTicket.status !== 'en_cours' && editStatus === 'en_cours') {
          const { data: stockData } = await supabase
            .from('inventaire')
            .select('declassedstock')
            .eq('id', selectedTicket.product_id)
            .single();

          if (stockData) {
            const newQty = (stockData.declassedstock || 0) + 1;
            await supabase
              .from('inventaire')
              .update({ declassedstock: newQty })
              .eq('id', selectedTicket.product_id);
          }
        }

        const { error } = await supabase
          .from('sav_tickets')
          .update({ 
            status: editStatus,
            cost: Number(editCost) || 0,
            solution: editSolution || null
          })
          .eq('id', selectedTicket.id);

        if (error) throw error;
        await fetchTickets();
      } catch (err) {
        alert("Erreur lors de la mise à jour : " + err.message);
      }
    }

    setShowDetailsModal(false);
    setSelectedTicket(null);
  };

  const handleDeleteTicket = async (ticketId, e) => {
    e.stopPropagation();
    if (!confirm("Voulez-vous vraiment supprimer ce dossier SAV ?")) return;

    if (usingMockData) {
      setTickets(prev => prev.filter(t => t.id !== ticketId));
    } else {
      try {
        const { error } = await supabase
          .from('sav_tickets')
          .delete()
          .eq('id', ticketId);

        if (error) throw error;
        await fetchTickets();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['N Dossier', 'Client', 'Produit', 'Description', 'Statut', 'Frais', 'Solution', 'Date'];
    const rows = tickets.map(t => [
      t.ticket_number || '',
      `"${t.client_name || ''}"`,
      `"${t.product_name || ''}"`,
      `"${t.description || ''}"`,
      t.status === 'ouvert' ? 'Diagnostic' : t.status === 'en_cours' ? 'Échange' : 'Clôturé',
      t.cost || 0,
      `"${t.solution || ''}"`,
      t.created_at || ''
    ]);

    const csvContent = "\ufeff" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sav_dossiers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFrais = (cost) => {
    const formatted = Number(cost).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
    return `${formatted} DH`;
  };

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

  const sortedTickets = React.useMemo(() => {
    let sortableItems = [...tickets];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'cost') {
          return sortConfig.direction === 'asc' ? Number(valA || 0) - Number(valB || 0) : Number(valB || 0) - Number(valA || 0);
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [tickets, sortConfig]);

  return (
    <div style={{ color: 'var(--text-primary)' }}>
      {/* Header matching image */}
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={22} style={{ strokeWidth: 2.5 }} />
            </div>
            Service Après-Vente
          </h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '500', marginTop: '4px' }}>
            Suivez les retours, réparations et garanties clients.
          </p>
        </div>
        
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
            <Download size={16} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* New Ticket Form Card */}
      {!isReadOnly && (
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 20px 0' }}>
            Nouveau Dossier SAV
          </h3>
          
          <form onSubmit={handleCreateTicket}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr 3fr 1fr', gap: '16px', alignItems: 'end' }}>
              {/* Date */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Date</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                  style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '40px', boxSizing: 'border-box', cursor: 'pointer' }}
                />
              </div>

              {/* Client */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  required
                  style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '40px', boxSizing: 'border-box' }}
                >
                  <option value="" style={{ backgroundColor: 'var(--bg-card)' }}>Choisir...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)' }}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Product */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Produit</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  required
                  style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '40px', boxSizing: 'border-box' }}
                >
                  <option value="" style={{ backgroundColor: 'var(--bg-card)' }}>Choisir...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} style={{ backgroundColor: 'var(--bg-card)' }}>
                      {p.name} ({p.sku}) - Stock: {p.stock} (Neuf) / {p.declassedStock || 0} (Déclassé)
                    </option>
                  ))}
                </select>
              </div>

              {/* Panne (Issue) */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Panne</label>
                <input
                  type="text"
                  placeholder="..."
                  value={panneText}
                  onChange={(e) => setPanneText(e.target.value)}
                  required
                  style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '40px', boxSizing: 'border-box' }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '30px',
                  padding: '12px 24px',
                  fontWeight: '800',
                  fontSize: '12px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.2s'
                }}
              >
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tickets List Table Card */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600' }}>Chargement des données...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('id')}>N° DOSSIER{getSortIndicator('id')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('client_name')}>CLIENT{getSortIndicator('client_name')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('product_name')}>PRODUIT{getSortIndicator('product_name')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('status')}>STATUT{getSortIndicator('status')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('cost')}>FRAIS{getSortIndicator('cost')}</th>
                  <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'right', padding: '16px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortedTickets.map((t) => {
                  let statusBg = 'rgba(255, 255, 255, 0.08)';
                  let statusColor = 'var(--text-secondary)';
                  let statusLabel = 'CLÔTURÉ';

                  if (t.status === 'en_cours') {
                    statusBg = 'rgba(168, 85, 247, 0.15)';
                    statusColor = '#c084fc';
                    statusLabel = 'ÉCHANGE';
                  } else if (t.status === 'ouvert') {
                    statusBg = 'rgba(245, 158, 11, 0.15)';
                    statusColor = '#fbbf24';
                    statusLabel = 'DIAGNOSTIC';
                  }

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {t.ticket_number}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {t.client_name}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {t.product_name}
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
                      <td style={{ padding: '16px 12px', fontWeight: '800', color: '#ef4444', fontSize: '15px' }}>
                        {formatFrais(t.cost)}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
                          <button
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                            onClick={() => alert(`Résumé du dossier:\nN°: ${t.ticket_number}\nClient: ${t.client_name}\nPanne: ${t.description || 'N/A'}\nFrais: ${formatFrais(t.cost)}\nSolution: ${t.solution || 'N/A'}`)}
                            title="Aperçu rapide"
                          >
                            <FileText size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenDetails(t)}
                            style={{
                              border: 'none',
                              backgroundColor: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              borderRadius: '30px',
                              padding: '6px 16px',
                              fontWeight: '800',
                              fontSize: '11px',
                              letterSpacing: '0.5px',
                              cursor: 'pointer',
                              textTransform: 'uppercase'
                            }}
                          >
                            Détails
                          </button>

                          {!isReadOnly && (
                            <button
                              onClick={(e) => handleDeleteTicket(t.id, e)}
                              style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: '600' }}>
                      Aucun dossier SAV enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details / Edit Modal */}
      {showDetailsModal && selectedTicket && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '24px', padding: '28px', width: '450px', border: '1px solid var(--border-color)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Dossier {selectedTicket.ticket_number}</h3>
              <button style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowDetailsModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '16px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>Informations</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700' }}>Client: {selectedTicket.client_name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Produit: {selectedTicket.product_name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '700', marginTop: '4px' }}>Panne: {selectedTicket.description}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Statut</label>
                  <select 
                    className="form-input" 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    disabled={isReadOnly}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  >
                    <option value="ouvert" style={{ backgroundColor: 'var(--bg-card)' }}>Diagnostic</option>
                    <option value="en_cours" style={{ backgroundColor: 'var(--bg-card)' }}>Échange</option>
                    <option value="résolu" style={{ backgroundColor: 'var(--bg-card)' }}>Clôturé</option>
                  </select>
                </div>
 
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Frais intervention (DH)</label>
                  <input 
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    disabled={isReadOnly}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
 
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>Solution Apportée</label>
                <input 
                  type="text"
                  placeholder="Solution..."
                  value={editSolution}
                  onChange={(e) => setEditSolution(e.target.value)}
                  disabled={isReadOnly}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' }}
                />
              </div>
 
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetailsModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer' }}>{isReadOnly ? 'Fermer' : 'Annuler'}</button>
                {!isReadOnly && (
                  <button type="submit" className="btn btn-blue-action" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', cursor: 'pointer' }}>Enregistrer</button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
