import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockSavTickets } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { ClipboardEdit, Search, Plus, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SAV() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [clientName, setClientName] = useState('');
  const [equipment, setEquipment] = useState('');
  const [issue, setIssue] = useState('');
  const [cost, setCost] = useState('0');
  const [solution, setSolution] = useState('');
  const [priority, setPriority] = useState('moyenne');

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

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!clientName || !equipment || !issue) return;

    const newTicket = {
      id: 'sav-' + Math.floor(Math.random() * 100000000000),
      client_name: clientName,
      client_phone: null,
      equipment,
      issue,
      cost: parseFloat(cost) || 0,
      solution: solution || null,
      status: 'ouvert',
      priority,
      ticket_number: 'SAV-' + Math.floor(Math.random() * 1000000),
      created_at: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString().split('T')[0]
    };

    if (usingMockData) {
      setTickets([newTicket, ...tickets]);
    } else {
      const { error } = await supabase.from('sav_tickets').insert([newTicket]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchTickets();
      }
    }

    // Reset Form
    setClientName('');
    setEquipment('');
    setIssue('');
    setCost('0');
    setSolution('');
    setShowModal(false);
  };

  const handleUpdateStatus = async (ticketId, nextStatus) => {
    if (usingMockData) {
      setTickets(tickets.map(t => t.id === ticketId ? { ...t, status: nextStatus } : t));
    } else {
      const { error } = await supabase
        .from('sav_tickets')
        .update({ status: nextStatus })
        .eq('id', ticketId);
      if (error) {
        alert("Erreur de mise à jour : " + error.message);
      } else {
        fetchTickets();
      }
    }
  };

  // Filters
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.client_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.equipment.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.ticket_number && t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const openTicketsCount = tickets.filter(t => t.status === 'ouvert').length;
  const inProgressTicketsCount = tickets.filter(t => t.status === 'en_cours').length;

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardEdit size={24} style={{ color: 'var(--primary)' }} /> Service Après-Vente (SAV)
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchTickets}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Ouvrir un Ticket
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper danger">
            <AlertCircle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Tickets Non Résolus</span>
            <span className="kpi-value">{openTicketsCount} ticket{openTicketsCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper warning">
            <RefreshCw size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Interventions en Cours</span>
            <span className="kpi-value">{inProgressTicketsCount} ticket{inProgressTicketsCount > 1 ? 's' : ''}</span>
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
              placeholder="Rechercher par client, équipement, n° ticket..."
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
            <option value="ouvert">Diagnostic</option>
            <option value="en_cours">Échange</option>
            <option value="résolu">Clôturé</option>
          </select>
        </div>
      </div>

      {/* Tickets List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>N° Ticket</th>
                  <th>Client</th>
                  <th>Matériel</th>
                  <th>Problème (Panne)</th>
                  <th>Solution Apportée</th>
                  <th>Coût intervention</th>
                  <th>Date Création</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{ticket.ticket_number}</td>
                    <td style={{ fontWeight: '600' }}>{ticket.client_name}</td>
                    <td style={{ fontWeight: '500' }}>{ticket.equipment || ticket.product_name}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ticket.description}</td>
                    <td style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '500' }}>{ticket.solution || '-'}</td>
                    <td style={{ fontWeight: '600' }}>{formatCurrency(ticket.cost)}</td>
                    <td>{ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : '-'}</td>
                    <td>
                      <span className={`badge ${ticket.status}`}>
                        {ticket.status === 'ouvert' ? 'Diagnostic' : (ticket.status === 'en_cours' ? 'Échange' : 'Clôturé')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        {ticket.status === 'ouvert' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => handleUpdateStatus(ticket.id, 'en_cours')}
                          >
                            Diagnostiquer
                          </button>
                        )}
                        {ticket.status === 'en_cours' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px', borderColor: 'var(--success)', color: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(ticket.id, 'résolu')}
                          >
                            Clôturer
                          </button>
                        )}
                        {ticket.status === 'résolu' && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Clôturé</span>
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

      {/* Modal for new ticket */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Ouvrir un Ticket SAV</h3>
            <form onSubmit={handleCreateTicket}>
              <div className="form-group">
                <label className="form-label">Nom du Client</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: BOUCHAIB DAIKO"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Matériel / Équipement</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: SV7900WF SIVIR"
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Coût intervention HT (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description du problème (Panne)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  required
                  placeholder="Panne constatée..."
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Solution envisagée / apportée</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: ECHANGE"
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                />
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
