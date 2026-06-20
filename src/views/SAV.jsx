import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [clientPhone, setClientPhone] = useState('');
  const [equipment, setEquipment] = useState('');
  const [issue, setIssue] = useState('');
  const [priority, setPriority] = useState('moyenne');
  const [assignedTechnician, setAssignedTechnician] = useState('');

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
      setTickets([
        { id: '1', client_name: 'Pierre Durant', client_phone: '+33 6 5555 4444', equipment: 'Chaudière Gaz Frisquet', issue: 'Bruit suspect et baisse de pression', status: 'en_cours', priority: 'élevée', assigned_technician: 'Thomas Martin', created_at: new Date().toISOString() },
        { id: '2', client_name: 'Alice Blanc', client_phone: '+33 6 4444 3333', equipment: 'Climatisation Daikin', issue: 'Ne refroidit plus', status: 'ouvert', priority: 'moyenne', assigned_technician: '', created_at: new Date().toISOString() },
        { id: '3', client_name: 'Robert Martin', client_phone: '+33 6 3333 2222', equipment: 'Tableau Électrique', issue: 'Court-circuit sur le circuit cuisine', status: 'résolu', priority: 'élevée', assigned_technician: 'Thomas Martin', created_at: new Date().toISOString() }
      ]);
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
      client_name: clientName,
      client_phone: clientPhone || null,
      equipment,
      issue,
      status: 'ouvert',
      priority,
      assigned_technician: assignedTechnician || null
    };

    if (usingMockData) {
      const mockNewTicket = {
        ...newTicket,
        id: Math.random().toString(),
        created_at: new Date().toISOString()
      };
      setTickets([mockNewTicket, ...tickets]);
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
    setClientPhone('');
    setEquipment('');
    setIssue('');
    setPriority('moyenne');
    setAssignedTechnician('');
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
                          t.issue.toLowerCase().includes(searchTerm.toLowerCase());
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
            <span className="kpi-label">Tickets Non Assignés</span>
            <span className="kpi-value">{openTicketsCount} ticket{openTicketsCount > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon-wrapper warning">
            <RefreshCw size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Interventions en cours</span>
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
              placeholder="Rechercher par client, équipement, problème..."
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
            <option value="ouvert">Ouvert</option>
            <option value="en_cours">En Cours</option>
            <option value="résolu">Résolu</option>
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
                  <th>Client</th>
                  <th>Équipement</th>
                  <th>Problème signalé</th>
                  <th>Priorité</th>
                  <th>Technicien</th>
                  <th>Statut</th>
                  <th style={{ textAlign: 'right' }}>Modifier le Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{ticket.client_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ticket.client_phone || '-'}</div>
                    </td>
                    <td style={{ fontWeight: '500' }}>{ticket.equipment}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ticket.issue}</td>
                    <td>
                      <span className={`badge ${ticket.priority}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td>{ticket.assigned_technician || 'Non assigné'}</td>
                    <td>
                      <span className={`badge ${ticket.status}`}>
                        {ticket.status}
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
                            Démarrer
                          </button>
                        )}
                        {ticket.status === 'en_cours' && (
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px', borderColor: 'var(--success)', color: 'var(--success)' }}
                            onClick={() => handleUpdateStatus(ticket.id, 'résolu')}
                          >
                            <CheckCircle2 size={12} /> Résoudre
                          </button>
                        )}
                        {ticket.status === 'résolu' && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Intervention close</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucun ticket d'assistance trouvé.
                    </td>
                  </tr>
                )}
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
                  placeholder="ex: Pierre Durant"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Téléphone du Client</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: +33 6..."
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Matériel / Équipement</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: Pompe à Chaleur..."
                    value={equipment}
                    onChange={(e) => setEquipment(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description du problème</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  required
                  placeholder="Expliquez la panne ou le problème..."
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priorité</label>
                  <select 
                    className="form-input" 
                    value={priority} 
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="faible">Faible</option>
                    <option value="moyenne">Moyenne</option>
                    <option value="élevée">Élevée</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Technicien Assigné (Optionnel)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: Thomas Martin"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                  />
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
