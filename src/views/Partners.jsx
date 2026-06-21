import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockPartners, mockTransactions, mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, MapPin, RefreshCw, Download, Pencil, Trash2, X, Upload } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';


export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('client'); // Default to client as in screenshot
  const [filterCity, setFilterCity] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
      const { data: pData, error: pError } = await supabase
        .from('partners')
        .select('*')
        .order('name', { ascending: true });

      if (pError) throw new Error('DB tables missing');

      const { data: txData } = await supabase.from('transactions').select('*');
      const { data: chqData } = await supabase.from('cheques').select('*');

      setPartners(pData || []);
      setTransactions(txData || []);
      setCheques(chqData || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setPartners(mockPartners);
      setTransactions(mockTransactions);
      setCheques(mockCheques);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, []);

  const handleAddNewClick = () => {
    setEditingItem(null);
    setName('');
    setType(filterType);
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setIce('');
    setIfId('');
    setShowModal(true);
  };

  const handleEditClick = (partner, e) => {
    e.stopPropagation();
    setEditingItem(partner);
    setName(partner.name || '');
    setType(partner.type || 'client');
    setEmail(partner.email || '');
    setPhone(partner.phone || '');
    setAddress(partner.address || '');
    setCity(partner.city || '');
    setIce(partner.ice || '');
    setIfId(partner.if_id || '');
    setShowModal(true);
  };

  const handleDeleteClick = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer ce partenaire ?")) return;

    if (usingMockData) {
      setPartners(partners.filter(p => p.id !== id));
    } else {
      const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Erreur lors de la suppression : " + error.message);
      } else {
        fetchPartners();
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name || !type) return;

    const partnerData = {
      name,
      type,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      ice: ice || null,
      if_id: ifId || null
    };

    if (editingItem) {
      if (usingMockData) {
        setPartners(partners.map(p => p.id === editingItem.id ? { ...editingItem, ...partnerData } : p));
      } else {
        const { error } = await supabase
          .from('partners')
          .update(partnerData)
          .eq('id', editingItem.id);

        if (error) {
          alert("Erreur lors de la modification : " + error.message);
        } else {
          fetchPartners();
        }
      }
    } else {
      const newPartner = {
        ...partnerData,
        id: 'ent-' + Math.floor(Math.random() * 100000000000)
      };

      if (usingMockData) {
        setPartners([...partners, newPartner]);
      } else {
        const { error } = await supabase
          .from('partners')
          .insert([newPartner]);

        if (error) {
          alert("Erreur lors de l'insertion : " + error.message);
        } else {
          fetchPartners();
        }
      }
    }

    // Reset Form & Close
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setCity('');
    setIce('');
    setIfId('');
    setEditingItem(null);
    setShowModal(false);
  };

  const handleExportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ["Nom complet", "Type", "Ville", "ICE", "IF", "Email", "Téléphone", "Adresse", "Volume d'affaires", "Encours (reste)"];
    const rows = filteredPartners.map(p => {
      const { volume, encours } = getPartnerMetrics(p);
      return [
        p.name,
        p.type === 'client' ? 'Client' : 'Fournisseur',
        p.city || '',
        p.ice || '',
        p.if_id || '',
        p.email || '',
        p.phone || '',
        p.address || '',
        volume,
        encours
      ];
    });

    const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `partenaires_${filterType}s_${new Date().toISOString().split('T')[0]}.csv`);
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

      const newItems = [];
      const updatedItems = [];

      parsed.rows.forEach(row => {
        const name = (row.name || row.nom || row['nom complet'] || row['raison sociale'] || row.partner || 'Partenaire sans nom').trim();
        let rawType = row.type || row.role || filterType;
        let type = 'client';
        if (rawType.toLowerCase().includes('fournis') || rawType.toLowerCase().includes('supplier') || rawType.toLowerCase().includes('prov')) {
          type = 'fournisseur';
        }
        const email = row.email || row['e-mail'] || row.mail || null;
        const phone = row.phone || row['téléphone'] || row.tel || null;
        const city = row.city || row.ville || null;
        const address = row.address || row.adresse || null;
        const ice = row.ice || null;
        const if_id = row.if || row.if_id || row['identifiant fiscal'] || null;

        // Check if partner with the same name already exists (case-insensitive)
        const existingPartner = partners.find(p => p.name.trim().toLowerCase() === name.toLowerCase());

        if (existingPartner) {
          updatedItems.push({
            id: existingPartner.id,
            name: existingPartner.name,
            type,
            email: email || existingPartner.email,
            phone: phone || existingPartner.phone,
            city: city || existingPartner.city,
            address: address || existingPartner.address,
            ice: ice || existingPartner.ice,
            if_id: if_id || existingPartner.if_id
          });
        } else {
          newItems.push({
            id: 'ent-' + Math.floor(Math.random() * 100000000000),
            name,
            type,
            email,
            phone,
            city,
            address,
            ice,
            if_id
          });
        }
      });

      const allItems = [...newItems, ...updatedItems];
      if (allItems.length === 0) return;

      if (usingMockData) {
        setPartners(prev => {
          let nextList = [...prev];
          updatedItems.forEach(upd => {
            nextList = nextList.map(p => p.id === upd.id ? upd : p);
          });
          return [...newItems, ...nextList];
        });
        alert(`${newItems.length} partenaires insérés, ${updatedItems.length} mis à jour localement avec succès !`);
      } else {
        try {
          const { error } = await supabase.from('partners').upsert(allItems);
          if (error) throw error;
          alert(`${newItems.length} nouveaux partenaires importés, ${updatedItems.length} mis à jour dans la base de données avec succès !`);
          await fetchPartners();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };


  // Helper to calculate Volume d'affaires and Encours for a partner
  const getPartnerMetrics = (partner) => {
    const partnerCheques = cheques.filter(c => c.partner_name?.toLowerCase() === partner.name?.toLowerCase());
    const impayeChequesSum = partnerCheques.filter(c => c.status === 'impayé').reduce((acc, c) => acc + (c.amount || 0), 0);
    
    const partnerTx = transactions.filter(t => t.partner_name?.toLowerCase() === partner.name?.toLowerCase());
    const volume = partnerTx.reduce((acc, t) => acc + (t.amount || 0), 0);
    
    let encours = 0;
    if (impayeChequesSum > 0) {
      encours = impayeChequesSum;
    } else {
      encours = partnerTx.filter(t => t.status === 'annulé' || t.status === 'en_attente').reduce((acc, t) => acc + (t.amount || 0), 0);
    }

    return { volume, encours };
  };

  // Get distinct cities from data
  const cities = [...new Set(partners.map(p => p.city).filter(Boolean))];

  // Filtering
  const filteredPartners = partners.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.city && p.city.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = p.type === filterType;
    const matchesCity = filterCity === 'all' || p.city === filterCity;
    return matchesSearch && matchesType && matchesCity;
  });

  return (
    <div className="stock-page-container">
      {/* Header section matching image */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1>Partenaires</h1>
          <p className="catalog-subtitle">Gérez votre écosystème de clients et fournisseurs.</p>
        </div>
        <div className="catalog-header-actions">
          <input
            type="file"
            id="csv-import-partners-input"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button className="btn btn-white" onClick={() => document.getElementById('csv-import-partners-input').click()}>
            <Upload size={16} /> IMPORTER CSV
          </button>
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>
          <button className="btn btn-blue-action" onClick={handleAddNewClick}>
            <Plus size={16} /> NOUVEAU {filterType === 'client' ? 'CLIENT' : 'FOURNISSEUR'}
          </button>
        </div>
      </div>

      {/* Filter and Search bar matching image */}
      <div className="catalog-filter-bar" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        {/* Client/Supplier Switch Tab */}
        <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: '#f1f5f9', borderRadius: '12px', display: 'inline-flex' }}>
          <button 
            className={`tab-btn ${filterType === 'client' ? 'active' : ''}`}
            style={{ 
              textTransform: 'uppercase', 
              fontSize: '11px', 
              letterSpacing: '0.5px',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: filterType === 'client' ? '#2563eb' : 'transparent',
              color: filterType === 'client' ? '#ffffff' : '#64748b',
              boxShadow: filterType === 'client' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            onClick={() => setFilterType('client')}
          >
            Clients
          </button>
          <button 
            className={`tab-btn ${filterType === 'fournisseur' ? 'active' : ''}`}
            style={{ 
              textTransform: 'uppercase', 
              fontSize: '11px', 
              letterSpacing: '0.5px',
              padding: '8px 16px',
              borderRadius: '10px',
              backgroundColor: filterType === 'fournisseur' ? '#2563eb' : 'transparent',
              color: filterType === 'fournisseur' ? '#ffffff' : '#64748b',
              boxShadow: filterType === 'fournisseur' ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.2s ease',
              border: 'none',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            onClick={() => setFilterType('fournisseur')}
          >
            Fournisseurs
          </button>
        </div>

        {/* Search Input */}
        <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
          <Search size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Recherche par nom..."
            className="form-input search-input-catalog"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* City Filter Dropdown */}
        <div className="search-input-wrapper" style={{ width: '200px', flexShrink: 0 }}>
          <MapPin size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <select
            className="select-category-catalog"
            style={{ paddingLeft: '42px', width: '100%' }}
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
          >
            <option value="all">Toutes Villes</option>
            {cities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <button 
          className="btn btn-white" 
          onClick={fetchPartners} 
          title="Actualiser les données"
          style={{ padding: '12px', borderRadius: '12px' }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Partners List Table matching image */}
      <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '500' }}>
            Chargement des partenaires...
          </div>
        ) : filteredPartners.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: '500', fontStyle: 'italic' }}>
            Aucun partenaire trouvé.
          </div>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>PARTENAIRE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>VILLE</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>VOLUME D'AFFAIRES</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px' }}>ENCOURS (RESTE)</th>
                  <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((partner) => {
                  const { volume, encours } = getPartnerMetrics(partner);

                  return (
                    <tr key={partner.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '20px 16px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{partner.name.toUpperCase()}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginTop: '2px' }}>{partner.type}</div>
                      </td>
                      <td style={{ padding: '20px 16px', color: '#475569', fontWeight: '600', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} style={{ color: '#cbd5e1' }} />
                          <span>{partner.city ? partner.city.toUpperCase() : '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>
                        {formatCurrency(volume)}
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: '700', color: encours > 0 ? '#ef4444' : '#10b981', fontSize: '14px' }}>
                        {formatCurrency(encours)}
                      </td>
                      <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '12px', color: '#cbd5e1' }}>
                          <button 
                            className="action-icon-btn" 
                            style={{ color: '#cbd5e1', cursor: 'pointer' }}
                            onClick={(e) => handleEditClick(partner, e)} 
                            title="Modifier"
                          >
                            <Pencil size={16} />
                          </button>
                          <button 
                            className="action-icon-btn delete" 
                            style={{ color: '#cbd5e1', cursor: 'pointer' }}
                            onClick={(e) => handleDeleteClick(partner.id, e)} 
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* Modal for adding/editing partners */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>
              {editingItem ? "Modifier le Partenaire" : `Nouveau ${filterType === 'client' ? 'Client' : 'Fournisseur'}`}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Nom complet / Raison Sociale</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: ESPACE STEEL..."
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
                <button type="submit" className="btn btn-blue-action">
                  {editingItem ? "Enregistrer" : "Valider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
