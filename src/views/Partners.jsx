import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [companyName, setCompanyName] = useState('');

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
      setPartners([
        { id: '1', name: 'Jean Dupont', type: 'client', email: 'jean.dupont@email.com', phone: '+33 6 1234 5678', address: 'Paris, France', company_name: 'Dupont Bâtiment' },
        { id: '2', name: 'Marie Leroux', type: 'client', email: 'marie.leroux@email.com', phone: '+33 6 8765 4321', address: 'Lyon, France', company_name: 'Leroux SARL' },
        { id: '3', name: 'Industries Métal-Pro', type: 'fournisseur', email: 'sales@metalpro.com', phone: '+33 1 4567 8900', address: 'Lille, France', company_name: 'MetalPro S.A.' },
        { id: '4', name: 'ElectroComposants', type: 'fournisseur', email: 'contact@electrocomp.com', phone: '+33 2 9876 5432', address: 'Nantes, France', company_name: 'ElectroComposants Ltd' }
      ]);
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
      name,
      type,
      email: email || null,
      phone: phone || null,
      address: address || null,
      company_name: companyName || null
    };

    if (usingMockData) {
      const mockNewPartner = {
        ...newPartner,
        id: Math.random().toString()
      };
      setPartners([...partners, mockNewPartner]);
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
    setCompanyName('');
    setShowModal(false);
  };

  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.company_name && p.company_name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UserCheck size={24} style={{ color: 'var(--primary)' }} /> Partenaires
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
              placeholder="Rechercher par nom, entreprise..."
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
                  <th>Entreprise</th>
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
                    <td style={{ fontWeight: '500' }}>{partner.company_name || '-'}</td>
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
                {filteredPartners.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucun partenaire trouvé.
                    </td>
                  </tr>
                )}
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
                <label className="form-label">Nom complet</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Entreprise (Optionnel)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: Dupont SARL"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
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
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="ex: contact@entreprise.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="ex: +33 6..."
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
                  placeholder="ex: 12 Rue de la Paix, Paris"
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
