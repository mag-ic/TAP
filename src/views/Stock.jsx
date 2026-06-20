import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockStock } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, Box, AlertTriangle, RefreshCw, Download, Pencil, Trash2, X } from 'lucide-react';

export default function Stock() {
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState(null); // 'stock' | 'price' | null
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [usingMockData, setUsingMockData] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [declassedQuantity, setDeclassedQuantity] = useState('0');
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
      setStockItems(mockStock);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleAddNewClick = () => {
    setEditingItem(null);
    setName('');
    setSku('');
    setCategory('');
    setQuantity('');
    setDeclassedQuantity('0');
    setMinQuantity('5');
    setUnitPrice('');
    setShowModal(true);
  };

  const handleEditClick = (item, e) => {
    e.stopPropagation();
    setEditingItem(item);
    setName(item.name || '');
    setSku(item.sku || '');
    setCategory(item.category || '');
    setQuantity(item.quantity !== undefined ? item.quantity.toString() : '');
    setDeclassedQuantity(item.declassed_quantity !== undefined ? item.declassed_quantity.toString() : '0');
    setMinQuantity(item.min_quantity !== undefined ? item.min_quantity.toString() : '5');
    setUnitPrice(item.unit_price !== undefined ? item.unit_price.toString() : '');
    setShowModal(true);
  };

  const handleDeleteClick = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cet article ?")) return;

    if (usingMockData) {
      setStockItems(stockItems.filter(item => item.id !== id));
    } else {
      const { error } = await supabase
        .from('stock')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Erreur lors de la suppression : " + error.message);
      } else {
        fetchStock();
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name || !sku || !category || quantity === '' || unitPrice === '') return;

    const qty = parseInt(quantity);
    const declQty = parseInt(declassedQuantity) || 0;
    const minQty = parseInt(minQuantity) || 5;
    const price = parseFloat(unitPrice);

    if (editingItem) {
      const updatedItem = {
        ...editingItem,
        name,
        sku,
        category,
        quantity: qty,
        declassed_quantity: declQty,
        min_quantity: minQty,
        unit_price: price
      };

      if (usingMockData) {
        setStockItems(stockItems.map(item => item.id === editingItem.id ? updatedItem : item));
      } else {
        const { error } = await supabase
          .from('stock')
          .update({
            name,
            sku,
            category,
            quantity: qty,
            declassed_quantity: declQty,
            min_quantity: minQty,
            unit_price: price
          })
          .eq('id', editingItem.id);

        if (error) {
          alert("Erreur lors de la modification : " + error.message);
        } else {
          fetchStock();
        }
      }
    } else {
      const newItem = {
        id: 'prod-' + Date.now(),
        name,
        sku,
        category,
        quantity: qty,
        declassed_quantity: declQty,
        min_quantity: minQty,
        unit_price: price
      };

      if (usingMockData) {
        setStockItems([newItem, ...stockItems]);
      } else {
        const { error } = await supabase
          .from('stock')
          .insert([newItem]);

        if (error) {
          alert("Erreur lors de l'insertion : " + error.message);
        } else {
          fetchStock();
        }
      }
    }

    // Reset fields & Close
    setName('');
    setSku('');
    setCategory('');
    setQuantity('');
    setDeclassedQuantity('0');
    setMinQuantity('5');
    setUnitPrice('');
    setEditingItem(null);
    setShowModal(false);
  };

  const handleSortToggle = (type) => {
    if (sortBy === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(type);
      setSortOrder('desc');
    }
  };

  const handleExportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ["Nom", "SKU", "Catégorie", "Prix HT (DH)", "Prix TTC (DH)", "Stock Neuf", "Stock Déclassé", "Seuil d'Alerte"];
    const rows = stockItems.map(item => [
      item.name,
      item.sku,
      item.category,
      item.unit_price,
      (item.unit_price * 1.2).toFixed(2),
      item.quantity,
      item.declassed_quantity || 0,
      item.min_quantity
    ]);

    const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventaire_stock_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get distinct categories
  const categories = [...new Set(stockItems.map(item => item.category))];

  // Filtering & Sorting
  let filteredItems = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (item.category && item.category.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (sortBy === 'stock') {
    filteredItems.sort((a, b) => {
      const valA = a.quantity || 0;
      const valB = b.quantity || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  } else if (sortBy === 'price') {
    filteredItems.sort((a, b) => {
      const valA = a.unit_price || 0;
      const valB = b.unit_price || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }

  return (
    <div className="stock-page-container">
      {/* Header section matching image */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1>Inventaire</h1>
          <p className="catalog-subtitle">Catalogue complet de vos références.</p>
        </div>
        <div className="catalog-header-actions">
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>
          <button className="btn btn-blue-action" onClick={handleAddNewClick}>
            <Plus size={16} /> NOUVEAU PRODUIT
          </button>
        </div>
      </div>

      {/* Filter and Sort section matching image */}
      <div className="catalog-filter-bar">
        <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
          <Search size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Recherche par nom, marque..."
            className="form-input search-input-catalog"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select
          className="select-category-catalog"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">Toutes Catégories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <button
          className={`sort-catalog-btn ${sortBy === 'stock' ? 'active' : ''}`}
          onClick={() => handleSortToggle('stock')}
        >
          Trier Stock {sortBy === 'stock' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>

        <button
          className={`sort-catalog-btn ${sortBy === 'price' ? 'active' : ''}`}
          onClick={() => handleSortToggle('price')}
        >
          Trier Prix {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>

        <button 
          className="btn btn-white" 
          onClick={fetchStock} 
          title="Actualiser les données"
          style={{ padding: '12px', borderRadius: '12px' }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Cards Grid section matching image */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748b', fontSize: '16px', fontWeight: '500' }}>
          Chargement du catalogue...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748b', fontSize: '16px', fontWeight: '500', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
          Aucun produit ne correspond à votre recherche.
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredItems.map(item => {
            const isOutOfStock = (item.quantity || 0) === 0;
            const displayPrice = (item.unit_price || 0) * 1.2;

            return (
              <div key={item.id} className="product-card">
                <div className="product-card-header">
                  <div className="product-card-icon">
                    <Box size={20} />
                  </div>
                  <div className="product-card-actions">
                    <button className="action-icon-btn" onClick={(e) => handleEditClick(item, e)} title="Modifier">
                      <Pencil size={16} />
                    </button>
                    <button className="action-icon-btn delete" onClick={(e) => handleDeleteClick(item.id, e)} title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="product-tags">
                  <span className="tag-category">{item.category}</span>
                  {item.sku && <span className="tag-sku">{item.sku}</span>}
                </div>

                <h3 className="product-card-title">{item.name}</h3>

                <div className="product-card-body">
                  <div className="price-section-catalog">
                    <span className="price-label-catalog">PRIX D'ACHAT TTC</span>
                    <span className="price-value-catalog">{formatCurrency(displayPrice)}</span>
                  </div>

                  <div className="stock-section-catalog">
                    {isOutOfStock ? (
                      <span className="rupture-badge">RUPTURE DE STOCK</span>
                    ) : (
                      <span className="en-stock-badge">EN STOCK</span>
                    )}

                    <div className="stock-pill-catalog">
                      <span className="stock-pill-label">STOCK NEUF</span>
                      <span className="stock-pill-value" style={{ 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>{item.quantity}</span>
                    </div>

                    <div className="declassed-pill-catalog">
                      <span className="declassed-pill-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <AlertTriangle size={10} style={{ strokeWidth: 3 }} /> A DÉCLASSÉ
                      </span>
                      <span className="declassed-pill-value" style={{ 
                        border: '1px solid #fee2e2', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>{item.declassed_quantity || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for adding/editing stock */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>
              {editingItem ? "Modifier l'Article" : "Ajouter un Article"}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Nom de l'article</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="ex: 12000BTU WEST..."
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
                    placeholder="ex: ON/OFF"
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
                    placeholder="ex: MURAL..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Stock Neuf</label>
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
                  <label className="form-label">Stock Déclassé</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="0"
                    value={declassedQuantity}
                    onChange={(e) => setDeclassedQuantity(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Prix Unitaire HT (DH)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    required
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                  {unitPrice && !isNaN(parseFloat(unitPrice)) && (
                    <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
                      Prix TTC estimé (avec 20% TVA) : {formatCurrency(parseFloat(unitPrice) * 1.2)}
                    </div>
                  )}
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
