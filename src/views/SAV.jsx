import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockSavTickets, mockPartners, mockStock } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Pencil, Download, Trash2, FileText, X } from 'lucide-react';

export default function SAV() {
  const [tickets, setTickets] = useState([]);
  const [partners, setPartners] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMockData, setUsingMockData] = useState(false);

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
      const { data: sData } = await supabase.from('stock').select('*');
      setPartners(pData || []);
      setProducts(sData || []);
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
      setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { 
        ...t, 
        status: editStatus, 
        cost: Number(editCost) || 0,
        solution: editSolution || null
      } : t));
    } else {
      try {
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

  return (
    <div style={{ color: '#1f2937' }}>
      {/* Header matching image */}
      <div className="catalog-header" style={{ marginBottom: '28px' }}>
        <div className="catalog-title-wrapper">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            <div style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={22} style={{ strokeWidth: 2.5 }} />
            </div>
            Service Après-Vente
          </h1>
          <p className="catalog-subtitle" style={{ fontSize: '14px', color: '#64748b', fontWeight: '500', marginTop: '4px' }}>
            Suivez les retours, réparations et garanties clients.
          </p>
        </div>
        
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#334155', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
            <Download size={16} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* New Ticket Form Card */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: '0 0 20px 0' }}>
          Nouveau Dossier SAV
        </h3>
        
        <form onSubmit={handleCreateTicket}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1.5fr 3fr 1fr', gap: '16px', alignItems: 'end' }}>
            {/* Date */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: '#f8fafc', height: '40px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Client */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                required
                style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: '#f8fafc', height: '40px', boxSizing: 'border-box' }}
              >
                <option value="">Choisir...</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Product */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Produit</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                required
                style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: '#f8fafc', height: '40px', boxSizing: 'border-box' }}
              >
                <option value="">Choisir...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Panne (Issue) */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Panne</label>
              <input
                type="text"
                placeholder="..."
                value={panneText}
                onChange={(e) => setPanneText(e.target.value)}
                required
                style={{ width: '100%', borderRadius: '10px', padding: '10px 14px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600', backgroundColor: '#f8fafc', height: '40px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                backgroundColor: '#dc2626',
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

      {/* Tickets List Table Card */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0,0,0,0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>Chargement des données...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>N° DOSSIER</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>CLIENT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>PRODUIT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>STATUT</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'left', padding: '16px 12px' }}>FRAIS</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', textAlign: 'right', padding: '16px 12px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => {
                  let statusBg = '#f1f5f9';
                  let statusColor = '#475569';
                  let statusLabel = 'CLÔTURÉ';

                  if (t.status === 'en_cours') {
                    statusBg = '#f3e8ff';
                    statusColor = '#6b21a8';
                    statusLabel = 'ÉCHANGE';
                  } else if (t.status === 'ouvert') {
                    statusBg = '#fef3c7';
                    statusColor = '#b45309';
                    statusLabel = 'DIAGNOSTIC';
                  }

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: '#1f2937', fontSize: '14px' }}>
                        {t.ticket_number}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: '#1f2937', fontSize: '14px' }}>
                        {t.client_name}
                      </td>
                      <td style={{ padding: '16px 12px', fontWeight: '700', color: '#1f2937', fontSize: '14px' }}>
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
                      <td style={{ padding: '16px 12px', fontWeight: '800', color: '#dc2626', fontSize: '15px' }}>
                        {formatFrais(t.cost)}
                      </td>
                      <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px', justifyContent: 'flex-end' }}>
                          <button
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                            onClick={() => alert(`Résumé du dossier:\nN°: ${t.ticket_number}\nClient: ${t.client_name}\nPanne: ${t.description || 'N/A'}\nFrais: ${formatFrais(t.cost)}\nSolution: ${t.solution || 'N/A'}`)}
                            title="Aperçu rapide"
                          >
                            <FileText size={16} />
                          </button>

                          <button
                            onClick={() => handleOpenDetails(t)}
                            style={{
                              border: 'none',
                              backgroundColor: '#eff6ff',
                              color: '#2563eb',
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

                          <button
                            onClick={(e) => handleDeleteTicket(t.id, e)}
                            style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#cbd5e1' }}
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
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
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)', zIndex: 1000 }}>
          <div className="modal-content" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '28px', width: '450px', border: '1px solid #e2e8f0', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Dossier {selectedTicket.ticket_number}</h3>
              <button style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setShowDetailsModal(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit}>
              <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '16px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>Informations</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700' }}>Client: {selectedTicket.client_name}</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Produit: {selectedTicket.product_name}</div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>Panne: {selectedTicket.description}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: '#475569', marginBottom: '6px', display: 'block' }}>Statut</label>
                  <select 
                    className="form-input" 
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600' }}
                  >
                    <option value="ouvert">Diagnostic</option>
                    <option value="en_cours">Échange</option>
                    <option value="résolu">Clôturé</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: '#475569', marginBottom: '6px', display: 'block' }}>Frais intervention (DH)</label>
                  <input 
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '11px', color: '#475569', marginBottom: '6px', display: 'block' }}>Solution Apportée</label>
                <input 
                  type="text"
                  placeholder="Solution..."
                  value={editSolution}
                  onChange={(e) => setEditSolution(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '600' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetailsModal(false)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', cursor: 'pointer' }}>Annuler</button>
                <button type="submit" className="btn btn-blue-action" style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', border: 'none', backgroundColor: '#2563eb', color: '#ffffff', cursor: 'pointer' }}>Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
