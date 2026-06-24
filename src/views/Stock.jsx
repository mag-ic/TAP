import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockStock } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { Plus, Search, Box, AlertTriangle, RefreshCw, Download, Pencil, Trash2, X, Upload } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';

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
        .from('inventaire')
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
    setQuantity(item.stock !== undefined ? item.stock.toString() : '');
    setDeclassedQuantity(item.declassedStock !== undefined ? item.declassedStock.toString() : '0');
    setMinQuantity(item.minStock !== undefined ? item.minStock.toString() : '5');
    setUnitPrice(item.price !== undefined ? item.price.toString() : '');
    setShowModal(true);
  };

  const handleDeleteClick = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cet article ?")) return;

    if (usingMockData) {
      setStockItems(stockItems.filter(item => item.id !== id));
    } else {
      const { error } = await supabase
        .from('inventaire')
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
        stock: qty,
        declassedStock: declQty,
        minStock: minQty,
        price: price
      };

      if (usingMockData) {
        setStockItems(stockItems.map(item => item.id === editingItem.id ? updatedItem : item));
      } else {
        const { error } = await supabase
          .from('inventaire')
          .update({
            name,
            sku,
            category,
            stock: qty,
            declassedStock: declQty,
            minStock: minQty,
            price: price
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
        stock: qty,
        declassedStock: declQty,
        minStock: minQty,
        price: price
      };

      if (usingMockData) {
        setStockItems([newItem, ...stockItems]);
      } else {
        const { error } = await supabase
          .from('inventaire')
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
    const headers = ["price", "sku", "category", "minStock", "name", "id", "stock", "declassedStock"];
    const rows = stockItems.map(item => [
      item.price,
      item.sku,
      item.category,
      item.minStock,
      item.name,
      item.id,
      item.stock,
      item.declassedStock || 0
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

      // Map rows to inventaire schema using user's explicit column keys
      const itemsToInsert = parsed.rows.map(row => {
        const name = row.name || row.nom || row.designation || row.title || 'Produit sans nom';
        const sku = row.sku || row.reference || row.ref || 'SKU-NEW';
        const category = row.category || row.categorie || 'Catégorie';
        const stock = Number(row.stock || row.quantity || row.quantite || row['stock neuf'] || 0);
        const price = Number(row.price || row.prix || row.unit_price || row['prix ht'] || 0);
        const declassedStock = Number(row.declassedstock || row.declassed_stock || row.declassed_quantity || row['quantite declassee'] || row['stock declasse'] || 0);
        const minStock = Number(row.minstock || row.min_stock || row.min_quantity || row.alert || row['seuil d\'alerte'] || 5);

        return {
          id: row.id || ('prod-' + Math.floor(Math.random() * 100000000000)),
          name,
          sku,
          category,
          stock,
          price,
          declassedStock,
          minStock
        };
      });

      if (usingMockData) {
        setStockItems(prev => [...itemsToInsert, ...prev]);
        alert(`${itemsToInsert.length} produits importés localement avec succès !`);
      } else {
        try {
          const { error } = await supabase.from('inventaire').insert(itemsToInsert);
          if (error) throw error;
          alert(`${itemsToInsert.length} produits importés dans la base de données avec succès !`);
          await fetchStock();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
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
      const valA = a.stock || 0;
      const valB = b.stock || 0;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  } else if (sortBy === 'price') {
    filteredItems.sort((a, b) => {
      const valA = a.price || 0;
      const valB = b.price || 0;
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
          <input
            type="file"
            id="csv-import-file-input"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button className="btn btn-white" onClick={() => document.getElementById('csv-import-file-input').click()}>
            <Upload size={16} /> IMPORTER CSV
          </button>
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
        <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '16px', fontWeight: '500', backgroundColor: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          Aucun produit ne correspond à votre recherche.
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredItems.map(item => {
            const isOutOfStock = (item.stock || 0) === 0;
            const displayPrice = (item.price || 0) * 1.2;

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
                        border: '1px solid rgba(56, 189, 248, 0.25)', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: '#111827',
                        color: '#38bdf8',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}>{item.stock}</span>
                    </div>

                    <div className="declassed-pill-catalog">
                      <span className="declassed-pill-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <AlertTriangle size={10} style={{ strokeWidth: 3 }} /> A DÉCLASSÉ
                      </span>
                      <span className="declassed-pill-value" style={{ 
                        border: '1px solid rgba(248, 113, 113, 0.25)', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: '#111827',
                        color: '#f87171',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}>{item.declassedStock || 0}</span>
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
