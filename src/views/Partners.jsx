import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockPartners, mockTransactions, mockCheques } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, MapPin, RefreshCw, Download, Pencil, Trash2, X, Upload, ArrowLeft, Mail, Phone, Calendar, Landmark, CreditCard, DollarSign, Clock, FileText } from 'lucide-react';
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

  // New States for Detail View
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [detailTab, setDetailTab] = useState('transactions');

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

    if (selectedPartner && selectedPartner.id === id) {
      setSelectedPartner(null);
    }

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
      if (selectedPartner && selectedPartner.id === editingItem.id) {
        setSelectedPartner({ ...selectedPartner, ...partnerData });
      }

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
    const partnerCheques = cheques.filter(c => c.partner_name?.trim().toLowerCase() === partner.name?.trim().toLowerCase());
    const partnerTx = transactions.filter(t => t.partner_name?.trim().toLowerCase() === partner.name?.trim().toLowerCase());
    
    const volume = partnerTx.reduce((acc, t) => acc + (t.amount || 0), 0);
    
    let encours = 0;
    partnerTx.forEach(t => {
      const { reste } = getTxMetrics(t);
      encours += reste;
    });
    
    const linkedRefs = partnerTx.map(t => getBCReference(t.description));
    const unlinkedImpayes = partnerCheques.filter(c => 
      c.status === 'impayé' && 
      !linkedRefs.includes(c.reference) && 
      !partnerTx.some(t => t.description?.includes(c.reference))
    );
    const unlinkedImpayesSum = unlinkedImpayes.reduce((acc, c) => acc + (c.amount || 0), 0);
    encours += unlinkedImpayesSum;

    return { volume, encours };
  };

  // Helper to extract BC/AR reference from description
  const getBCReference = (description) => {
    if (!description) return 'INV-26-XXXX';
    const match = description.match(/(BC-\d+-\d+|BC\d+|AR-\d+-\d+|AR\d+|INV-\d+-\d+)/);
    return match ? match[0] : (description.replace('Entrée ', '').replace('Facture ', '').split(' - ')[0] || description);
  };

  // Helper to compute total, regle, and reste for a transaction
  const getTxMetrics = (tx) => {
    const amount = Number(tx.amount || 0);
    
    if (tx.status === 'confirmé') {
      return { total: amount, regle: amount, reste: 0 };
    }
    if (tx.status === 'annulé') {
      return { total: 0, regle: 0, reste: 0 };
    }
    
    const ref = getBCReference(tx.description);
    const txCheques = cheques.filter(c => c.reference === ref || tx.description.includes(c.reference));
    const regleCheques = txCheques.filter(c => c.status === 'recouvré').reduce((acc, c) => acc + (c.amount || 0), 0);
    
    const regle = regleCheques > 0 ? regleCheques : 0;
    const reste = Math.max(0, amount - regle);
    
    return { total: amount, regle, reste };
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
      {/* Catalog Header */}
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

      {/* Filter and Search bar */}
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

      {/* Partners List Table */}
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
                    <tr 
                      key={partner.id} 
                      style={{ borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedPartner(partner);
                        setDetailTab('transactions');
                      }}
                    >
                      <td style={{ padding: '20px 16px' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>{partner.name.toUpperCase()}</div>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: '2px' }}>{partner.type}</div>
                      </td>
                      <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin size={14} style={{ color: 'var(--text-secondary)' }} />
                          <span>{partner.city ? partner.city.toUpperCase() : '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: '700', color: 'var(--text-primary)', fontSize: '14px' }}>
                        {formatCurrency(volume)}
                      </td>
                      <td style={{ padding: '20px 16px', fontWeight: '700', color: encours > 0 ? 'var(--danger)' : 'var(--success)', fontSize: '14px' }}>
                        {(() => {
                          const partnerCheques = cheques.filter(c => c.partner_name?.trim().toLowerCase() === partner.name?.trim().toLowerCase());
                          const hasImpayeCheque = partnerCheques.some(c => c.status === 'impayé');
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{formatCurrency(encours)}</span>
                              {hasImpayeCheque && (
                                <span style={{ 
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                                  color: '#f87171', 
                                  fontSize: '10px', 
                                  fontWeight: '800', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: '1px solid rgba(239, 68, 68, 0.3)'
                                }} title="Ce partenaire possède au moins un chèque impayé">
                                  ⚠️ IMPAYÉ
                                </span>
                              )}
                            </div>
                          );
                        })()}
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

      {/* Detailed Partner Popup Overlay */}
      {selectedPartner && (
        <div 
          className="modal-overlay" 
          style={{ 
            zIndex: 999, 
            overflowY: 'auto', 
            display: 'flex', 
            alignItems: 'flex-start', 
            padding: '40px 20px', 
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(8px)'
          }} 
          onClick={() => setSelectedPartner(null)}
        >
          <div 
            className="modal-content" 
            style={{ 
              width: '1200px', 
              maxWidth: '95%', 
              maxHeight: 'none', 
              overflowY: 'visible', 
              backgroundColor: 'var(--bg-card)', 
              padding: '32px',
              borderRadius: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              position: 'relative',
              animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              margin: 'auto 0'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              className="modal-close" 
              onClick={() => setSelectedPartner(null)} 
              style={{ 
                position: 'absolute', 
                top: '24px', 
                right: '24px', 
                background: 'rgba(15, 23, 42, 0.05)', 
                border: 'none', 
                borderRadius: '50%', 
                width: '36px', 
                height: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer',
                color: '#64748b',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.05)'}
            >
              <X size={20} />
            </button>

            {/* Header section */}
            <div style={{ marginBottom: '24px', paddingRight: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '28px', color: 'var(--text-primary)', fontWeight: '800' }}>{selectedPartner.name.toUpperCase()}</h1>
                <span className={`badge ${selectedPartner.type === 'client' ? 'badge-client' : 'badge-supplier'}`} style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  textTransform: 'uppercase',
                  backgroundColor: selectedPartner.type === 'client' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: selectedPartner.type === 'client' ? '#60a5fa' : '#fbbf24'
                }}>
                  {selectedPartner.type === 'client' ? 'Client' : 'Fournisseur'}
                </span>
                <button 
                  className="btn btn-white" 
                  onClick={(e) => handleEditClick(selectedPartner, e)}
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Pencil size={14} /> Modifier
                </button>
              </div>
              <p style={{ marginTop: '6px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Fiche partenaire et historique financier complet.</p>
            </div>

            {/* Info Grid & Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
              {/* Info Card */}
              <div className="glass-card">
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  Coordonnées & Infos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>VILLE / RÉGION</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedPartner.city ? selectedPartner.city.toUpperCase() : '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>ICE</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedPartner.ice || '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>IDENTIFIANT FISCAL (IF)</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedPartner.if_id || '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Phone size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>TÉLÉPHONE</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedPartner.phone || '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Mail size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>EMAIL</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{selectedPartner.email || '-'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <MapPin size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' }}>ADRESSE</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>{selectedPartner.address || '-'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats & History Card */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 3 Metrics Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  {(() => {
                    const partnerTxs = transactions.filter(t => t.partner_name?.trim().toLowerCase() === selectedPartner.name?.trim().toLowerCase());
                    let totalInvoiced = 0;
                    let totalPaid = 0;
                    let totalRemaining = 0;

                    partnerTxs.forEach(t => {
                      const { total, regle, reste } = getTxMetrics(t);
                      totalInvoiced += total;
                      totalPaid += regle;
                      totalRemaining += reste;
                    });

                    return (
                      <>
                        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ padding: '12px', borderRadius: '14px', backgroundColor: '#eff6ff', color: '#2563eb' }}>
                            <DollarSign size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                              {selectedPartner.type === 'client' ? 'Total Facturé' : 'Total Achat'}
                            </div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                              {formatCurrency(totalInvoiced)}
                            </div>
                          </div>
                        </div>

                        {/* Card 2 */}
                        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ padding: '12px', borderRadius: '14px', backgroundColor: '#f0fdf4', color: '#10b981' }}>
                            <CreditCard size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Payé</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: '#10b981', marginTop: '2px' }}>
                              {formatCurrency(totalPaid)}
                            </div>
                          </div>
                        </div>

                        {/* Card 3 */}
                        <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '20px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
                          <div style={{ padding: '12px', borderRadius: '14px', backgroundColor: totalRemaining > 0 ? '#fef2f2' : '#f0fdf4', color: totalRemaining > 0 ? '#ef4444' : '#10b981' }}>
                            <Clock size={22} />
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Reste à Payer</div>
                            <div style={{ fontSize: '18px', fontWeight: '800', color: totalRemaining > 0 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                              {formatCurrency(totalRemaining)}
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* History Table Container */}
                <div className="glass-card" style={{ backgroundColor: '#ffffff', borderRadius: '24px', padding: '24px', border: '1px solid #e2e8f0', flexGrow: 1, boxShadow: '0 4px 18px rgba(0, 0, 0, 0.02)' }}>
                  {(() => {
                    const partnerTxs = transactions
                      .filter(t => t.partner_name?.trim().toLowerCase() === selectedPartner.name?.trim().toLowerCase())
                      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
                    const partnerCheques = cheques
                      .filter(c => c.partner_name?.trim().toLowerCase() === selectedPartner.name?.trim().toLowerCase())
                      .sort((a, b) => (b.due_date || b.received_date || '').localeCompare(a.due_date || a.received_date || ''));

                    return (
                      <>
                        {/* Tabs for detail view */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                          <div style={{ display: 'flex', gap: '20px' }}>
                            <button 
                              onClick={() => setDetailTab('transactions')}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '14px',
                                fontWeight: '700',
                                color: detailTab === 'transactions' ? '#2563eb' : '#64748b',
                                borderBottom: detailTab === 'transactions' ? '2px solid #2563eb' : 'none',
                                paddingBottom: '8px',
                                cursor: 'pointer'
                              }}
                            >
                              Factures / Transactions ({partnerTxs.length})
                            </button>
                            <button 
                              onClick={() => setDetailTab('cheques')}
                              style={{
                                border: 'none',
                                background: 'none',
                                fontSize: '14px',
                                fontWeight: '700',
                                color: detailTab === 'cheques' ? '#2563eb' : '#64748b',
                                borderBottom: detailTab === 'cheques' ? '2px solid #2563eb' : 'none',
                                paddingBottom: '8px',
                                cursor: 'pointer'
                              }}
                            >
                              Règlements / Chèques ({partnerCheques.length})
                            </button>
                          </div>
                        </div>

                        {/* Transactions Tab */}
                        {detailTab === 'transactions' && (
                          <div className="table-container">
                            {partnerTxs.length === 0 ? (
                              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                Aucune transaction enregistrée pour ce partenaire.
                              </div>
                            ) : (
                              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'left' }}>DATE</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'left' }}>RÉFÉRENCE / DESCRIPTION</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'right' }}>MONTANT GLOBAL</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'right' }}>RÉGLÉ</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'right' }}>RESTE</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'center' }}>STATUT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {partnerTxs.map(t => {
                                    const { total, regle, reste } = getTxMetrics(t);
                                    const statusStr = t.status === 'confirmé' ? 'Payé' : (t.status === 'annulé' ? 'Annulé' : (regle > 0 ? 'Partiel' : 'Impayé'));
                                    const statusColor = t.status === 'confirmé' ? '#10b981' : (t.status === 'annulé' ? '#94a3b8' : (regle > 0 ? '#f59e0b' : '#ef4444'));

                                    return (
                                      <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', textAlign: 'left' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{t.date}</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'left' }}>
                                          <div>{getBCReference(t.description)}</div>
                                          <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '2px' }}>{t.description}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right' }}>
                                          {formatCurrency(total)}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--success)', textAlign: 'right' }}>
                                          {formatCurrency(regle)}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: reste > 0 ? 'var(--danger)' : 'var(--success)', textAlign: 'right' }}>
                                          {formatCurrency(reste)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            textTransform: 'uppercase',
                                            backgroundColor: statusColor + '15',
                                            color: statusColor
                                          }}>
                                            {statusStr}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}

                        {/* Cheques Tab */}
                        {detailTab === 'cheques' && (
                          <div className="table-container">
                            {partnerCheques.length === 0 ? (
                              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                                Aucun chèque/règlement enregistré pour ce partenaire.
                              </div>
                            ) : (
                              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'left' }}>DATE D'ÉCHÉANCE</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'left' }}>NUMÉRO / RÉFÉRENCE</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'left' }}>BANQUE</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'right' }}>MONTANT</th>
                                    <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #f1f5f9', padding: '12px', textAlign: 'center' }}>STATUT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {partnerCheques.map(c => {
                                    const statusColor = c.status === 'recouvré' ? '#10b981' : (c.status === 'déposé' ? '#0284c7' : (c.status === 'impayé' ? '#ef4444' : '#f59e0b'));
                                    const statusText = c.status === 'recouvré' ? 'ENCAISSÉ' : (c.status === 'déposé' ? 'DÉPOSÉ' : (c.status === 'impayé' ? 'IMPAYÉ' : 'EN ATTENTE'));

                                    return (
                                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-primary)', textAlign: 'left' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{c.due_date || '-'}</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'left' }}>
                                          <div>Chèque N° {c.number || 'N/A'}</div>
                                          <div style={{ fontSize: '11px', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '2px' }}>Réf: {c.reference || 'N/A'}</div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'left' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Landmark size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span>{c.bank ? c.bank.toUpperCase() : '-'}</span>
                                          </div>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', textAlign: 'right' }}>
                                          {formatCurrency(c.amount)}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                          <span style={{
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            textTransform: 'uppercase',
                                            backgroundColor: statusColor + '15',
                                            color: statusColor
                                          }}>
                                            {statusText}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Close action button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPartner(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

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
