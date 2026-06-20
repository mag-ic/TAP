import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockPartners } from '../lib/mockData';
import { Plus, Search, UserCheck, RefreshCw } from 'lucide-react';

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState('client');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [ice, setIce] = useState('');
  const [ifId, setIfId] = useState('');

  const fetchPartners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw new Error('DB tables missing');

      setPartners(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setPartners(mockPartners);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleAddPartner = async (e) => {
    e.preventDefault();
    if (!name || !type) return;

    const newPartner = {
      id: 'ent-' + Math.floor(Math.random() * 100000000000),
      name,
      type,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      ice: ice || null,
      if_id: ifId || null
    };

    if (usingMockData) {
      setPartners([...partners, newPartner]);
    } else {
      const { error } = await supabase.from('partners').insert([newPartner]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchPartners();
      }
    }

    // Reset Form
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setIce('');
    setIfId('');
    setShowModal(false);
  };

  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.ice && p.ice.includes(searchTerm));
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={24} style={{ color: 'var(--primary)' }} /> Partenaires & Annuaire
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchPartners}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Nouveau Partenaire
          </button>
        </div>
      </div>

      {/* Tabs / Filters */}
      <div className="tab-switcher" style={{ marginBottom: '24px' }}>
        <button 
          className={`tab-btn ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          Tous ({partners.length})
        </button>
        <button 
          className={`tab-btn ${filterType === 'client' ? 'active' : ''}`}
          onClick={() => setFilterType('client')}
        >
          Clients ({partners.filter(p => p.type === 'client').length})
        </button>
        <button 
          className={`tab-btn ${filterType === 'fournisseur' ? 'active' : ''}`}
          onClick={() => setFilterType('fournisseur')}
        >
          Fournisseurs ({partners.filter(p => p.type === 'fournisseur').length})
        </button>
      </div>

      {/* Search Input */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher par nom, ville, ICE..."
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Partners List */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nom complet</th>
                  <th>Ville</th>
                  <th>ICE (Identifiant Fiscal)</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Téléphone</th>
                  <th>Adresse</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((partner) => (
                  <tr key={partner.id}>
                    <td style={{ fontWeight: '600' }}>{partner.name}</td>
                    <td style={{ fontWeight: '500' }}>{partner.city || '-'}</td>
                    <td>
                      <div style={{ fontSize: '13px', fontFamily: 'monospace' }}>ICE: {partner.ice || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>IF: {partner.if_id || '-'}</div>
                    </td>
                    <td>
                      <span className={`badge ${partner.type}`}>
                        {partner.type === 'client' ? 'Client' : 'Fournisseur'}
                      </span>
                    </td>
                    <td>{partner.email || '-'}</td>
                    <td>{partner.phone || '-'}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{partner.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for adding a partner */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Nouveau Partenaire</h3>
            <form onSubmit={handleAddPartner}>
              <div className="form-group">
                <label className="form-label">Nom complet / Raison Sociale</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: ESPACE STEEL"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ville</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: CASABLANCA"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select 
                    className="form-input" 
                    value={type} 
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="client">Client</option>
                    <option value="fournisseur">Fournisseur</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">ICE (15 chiffres)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: 001541789000023"
                    value={ice}
                    onChange={(e) => setIce(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Identifiant Fiscal (IF)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: 2265372"
                    value={ifId}
                    onChange={(e) => setIfId(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="ex: info@entreprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: 06 63..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Adresse physique</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="ex: Sidi Maârouf, Casablanca"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
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
