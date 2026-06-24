import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency } from '../lib/format';
import { Plus, Search, Box, AlertTriangle, RefreshCw, Download, Pencil, Trash2, X, Network, Upload } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';


export default function SpareParts() {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [usingMockData, setUsingMockData] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

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
        { id: '3', name: 'Résistance Chauffante 2000W', part_number: 'RES-CH-2000W', category: 'Chauffage', quantity: 1, min_quantity: 2, unit_price: 45.00 },
        { id: '4', name: 'Courroie de transmission C-45', part_number: 'CRT-C-45', category: 'Moteur', quantity: 3, min_quantity: 2, unit_price: 22.50 }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParts();
  }, []);

  const handleAddNewClick = () => {
    setEditingItem(null);
    setName('');
    setPartNumber('');
    setCategory('');
    setQuantity('');
    setMinQuantity('2');
    setUnitPrice('');
    setShowModal(true);
  };

  const handleEditClick = (part, e) => {
    e.stopPropagation();
    setEditingItem(part);
    setName(part.name || '');
    setPartNumber(part.part_number || '');
    setCategory(part.category || '');
    setQuantity(part.quantity !== undefined ? part.quantity.toString() : '');
    setMinQuantity(part.min_quantity !== undefined ? part.min_quantity.toString() : '2');
    setUnitPrice(part.unit_price !== undefined ? part.unit_price.toString() : '');
    setShowModal(true);
  };

  const handleDeleteClick = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cette pièce ?")) return;

    if (usingMockData) {
      setParts(parts.filter(p => p.id !== id));
    } else {
      const { error } = await supabase
        .from('spare_parts')
        .delete()
        .eq('id', id);

      if (error) {
        alert("Erreur lors de la suppression : " + error.message);
      } else {
        fetchParts();
      }
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!name || !partNumber || !category || quantity === '' || unitPrice === '') return;

    const qty = parseInt(quantity);
    const minQty = parseInt(minQuantity) || 2;
    const price = parseFloat(unitPrice);

    if (editingItem) {
      const updatedPart = {
        ...editingItem,
        name,
        part_number: partNumber,
        category,
        quantity: qty,
        min_quantity: minQty,
        unit_price: price
      };

      if (usingMockData) {
        setParts(parts.map(p => p.id === editingItem.id ? updatedPart : p));
      } else {
        const { error } = await supabase
          .from('spare_parts')
          .update({
            name,
            part_number: partNumber,
            category,
            quantity: qty,
            min_quantity: minQty,
            unit_price: price
          })
          .eq('id', editingItem.id);

        if (error) {
          alert("Erreur lors de la modification : " + error.message);
        } else {
          fetchParts();
        }
      }
    } else {
      const newPart = {
        id: 'part-' + Date.now(),
        name,
        part_number: partNumber,
        category,
        quantity: qty,
        min_quantity: minQty,
        unit_price: price
      };

      if (usingMockData) {
        setParts([newPart, ...parts]);
      } else {
        const { error } = await supabase
          .from('spare_parts')
          .insert([newPart]);

        if (error) {
          alert("Erreur lors de l'insertion : " + error.message);
        } else {
          fetchParts();
        }
      }
    }

    // Reset fields & Close
    setName('');
    setPartNumber('');
    setCategory('');
    setQuantity('');
    setMinQuantity('2');
    setUnitPrice('');
    setEditingItem(null);
    setShowModal(false);
  };

  const handleExportCSV = () => {
    const BOM = "\uFEFF";
    const headers = ["Désignation", "Référence Fabricant", "Produit Parent", "Prix HT (DH)", "Prix TTC (DH)", "Stock Neuf", "Seuil d'Alerte"];
    const rows = parts.map(part => [
      part.name,
      part.part_number,
      part.category,
      part.unit_price,
      (part.unit_price * 1.2).toFixed(2),
      part.quantity,
      part.min_quantity
    ]);

    const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pieces_rechange_${new Date().toISOString().split('T')[0]}.csv`);
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

      // Map rows to spare_parts schema
      const itemsToInsert = parsed.rows.map(row => {
        const name = row.name || row.nom || row['désignation'] || row.designation || 'Pièce sans nom';
        const part_number = row.part_number || row.reference || row.ref || row['référence fabricant'] || row['référence'] || 'REF-NEW';
        const category = row.category || row.categorie || row['produit parent'] || 'Moteur';
        const quantity = Number(row.quantity || row.quantite || row.stock || row['stock neuf'] || 0);
        const unit_price = Number(row.price || row.prix || row.unit_price || row['prix ht'] || 0);
        const min_quantity = Number(row.min_quantity || row.alert || row['seuil d\'alerte'] || 2);

        return {
          id: 'part-' + Math.floor(Math.random() * 100000000000),
          name,
          part_number,
          category,
          quantity,
          unit_price,
          min_quantity
        };
      });

      if (usingMockData) {
        setParts(prev => [...itemsToInsert, ...prev]);
        alert(`${itemsToInsert.length} pièces de rechange importées localement avec succès !`);
      } else {
        try {
          const { error } = await supabase.from('spare_parts').insert(itemsToInsert);
          if (error) throw error;
          alert(`${itemsToInsert.length} pièces de rechange importées dans la base de données avec succès !`);
          await fetchParts();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset file input
  };


  // Get distinct parent products/categories
  const categories = [...new Set(parts.map(p => p.category))];

  // Filtering
  const filteredParts = parts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.part_number && p.part_number.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="stock-page-container">
      {/* Header section matching image */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Network size={28} style={{ color: 'var(--primary)' }} /> Stock Pièces de Rechange
          </h1>
          <p className="catalog-subtitle">Gérez vos composants liés aux produits principaux.</p>
        </div>
        <div className="catalog-header-actions">
          <input
            type="file"
            id="csv-import-parts-input"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          <button className="btn btn-white" onClick={() => document.getElementById('csv-import-parts-input').click()}>
            <Upload size={16} /> IMPORTER CSV
          </button>
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>
          <button className="btn btn-blue-action" onClick={handleAddNewClick}>
            <Plus size={16} /> NOUVELLE PIÈCE
          </button>
        </div>
      </div>

      {/* Filter and Search bar matching image */}
      <div className="catalog-filter-bar">
        <div className="search-input-wrapper" style={{ flexGrow: 1 }}>
          <Search size={18} className="search-icon" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Recherche par nom, référence..."
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
          <option value="all">Tous les produits parents</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <button 
          className="btn btn-white" 
          onClick={fetchParts} 
          title="Actualiser les données"
          style={{ padding: '12px', borderRadius: '12px' }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Empty State and Cards Grid matching image */}
      {loading ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: '#64748b', fontSize: '16px', fontWeight: '500' }}>
          Chargement des pièces...
        </div>
      ) : filteredParts.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-state-icon">
            <Box size={48} strokeWidth={1} />
          </div>
          <p className="empty-state-text">Aucune pièce de rechange trouvée.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredParts.map(part => {
            const isOutOfStock = (part.quantity || 0) === 0;
            const isLowStock = part.quantity <= part.min_quantity;
            const displayPrice = (part.unit_price || 0) * 1.2;

            return (
              <div key={part.id} className="product-card">
                <div className="product-card-header">
                  <div className="product-card-icon">
                    <Box size={20} />
                  </div>
                  <div className="product-card-actions">
                    <button className="action-icon-btn" onClick={(e) => handleEditClick(part, e)} title="Modifier">
                      <Pencil size={16} />
                    </button>
                    <button className="action-icon-btn delete" onClick={(e) => handleDeleteClick(part.id, e)} title="Supprimer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="product-tags">
                  <span className="tag-category">{part.category}</span>
                  {part.part_number && <span className="tag-sku">{part.part_number}</span>}
                </div>

                <h3 className="product-card-title">{part.name}</h3>

                <div className="product-card-body">
                  <div className="price-section-catalog">
                    <span className="price-label-catalog">PRIX D'ACHAT TTC</span>
                    <span className="price-value-catalog">{formatCurrency(displayPrice)}</span>
                  </div>

                  <div className="stock-section-catalog">
                    {isOutOfStock ? (
                      <span className="rupture-badge">RUPTURE DE STOCK</span>
                    ) : isLowStock ? (
                      <span className="warning-badge">STOCK FAIBLE</span>
                    ) : (
                      <span className="en-stock-badge">DISPONIBLE</span>
                    )}

                    <div className="stock-pill-catalog">
                      <span className="stock-pill-label">STOCK NEUF</span>
                      <span className="stock-pill-value" style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: '700'
                      }}>{part.quantity} pcs</span>
                    </div>

                    <div className="stock-pill-catalog" style={{ backgroundColor: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)' }}>
                      <span className="stock-pill-label" style={{ color: 'var(--text-secondary)' }}>ALERTE MIN</span>
                      <span className="stock-pill-value" style={{ 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        padding: '2px 10px', 
                        minWidth: '36px', 
                        textAlign: 'center', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text-secondary)'
                      }}>{part.min_quantity} pcs</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for adding/editing spare parts */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)' }}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>
              {editingItem ? "Modifier la Pièce" : "Ajouter une Pièce de Rechange"}
            </h3>
            <form onSubmit={handleFormSubmit}>
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
                  <label className="form-label">Référence Fabricant / Code</label>
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
                  <label className="form-label">Produit Parent / Catégorie</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="ex: Moteur, 12000BTU WEST..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantité en Stock</label>
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
