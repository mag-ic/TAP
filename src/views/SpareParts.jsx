import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency } from '../lib/format';
import { Plus, Search, Settings, AlertTriangle, RefreshCw } from 'lucide-react';

export default function SpareParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('2');
  const [unitPrice, setUnitPrice] = useState('');

  const fetchParts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('spare_parts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw new Error('DB tables missing');

      setParts(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setParts([
        { id: '1', name: 'Filtre à Huile F-104', part_number: 'FLT-H-104', category: 'Moteur', quantity: 12, min_quantity: 4, unit_price: 15.00 },
        { id: '2', name: 'Joint Torique 24mm', part_number: 'JNT-TOR-24', category: 'Plomberie', quantity: 200, min_quantity: 50, unit_price: 0.15 },
        { id: '3', name: 'Résistance Chauffante 2000W', part_number: 'RES-CH-2000W', category: 'Chauffage', quantity: 1, min_quantity: 2, unit_price: 45.00 }, // low stock
        { id: '4', name: 'Courroie de transmission C-45', part_number: 'CRT-C-45', category: 'Moteur', quantity: 3, min_quantity: 2, unit_price: 22.50 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const handleAddPart = async (e) => {
    e.preventDefault();
    if (!name || !partNumber || !category || !quantity || !unitPrice) return;

    const newPart = {
      name,
      part_number: partNumber,
      category,
      quantity: parseInt(quantity),
      min_quantity: parseInt(minQuantity),
      unit_price: parseFloat(unitPrice)
    };

    if (usingMockData) {
      const mockNewPart = {
        ...newPart,
        id: Math.random().toString()
      };
      setParts([...parts, mockNewPart]);
    } else {
      const { error } = await supabase.from('spare_parts').insert([newPart]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchParts();
      }
    }

    // Reset Form
    setName('');
    setPartNumber('');
    setCategory('');
    setQuantity('');
    setUnitPrice('');
    setShowModal(false);
  };

  const categories = [...new Set(parts.map(p => p.category))];

  const filteredParts = parts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.part_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={24} style={{ color: 'var(--primary)' }} /> Pièces de Rechange
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchParts}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Ajouter une Pièce
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher par désignation, réf..."
              className="form-input search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="form-input" 
            style={{ width: '180px' }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">Toutes catégories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spare Parts Table */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Désignation</th>
                  <th>Catégorie</th>
                  <th>Quantité en Stock</th>
                  <th>Prix Unitaire</th>
                  <th>Valeur Globale</th>
                  <th>Stock Mini</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.map((part) => {
                  const isLow = part.quantity <= part.min_quantity;
                  const value = part.quantity * part.unit_price;
                  return (
                    <tr key={part.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{part.part_number}</td>
                      <td style={{ fontWeight: '500' }}>{part.name}</td>
                      <td>{part.category}</td>
                      <td style={{ fontWeight: '600', color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}>{part.quantity} pcs</td>
                      <td>{formatCurrency(part.unit_price)}</td>
                      <td style={{ fontWeight: '600' }}>{formatCurrency(value)}</td>
                      <td>{part.min_quantity} pcs</td>
                      <td>
                        <span className={`badge ${isLow ? 'ouvert' : 'confirmé'}`}>
                          {isLow ? 'À commander' : 'Disponible'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredParts.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucune pièce de rechange trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for adding spare parts */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Ajouter une Pièce de Rechange</h3>
            <form onSubmit={handleAddPart}>
              <div className="form-group">
                <label className="form-label">Désignation de la pièce</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: Alternateur 12V..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Référence Fabricant</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: ALT-12V-M1"
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: Moteur, Électricité..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantité Initiale</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Seuil Minimal d'Alerte</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    placeholder="2"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Prix Unitaire HT (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  required
                  placeholder="0.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
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
