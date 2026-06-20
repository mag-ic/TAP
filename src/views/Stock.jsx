import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Plus, Search, Box, AlertTriangle, RefreshCw } from 'lucide-react';

export default function Stock() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [usingMockData, setUsingMockData] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [minQuantity, setMinQuantity] = useState('5');
  const [unitPrice, setUnitPrice] = useState('');

  const fetchStock = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stock')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw new Error('DB tables missing');

      setStockItems(data || []);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setStockItems([
        { id: '1', name: 'Câble Électrique R2V 3G1.5', sku: 'CAB-R2V-3G15', category: 'Électricité', quantity: 150, unit: 'mètres', min_quantity: 50, unit_price: 1.25 },
        { id: '2', name: 'Tuyau Cuivre Ø14', sku: 'TUY-CU-14', category: 'Plomberie', quantity: 45, unit: 'mètres', min_quantity: 15, unit_price: 4.80 },
        { id: '3', name: 'Prise de courant double Legrand', sku: 'PRI-LEG-DBL', category: 'Électricité', quantity: 3, unit: 'pcs', min_quantity: 10, unit_price: 14.50 }, // low stock
        { id: '4', name: 'Disjoncteur 16A Schneider', sku: 'DIS-SCH-16A', category: 'Électricité', quantity: 20, unit: 'pcs', min_quantity: 5, unit_price: 8.90 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!name || !sku || !category || !quantity || !unitPrice) return;

    const newItem = {
      name,
      sku,
      category,
      quantity: parseInt(quantity),
      unit,
      min_quantity: parseInt(minQuantity),
      unit_price: parseFloat(unitPrice)
    };

    if (usingMockData) {
      const mockNewItem = {
        ...newItem,
        id: Math.random().toString()
      };
      setStockItems([...stockItems, mockNewItem]);
    } else {
      const { error } = await supabase.from('stock').insert([newItem]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
      } else {
        fetchStock();
      }
    }

    // Reset Form
    setName('');
    setSku('');
    setCategory('');
    setQuantity('');
    setUnitPrice('');
    setShowModal(false);
  };

  // Get categories
  const categories = [...new Set(stockItems.map(item => item.category))];

  // Filters
  const filteredItems = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesLowStock = !filterLowStock || item.quantity <= item.min_quantity;
    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const lowStockItemsCount = stockItems.filter(item => item.quantity <= item.min_quantity).length;

  return (
    <div>
      <div className="section-header">
        <h2 className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Box size={24} style={{ color: 'var(--primary)' }} /> Stock Général
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchStock}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Ajouter un Article
          </button>
        </div>
      </div>

      {lowStockItemsCount > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={24} style={{ flexShrink: 0 }} />
          <div>
            <div className="alert-title">Alerte niveau de stock ({lowStockItemsCount} articles)</div>
            <div className="alert-message">
              Certains articles ont atteint ou sont en dessous de leur seuil d'alerte minimal. Pensez à passer commande.
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="glass-card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Rechercher par nom, SKU..."
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
          <button 
            className={`btn ${filterLowStock ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterLowStock(!filterLowStock)}
          >
            <AlertTriangle size={16} /> Alertes uniquement
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="glass-card">
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement...</div>
        ) : (
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nom</th>
                  <th>Catégorie</th>
                  <th>Quantité</th>
                  <th>Unité</th>
                  <th>Prix Unitaire</th>
                  <th>Valeur Stock</th>
                  <th>Seuil Alerte</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isLow = item.quantity <= item.min_quantity;
                  const value = item.quantity * item.unit_price;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>{item.sku}</td>
                      <td style={{ fontWeight: '500' }}>{item.name}</td>
                      <td>{item.category}</td>
                      <td style={{ fontWeight: '600', color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}>{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{Number(item.unit_price).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                      <td style={{ fontWeight: '600' }}>{value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                      <td>{item.min_quantity}</td>
                      <td>
                        <span className={`badge ${isLow ? 'ouvert' : 'confirmé'}`}>
                          {isLow ? 'Alerte' : 'Ok'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>
                      Aucun article trouvé.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for adding stock */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>Ajouter un Article</h3>
            <form onSubmit={handleAddItem}>
              <div className="form-group">
                <label className="form-label">Nom de l'article</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: Câble Cuivre..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU / Code</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: CAB-COP-10"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: Électricité, Plomberie..."
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
                  <label className="form-label">Unité de mesure</label>
                  <select 
                    className="form-input" 
                    value={unit} 
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="pcs">Pièces (pcs)</option>
                    <option value="mètres">Mètres (m)</option>
                    <option value="litres">Litres (L)</option>
                    <option value="kg">Kilogrammes (kg)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
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
                <div className="form-group">
                  <label className="form-label">Seuil d'Alerte</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    placeholder="5"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
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
