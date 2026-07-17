import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { mockTransactions, mockPartners, mockStock } from '../lib/mockData';
import { formatCurrency } from '../lib/format';
import { ArrowUpDown, RefreshCw, Search, ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronUp, Plus, Download, Upload, Eye, Pencil, FileText, Trash2, X, History, MapPin, RotateCcw, Box, Percent } from 'lucide-react';
import { parseCSV } from '../lib/csvHelper';
import { printDocument } from '../lib/printHelper';
import { useIsReadOnly } from '../lib/UserContext';

export default function EntreesVentes({ initialTab = 'entrees' }) {
  const isReadOnly = useIsReadOnly();
  const [transactions, setTransactions] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [clients, setClients] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState(initialTab); // 'entrees' | 'ventes'
  const [subSubTab, setSubSubTab] = useState('bc'); // 'bc' | 'avances' (only for entrees)
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [usingMockData, setUsingMockData] = useState(false);
  const [selectedVenteIds, setSelectedVenteIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  // Commission Modal States
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [selectedVenteForCommission, setSelectedVenteForCommission] = useState(null);
  const [commissionResponsable, setCommissionResponsable] = useState('');
  const [commissionDate, setCommissionDate] = useState(new Date().toISOString().split('T')[0]);
  const [commissionMethod, setCommissionMethod] = useState('Virement');
  const [commissionStatus, setCommissionStatus] = useState('en_attente');
  const [commissionItems, setCommissionItems] = useState([]);

  useEffect(() => {
    setActiveSubTab(initialTab);
    setSearchTerm('');
    setSelectedVenteIds([]);
  }, [initialTab]);

  useEffect(() => {
    setSelectedVenteIds([]);
    setSortConfig({ key: 'date', direction: 'desc' });
  }, [activeSubTab, subSubTab]);

  // Date Filters for Sales History
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Nouvel Arrivage Form States (Entrées)
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedFournisseur, setSelectedFournisseur] = useState('');
  const [addedItems, setAddedItems] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemUnitPriceTTC, setItemUnitPriceTTC] = useState('');

  // Nouvelle Avance Form States (Entrées)
  const [avanceDate, setAvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [avanceFournisseur, setAvanceFournisseur] = useState('');
  const [avanceAmount, setAvanceAmount] = useState('');
  const [avanceMethod, setAvanceMethod] = useState('Virement');

  // Nouvelle Vente Form States (Ventes)
  const [venteClient, setVenteClient] = useState('');
  const [venteDate, setVenteDate] = useState(new Date().toISOString().split('T')[0]);
  const [venteReglement, setVenteReglement] = useState('Espèces');
  const [venteItems, setVenteItems] = useState([]);
  const [venteProductId, setVenteProductId] = useState('');
  const [venteStockType, setVenteStockType] = useState('Neuf'); // 'Neuf' | 'Déclassé'
  const [venteQty, setVenteQty] = useState('1');
  const [ventePriceTTC, setVentePriceTTC] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Transactions
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (txError) throw new Error('DB tables missing');

      // Fetch Partners
      const { data: pData } = await supabase.from('partners').select('*');
      
      // Fetch Stock
      const { data: sData } = await supabase.from('inventaire').select('*').order('name', { ascending: true });

      setTransactions(txData || []);
      setFournisseurs(pData?.filter(p => p.type === 'fournisseur') || []);
      setClients(pData?.filter(p => p.type === 'client') || []);
      
      const mappedStock = sData?.map(item => ({
        ...item,
        minStock: item.minstock !== undefined ? item.minstock : item.minStock,
        declassedStock: item.declassedstock !== undefined ? item.declassedstock : item.declassedStock
      })) || [];
      setStockItems(mappedStock);
      setUsingMockData(false);
    } catch (err) {
      setUsingMockData(true);
      setTransactions(mockTransactions);
      setFournisseurs(mockPartners.filter(p => p.type === 'fournisseur'));
      setClients(mockPartners.filter(p => p.type === 'client'));
      setStockItems(mockStock);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Safe parsing helper
  const parseItems = (itemsStr) => {
    if (!itemsStr) return [];
    try {
      if (typeof itemsStr === 'object') return itemsStr;
      return JSON.parse(itemsStr);
    } catch (e) {
      return [];
    }
  };

  // Helper to extract BC/AR reference from description
  const getBCReference = (description) => {
    if (!description) return 'BC-26-XXXX';
    const match = description.match(/(BC-\d+-\d+|BC\d+|AR-\d+-\d+|AR\d+|INV-\d+-\d+)/);
    return match ? match[0] : (description.replace('Entrée ', '').replace('Facture ', '').split(' - ')[0] || description);
  };

  // Helper to convert invoice reference to BL reference
  const getBLReference = (description) => {
    if (!description) return 'BL-26-XXXX';
    const ref = getBCReference(description);
    return ref.replace('INV-', 'BL-').replace('BC-', 'BL-').replace('Facture ', 'BL-');
  };

  // Reset date range filters
  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  // Add Item to current arrivage (Entrées)
  const handleAddItemToArrivage = (e) => {
    e.preventDefault();
    if (!selectedProductId || !itemQuantity || !itemUnitPriceTTC) return;

    const prod = stockItems.find(s => s.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(itemQuantity);
    const priceTTC = parseFloat(itemUnitPriceTTC);

    const newItem = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      quantity: qty,
      unitPriceTTC: priceTTC,
      costPrice: priceTTC / 1.2
    };

    setAddedItems([...addedItems, newItem]);
    setSelectedProductId('');
    setItemQuantity('1');
    setItemUnitPriceTTC('');
  };

  // Save Arrivage (BC)
  const handleSaveArrivage = async () => {
    if (!selectedFournisseur || addedItems.length === 0) return;

    const supplier = fournisseurs.find(f => f.id === selectedFournisseur || f.name === selectedFournisseur);
    const supplierName = supplier ? supplier.name : selectedFournisseur;

    const achatCount = transactions.filter(t => t.type === 'achat').length;
    const nextBcNum = 10 + achatCount;
    const bcRef = `BC-26-000${nextBcNum}`;

    const totalHT = addedItems.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);
    const totalTTC = totalHT * 1.2;

    const newTx = {
      id: 'ste-' + Date.now(),
      type: 'achat',
      amount: totalTTC,
      description: `Entrée ${bcRef} - PO: ${bcRef}`,
      partner_name: supplierName,
      date: receptionDate,
      payment_method: 'Virement',
      status: 'confirmé',
      items: JSON.stringify(addedItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        costPrice: item.costPrice
      })))
    };

    if (usingMockData) {
      addedItems.forEach(item => {
        const prod = mockStock.find(s => s.id === item.productId);
        if (prod) prod.stock = (prod.stock || 0) + item.quantity;
      });
      setTransactions([newTx, ...transactions]);
      alert(`Arrivage ${bcRef} validé avec succès (Mode Démo) !`);
    } else {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
        return;
      }

      for (const item of addedItems) {
        const { data: stockData } = await supabase.from('inventaire').select('stock').eq('id', item.productId).single();
        if (stockData) {
          const newQty = (stockData.stock || 0) + item.quantity;
          await supabase.from('inventaire').update({ stock: newQty }).eq('id', item.productId);
        }
      }
      fetchData();
      alert(`Arrivage ${bcRef} enregistré avec succès !`);
    }

    setSelectedFournisseur('');
    setAddedItems([]);
  };

  // Save Advance Fournisseur
  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!avanceFournisseur || !avanceAmount) return;

    const supplier = fournisseurs.find(f => f.id === avanceFournisseur || f.name === avanceFournisseur);
    const supplierName = supplier ? supplier.name : avanceFournisseur;
    const amount = parseFloat(avanceAmount);

    const advanceRef = `ADV-26-000${transactions.length + 1}`;

    const newTx = {
      id: 'ste-adv-' + Date.now(),
      type: 'charge',
      amount: amount,
      description: `Avance Fournisseur ${advanceRef}`,
      partner_name: supplierName,
      date: avanceDate,
      payment_method: avanceMethod,
      status: 'confirmé',
      items: JSON.stringify([{ productName: 'Avance Fournisseur', quantity: 1, costPrice: amount }])
    };

    if (usingMockData) {
      setTransactions([newTx, ...transactions]);
      alert("Avance enregistrée avec succès (Mode Démo) !");
    } else {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) {
        alert("Erreur lors de la création de l'avance : " + error.message);
      } else {
        fetchData();
        alert("Avance enregistrée avec succès !");
      }
    }

    setAvanceFournisseur('');
    setAvanceAmount('');
  };

  // Add Item to current sale (Ventes)
  const handleAddItemToVente = (e) => {
    e.preventDefault();
    if (!venteProductId || !venteQty || !ventePriceTTC) return;

    const prod = stockItems.find(s => s.id === venteProductId);
    if (!prod) return;

    const qty = parseInt(venteQty);
    const priceTTC = parseFloat(ventePriceTTC);

    const newItem = {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      stockType: venteStockType, // 'Neuf' or 'Déclassé'
      quantity: qty,
      unitPriceHT: priceTTC / 1.2,
      totalHT: (priceTTC / 1.2) * qty,
      priceTTC: priceTTC
    };

    setVenteItems([...venteItems, newItem]);
    setVenteProductId('');
    setVenteQty('1');
    setVentePriceTTC('');
  };

  // Save Vente (Bon de Livraison)
  const handleSaveVente = async () => {
    if (!venteClient || venteItems.length === 0) return;

    const client = clients.find(c => c.id === venteClient || c.name === venteClient);
    const clientName = client ? client.name : venteClient;

    const salesCount = transactions.filter(t => t.type === 'vente' || t.type === 'bl').length;
    const blRef = `BL-26-000${salesCount + 10}`;

    const totalHT = venteItems.reduce((acc, item) => acc + item.totalHT, 0);
    const totalTTC = totalHT * 1.2;

    const newTx = {
      id: 'bl-gen-' + Date.now(),
      type: 'bl',
      amount: totalTTC,
      description: `Bon de Livraison ${blRef}`,
      partner_name: clientName,
      date: venteDate,
      payment_method: venteReglement,
      status: 'confirmé',
      items: JSON.stringify(venteItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        stockType: item.stockType,
        quantity: item.quantity,
        unitPriceHT: item.unitPriceHT,
        totalHT: item.totalHT
      })))
    };

    if (usingMockData) {
      venteItems.forEach(item => {
        const prod = mockStock.find(s => s.id === item.id || s.productId === item.id || s.id === item.productId);
        if (prod) {
          if (item.stockType === 'Déclassé') {
            prod.declassedStock = Math.max(0, (prod.declassedStock || 0) - item.quantity);
          } else {
            prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
          }
        }
      });
      setTransactions([newTx, ...transactions]);
      alert(`Bon de Livraison ${blRef} validé avec succès (Mode Démo) !`);
    } else {
      const { error } = await supabase.from('transactions').insert([newTx]);
      if (error) {
        alert("Erreur lors de l'insertion dans Supabase : " + error.message);
        return;
      }

      for (const item of venteItems) {
        const { data: stockData } = await supabase.from('inventaire').select('stock, declassedstock').eq('id', item.productId).single();
        if (stockData) {
          if (item.stockType === 'Déclassé') {
            const newQty = Math.max(0, (stockData.declassedstock || 0) - item.quantity);
            await supabase.from('inventaire').update({ declassedstock: newQty }).eq('id', item.productId);
          } else {
            const newQty = Math.max(0, (stockData.stock || 0) - item.quantity);
            await supabase.from('inventaire').update({ stock: newQty }).eq('id', item.productId);
          }
        }
      }
      fetchData();
      alert(`Bon de Livraison ${blRef} enregistré avec succès !`);
    }

    setVenteClient('');
    setVenteItems([]);
  };

  // Convert Bon de Livraison (BL) to Invoice (Facture)
  const handleConvertToInvoice = async (tx, e) => {
    if (e) e.stopPropagation();
    
    const blRef = getBLReference(tx.description);
    if (!window.confirm(`Voulez-vous transformer le Bon de Livraison ${blRef} en Facture ?`)) return;

    const venteCount = transactions.filter(t => t.type === 'vente').length;
    const invRef = `INV-26-000${venteCount + 10}`;
    const newDescription = `Facture ${invRef} (ex ${blRef})`;

    if (usingMockData) {
      const updatedTxs = transactions.map(t => {
        if (t.id === tx.id) {
          return {
            ...t,
            type: 'vente',
            description: newDescription,
            status: 'en_attente'
          };
        }
        return t;
      });
      setTransactions(updatedTxs);
      alert(`Le BL a été converti en Facture ${invRef} (Mode Démo) !`);
    } else {
      try {
        const { error } = await supabase
          .from('transactions')
          .update({
            type: 'vente',
            description: newDescription,
            status: 'en_attente'
          })
          .eq('id', tx.id);

        if (error) throw error;
        await fetchData();
        alert(`Le BL a été converti en Facture ${invRef} avec succès !`);
      } catch (err) {
        alert("Erreur lors de la conversion : " + err.message);
      }
    }
  };

  const handleOpenCommissionModal = (tx) => {
    const itemsList = parseItems(tx.items);
    const mappedItems = itemsList.map(item => ({
      productName: item.productName || 'Produit Inconnu',
      sku: item.sku || '',
      quantity: Number(item.quantity || 0),
      commissionPerUnit: 0
    }));

    setSelectedVenteForCommission(tx);
    setCommissionResponsable('');
    setCommissionDate(new Date().toISOString().split('T')[0]);
    setCommissionMethod('Virement');
    setCommissionStatus('en_attente');
    setCommissionItems(mappedItems);
    setShowCommissionModal(true);
  };

  const handleSaveCommission = async (e) => {
    if (e) e.preventDefault();
    if (!selectedVenteForCommission) return;

    if (!commissionResponsable.trim()) {
      alert("Veuillez saisir le nom du responsable.");
      return;
    }

    const totalAmount = commissionItems.reduce((sum, item) => sum + (item.commissionPerUnit * item.quantity), 0);
    if (totalAmount <= 0) {
      alert("Le montant de la commission doit être supérieur à 0.");
      return;
    }

    const blRef = getBLReference(selectedVenteForCommission.description);
    const newTx = {
      id: 'tx-comm-' + Date.now(),
      type: 'charge',
      amount: totalAmount,
      description: `Commission ${commissionResponsable} sur ${blRef}`,
      partner_name: commissionResponsable,
      date: commissionDate,
      payment_method: commissionMethod,
      status: commissionStatus,
      items: JSON.stringify(commissionItems.map(item => ({
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        commissionPerUnit: item.commissionPerUnit,
        total: item.commissionPerUnit * item.quantity
      })))
    };

    if (usingMockData) {
      mockTransactions.unshift(newTx);
      setTransactions(prev => [newTx, ...prev]);
      alert(`La commission de ${formatCurrency(totalAmount)} a été ajoutée avec succès aux charges (Mode Démo) !`);
    } else {
      try {
        const { error } = await supabase
          .from('transactions')
          .insert([newTx]);

        if (error) throw error;
        await fetchData();
        alert(`La commission de ${formatCurrency(totalAmount)} a été ajoutée avec succès aux charges !`);
      } catch (err) {
        alert("Erreur lors de l'enregistrement de la commission : " + err.message);
        return;
      }
    }

    setShowCommissionModal(false);
    setSelectedVenteForCommission(null);
  };

  const handleDeleteTransaction = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Voulez-vous vraiment supprimer cette ligne ?")) return;

    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    if (usingMockData) {
      const itemsList = parseItems(tx.items);
      let updatedStock = [...stockItems];
      if (tx.type === 'bl' || tx.type === 'vente') {
        for (const item of itemsList) {
          updatedStock = updatedStock.map(si => {
            const isMatch = (item.productId && si.id === item.productId) || (item.sku && si.sku === item.sku) || (item.productName && si.name === item.productName);
            if (isMatch) {
              if (item.stockType === 'Déclassé') {
                return { ...si, declassedStock: (si.declassedStock || 0) + item.quantity };
              } else {
                return { ...si, stock: (si.stock || 0) + item.quantity };
              }
            }
            return si;
          });
        }
      } else if (tx.type === 'achat') {
        for (const item of itemsList) {
          updatedStock = updatedStock.map(si => {
            const isMatch = (item.productId && si.id === item.productId) || (item.sku && si.sku === item.sku) || (item.productName && si.name === item.productName);
            if (isMatch) {
              return { ...si, stock: Math.max(0, (si.stock || 0) - item.quantity) };
            }
            return si;
          });
        }
      }
      setStockItems(updatedStock);
      setTransactions(transactions.filter(t => t.id !== id));
      alert("Transaction supprimée localement !");
    } else {
      try {
        const itemsList = parseItems(tx.items);
        if (tx.type === 'bl' || tx.type === 'vente') {
          for (const item of itemsList) {
            let stockData = null;
            let targetId = item.productId;
            
            if (targetId) {
              const { data } = await supabase.from('inventaire').select('id, stock, declassedstock').eq('id', targetId).single();
              stockData = data;
            }
            
            if (!stockData && item.sku) {
              const { data } = await supabase.from('inventaire').select('id, stock, declassedstock').eq('sku', item.sku).limit(1);
              if (data && data.length > 0) {
                stockData = data[0];
                targetId = stockData.id;
              }
            }
            
            if (!stockData && item.productName) {
              const { data } = await supabase.from('inventaire').select('id, stock, declassedstock').eq('name', item.productName).limit(1);
              if (data && data.length > 0) {
                stockData = data[0];
                targetId = stockData.id;
              }
            }

            if (stockData && targetId) {
              if (item.stockType === 'Déclassé') {
                const newQty = (stockData.declassedstock || 0) + item.quantity;
                await supabase.from('inventaire').update({ declassedstock: newQty }).eq('id', targetId);
              } else {
                const newQty = (stockData.stock || 0) + item.quantity;
                await supabase.from('inventaire').update({ stock: newQty }).eq('id', targetId);
              }
            }
          }
        } else if (tx.type === 'achat') {
          for (const item of itemsList) {
            let stockData = null;
            let targetId = item.productId;
            
            if (targetId) {
              const { data } = await supabase.from('inventaire').select('id, stock').eq('id', targetId).single();
              stockData = data;
            }
            
            if (!stockData && item.sku) {
              const { data } = await supabase.from('inventaire').select('id, stock').eq('sku', item.sku).limit(1);
              if (data && data.length > 0) {
                stockData = data[0];
                targetId = stockData.id;
              }
            }
            
            if (!stockData && item.productName) {
              const { data } = await supabase.from('inventaire').select('id, stock').eq('name', item.productName).limit(1);
              if (data && data.length > 0) {
                stockData = data[0];
                targetId = stockData.id;
              }
            }

            if (stockData && targetId) {
              const newQty = Math.max(0, (stockData.stock || 0) - item.quantity);
              await supabase.from('inventaire').update({ stock: newQty }).eq('id', targetId);
            }
          }
        }

        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);

        if (error) throw error;
        setSelectedVenteIds(prev => prev.filter(vid => vid !== id));
        alert("Transaction supprimée avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de la suppression : " + err.message);
      }
    }
  };

  const handleDeleteSelectedVentes = async () => {
    if (selectedVenteIds.length === 0) return;
    if (!window.confirm(`Voulez-vous vraiment supprimer les ${selectedVenteIds.length} ventes sélectionnées ?`)) return;

    if (usingMockData) {
      let updatedStock = [...stockItems];
      for (const id of selectedVenteIds) {
        const tx = transactions.find(t => t.id === id);
        if (tx && (tx.type === 'bl' || tx.type === 'vente')) {
          const itemsList = parseItems(tx.items);
          for (const item of itemsList) {
            updatedStock = updatedStock.map(si => {
              if (si.id === item.productId) {
                if (item.stockType === 'Déclassé') {
                  return { ...si, declassedStock: (si.declassedStock || 0) + item.quantity };
                } else {
                  return { ...si, stock: (si.stock || 0) + item.quantity };
                }
              }
              return si;
            });
          }
        }
      }
      setStockItems(updatedStock);
      setTransactions(transactions.filter(t => !selectedVenteIds.includes(t.id)));
      setSelectedVenteIds([]);
      alert("Ventes supprimées avec succès (Mode Démo) !");
    } else {
      try {
        for (const id of selectedVenteIds) {
          const tx = transactions.find(t => t.id === id);
          if (tx && (tx.type === 'bl' || tx.type === 'vente')) {
            const itemsList = parseItems(tx.items);
            for (const item of itemsList) {
              const { data: stockData } = await supabase.from('inventaire').select('stock, declassedstock').eq('id', item.productId).single();
              if (stockData) {
                if (item.stockType === 'Déclassé') {
                  const newQty = (stockData.declassedstock || 0) + item.quantity;
                  await supabase.from('inventaire').update({ declassedstock: newQty }).eq('id', item.productId);
                } else {
                  const newQty = (stockData.stock || 0) + item.quantity;
                  await supabase.from('inventaire').update({ stock: newQty }).eq('id', item.productId);
                }
              }
            }
          }
        }

        const { error } = await supabase
          .from('transactions')
          .delete()
          .in('id', selectedVenteIds);

        if (error) throw error;
        setSelectedVenteIds([]);
        alert("Ventes supprimées avec succès !");
        await fetchData();
      } catch (err) {
        alert("Erreur lors de la suppression groupée : " + err.message);
      }
    }
  };

  const handleDeleteClick = handleDeleteTransaction;

  const handleExportCSV = () => {
    const BOM = "\uFEFF";
    
    if (activeSubTab === 'entrees') {
      const headers = ["Référence BC/Avance", "Date", "Fournisseur", "Montant TTC (DH)", "Méthode", "Statut"];
      const rows = filteredTxs.map(t => [
        getBCReference(t.description),
        t.date,
        t.partner_name || '',
        t.amount,
        t.payment_method || 'Virement',
        t.status
      ]);
      const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `arrivages_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // totalHT,totalTTC,id,clientId,date,paymentMethod,items,clientName,deliveryNumber
      const headers = ["totalHT", "totalTTC", "id", "clientId", "date", "paymentMethod", "items", "clientName", "deliveryNumber"];
      const rows = filteredTxs.map(t => {
        const totalTTC = t.amount || 0;
        const totalHT = totalTTC / 1.2;
        return [
          totalHT.toFixed(2),
          totalTTC.toFixed(2),
          t.id,
          t.partner_id || '',
          t.date,
          t.payment_method || 'Espèces',
          t.items ? (typeof t.items === 'object' ? JSON.stringify(t.items) : t.items).replace(/"/g, '""') : '[]',
          t.partner_name || '',
          getBLReference(t.description)
        ];
      });
      const csvContent = BOM + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ventes_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
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

      const newTxs = [];
      parsed.rows.forEach(row => {
        const id = row.id || 'inv-gen-' + Math.floor(Math.random() * 100000000000);
        const date = row.date || new Date().toISOString().split('T')[0];
        const clientName = row.clientname || row.clientName || row.client_name || row.client || row.partner_name || 'Client Inconnu';
        const clientId = row.clientid || row.clientId || row.client_id || row.partner_id || null;
        
        let totalTTC = parseFloat((row.totalttc || row.totalTTC || row.amount || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
        let totalHT = parseFloat((row.totalht || row.totalHT || '0').toString().replace(/[^\d.,-]/g, '').replace(',', '.'));
        
        if (isNaN(totalTTC)) {
          if (!isNaN(totalHT) && totalHT > 0) {
            totalTTC = totalHT * 1.2;
          } else {
            totalTTC = 0;
          }
        }
        
        const paymentMethod = row.paymentmethod || row.paymentMethod || row.payment_method || 'Espèces';
        const deliveryNumber = row.deliverynumber || row.deliveryNumber || row.delivery_number || row.bl_number || row.num_bl || 'BL-26-XXXX';
        
        let itemsStr = '[]';
        if (row.items) {
          try {
            JSON.parse(row.items);
            itemsStr = row.items;
          } catch (err) {
            itemsStr = JSON.stringify([{ productName: 'Article Importé', quantity: 1, costPrice: totalTTC / 1.2 }]);
          }
        } else {
          itemsStr = JSON.stringify([{ productName: 'Article Importé', quantity: 1, costPrice: totalTTC / 1.2 }]);
        }

        newTxs.push({
          id,
          type: activeSubTab === 'entrees' ? 'achat' : 'vente',
          amount: totalTTC,
          description: activeSubTab === 'entrees' ? `Entrée ${deliveryNumber}` : `Facture ${deliveryNumber}`,
          partner_id: clientId,
          partner_name: clientName,
          date,
          payment_method: paymentMethod,
          status: 'confirmé',
          items: itemsStr
        });
      });

      if (newTxs.length === 0) return;

      if (usingMockData) {
        setTransactions(prev => [...newTxs, ...prev]);
        alert(`${newTxs.length} ventes importées avec succès localement !`);
      } else {
        try {
          const { error } = await supabase.from('transactions').insert(newTxs);
          if (error) throw error;
          alert(`${newTxs.length} ventes importées avec succès dans la base de données !`);
          await fetchData();
        } catch (err) {
          alert("Erreur lors de l'importation : " + err.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter Transactions based on Tabs
  const displayedTxs = transactions.filter(t => {
    if (activeSubTab === 'entrees') {
      if (subSubTab === 'bc') {
        return t.type === 'achat';
      } else {
        return t.type === 'charge' && t.description?.toLowerCase().includes('avance');
      }
    } else {
      return t.type === 'vente' || t.type === 'revenu' || t.type === 'bl';
    }
  });

  const filteredTxs = displayedTxs.filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.partner_name && t.partner_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && t.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && t.date <= endDate;
    }
    
    return matchesSearch && matchesDate;
  });

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return '';
  };

  const sortedTxs = React.useMemo(() => {
    let sortableItems = [...filteredTxs];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];

        if (sortConfig.key === 'reference') {
          valA = a.description || '';
          valB = b.description || '';
        } else if (sortConfig.key === 'partner_name') {
          valA = a.partner_name || '';
          valB = b.partner_name || '';
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (sortConfig.key === 'amount') {
          return sortConfig.direction === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
        }

        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredTxs, sortConfig]);

  return (
    <div className="stock-page-container">
      {/* Header section matching images */}
      <div className="catalog-header">
        <div className="catalog-title-wrapper">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeSubTab === 'entrees' ? 'Arrivages & Achats' : 'Ventes & Livraisons'}
          </h1>
          <p className="catalog-subtitle">
            {activeSubTab === 'entrees' 
              ? 'Gérez vos réceptions et vos avances fournisseurs.' 
              : 'Gérez vos sorties de stock (Neuf & Déclassé) et BL.'}
          </p>
        </div>
        
        <div className="catalog-header-actions" style={{ alignItems: 'center' }}>
          <input
            type="file"
            id="csv-import-sales-input"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleImportCSV}
          />
          {!isReadOnly && (
            <button className="btn btn-white" onClick={() => document.getElementById('csv-import-sales-input').click()}>
              <Upload size={16} /> IMPORTER CSV
            </button>
          )}
          <button className="btn btn-white" onClick={handleExportCSV}>
            <Download size={16} /> EXPORTER CSV
          </button>

          {activeSubTab === 'entrees' && (
            /* Sub sub tab switcher for Arrivages (BC) vs Avances */
            <div className="tab-switcher" style={{ margin: 0, padding: '2px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '12px', display: 'inline-flex' }}>
              <button 
                className={`tab-btn ${subSubTab === 'bc' ? 'active' : ''}`}
                style={{ 
                  textTransform: 'uppercase', 
                  fontSize: '11px', 
                  letterSpacing: '0.5px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: subSubTab === 'bc' ? 'var(--primary)' : 'transparent',
                  color: subSubTab === 'bc' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: subSubTab === 'bc' ? '0 4px 12px rgba(26, 115, 232, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
                onClick={() => setSubSubTab('bc')}
              >
                Arrivages (BC)
              </button>
              <button 
                className={`tab-btn ${subSubTab === 'avances' ? 'active' : ''}`}
                style={{ 
                  textTransform: 'uppercase', 
                  fontSize: '11px', 
                  letterSpacing: '0.5px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  backgroundColor: subSubTab === 'avances' ? 'var(--primary)' : 'transparent',
                  color: subSubTab === 'avances' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: subSubTab === 'avances' ? '0 4px 12px rgba(26, 115, 232, 0.2)' : 'none',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
                onClick={() => setSubSubTab('avances')}
              >
                Avances
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RENDER FOR ARRIVAGES (BC) VIEW */}
      {activeSubTab === 'entrees' && subSubTab === 'bc' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card: Nouvel Arrivage (BC) */}
          {!isReadOnly && (
            <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '24px' }}>Nouvel Arrivage (BC)</h3>
            
            <form onSubmit={handleAddItemToArrivage}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>DATE RÉCEPTION</span>
                  <input
                    type="date"
                    className="form-input"
                    value={receptionDate}
                    onChange={(e) => setReceptionDate(e.target.value)}
                    onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>FOURNISSEUR</span>
                  <select
                    className="select-category-catalog"
                    value={selectedFournisseur}
                    onChange={(e) => setSelectedFournisseur(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Choisir Fournisseur...</option>
                    {fournisseurs.map(f => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: '#10b981' }}>JUSTIFICATIF (IMAGE/PDF)</span>
                  <button 
                    type="button" 
                    onClick={() => alert("Simulateur d'upload activé : Fichier attaché !")}
                    style={{ 
                      border: '2px dashed rgba(16, 185, 129, 0.3)', 
                      backgroundColor: 'rgba(16, 185, 129, 0.08)', 
                      color: '#10b981', 
                      borderRadius: '12px', 
                      padding: '12px 24px', 
                      fontWeight: '700', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      width: '100%',
                      height: '46px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Upload size={16} /> UPLOADER FACTURE
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr auto', gap: '16px', alignItems: 'flex-end', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>PRODUIT À STOCKER</span>
                  <select
                    className="select-category-catalog"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="">Choisir un article...</option>
                    {stockItems.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Stock: {p.stock} (Neuf) / {p.declassedStock || 0} (Déclassé)
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>QUANTITÉ</span>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>P.U. TTC (DH)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant"
                    className="form-input"
                    value={itemUnitPriceTTC}
                    onChange={(e) => setItemUnitPriceTTC(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: '700', color: 'var(--text-primary)' }}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-blue-action" 
                  style={{ height: '46px', padding: '0 32px', borderRadius: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  AJOUTER
                </button>
              </div>
            </form>

            {/* List of currently added items in this BC */}
            {addedItems.length > 0 && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Composants de l'arrivage en cours :</h4>
                <div className="table-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: '700' }}>
                        <th style={{ padding: '10px 8px' }}>SKU</th>
                        <th style={{ padding: '10px 8px' }}>DÉSIGNATION</th>
                        <th style={{ padding: '10px 8px' }}>QUANTITÉ</th>
                        <th style={{ padding: '10px 8px' }}>P.U. TTC</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL TTC</th>
                        <th style={{ padding: '10px 8px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {addedItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: '600' }}>{item.sku}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.productName}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '600' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 8px' }}>{formatCurrency(item.unitPriceTTC)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(item.quantity * item.unitPriceTTC)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button 
                              type="button" 
                              className="action-icon-btn delete" 
                              onClick={() => setAddedItems(addedItems.filter((_, i) => i !== idx))}
                              style={{ color: 'var(--danger)' }}
                              title="Supprimer la ligne"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', backgroundColor: 'var(--bg-main)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-secondary)' }}>
                    TOTAL DU BON DE COMMANDE : <span style={{ color: 'var(--primary)', fontSize: '20px', marginLeft: '8px' }}>{formatCurrency(addedItems.reduce((acc, item) => acc + (item.quantity * item.unitPriceTTC), 0))}</span>
                  </div>
                  <button type="button" className="btn btn-blue-action" onClick={handleSaveArrivage} style={{ padding: '12px 28px', borderRadius: '12px' }}>
                    VALIDER L'ARRIVAGE (BC)
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Card: Historique des Arrivages (BC) */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px' }}>
                <History size={16} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Historique des Arrivages (BC)</h3>
            </div>

            {filteredTxs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Aucun arrivage enregistré.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', borderBottom: '1px solid var(--border-color)' }}></th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('reference')}>RÉFÉRENCE BC{getSortIndicator('reference')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('date')}>DATE{getSortIndicator('date')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>FOURNISSEUR{getSortIndicator('partner_name')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>TOTAL TTC{getSortIndicator('amount')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTxs.map((tx) => {
                      const itemsList = parseItems(tx.items);
                      const isExpanded = expandedRows[tx.id];

                      return (
                        <React.Fragment key={tx.id}>
                          <tr style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={() => toggleRow(tx.id)}>
                            <td>
                              {itemsList.length > 0 ? (
                                isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                              ) : null}
                            </td>
                            <td style={{ padding: '20px 16px', fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                              {getBCReference(tx.description)}
                            </td>
                            <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                              {tx.date}
                            </td>
                            <td style={{ padding: '20px 16px' }}>
                              <span style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>
                                {tx.partner_name || 'N/A'}
                              </span>
                            </td>
                            <td style={{ padding: '20px 16px', fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>
                              {formatCurrency(tx.amount)}
                            </td>
                            <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '14px', alignItems: 'center', color: '#cbd5e1' }}>
                                <button className="action-icon-btn" style={{ color: '#2563eb' }} onClick={(e) => { e.stopPropagation(); toggleRow(tx.id); }} title="Voir details">
                                  <Eye size={18} />
                                </button>
                                {!isReadOnly && (
                                  <button className="action-icon-btn" style={{ color: '#f59e0b' }} onClick={(e) => { e.stopPropagation(); alert("Edition de l'arrivage " + getBCReference(tx.description)); }} title="Modifier">
                                    <Pencil size={16} />
                                  </button>
                                )}
                                {!isReadOnly && (
                                  <button 
                                    className="action-icon-btn delete" 
                                    style={{ color: 'var(--danger)' }} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTransaction(tx.id, e);
                                    }} 
                                    title="Supprimer l'arrivage"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                                <button className="action-icon-btn" style={{ color: '#3b82f6' }} onClick={(e) => {
                                  e.stopPropagation();
                                  const supplier = fournisseurs.find(f => f.name === tx.partner_name);
                                  printDocument({
                                    type: "BON D'ARRIVAGE",
                                    reference: getBCReference(tx.description),
                                    date: tx.date,
                                    clientName: tx.partner_name || 'Fournisseur Inconnu',
                                    clientICE: supplier?.ice || '',
                                    clientIF: supplier?.if_id || '',
                                    items: parseItems(tx.items)
                                  });
                                }} title="Bon d'Arrivage PDF">
                                  <FileText size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded items row */}
                          {isExpanded && itemsList.length > 0 && (
                            <tr>
                              <td colSpan="6" style={{ padding: '0 16px 20px 56px', backgroundColor: 'transparent' }}>
                                <div style={{ padding: '16px', borderLeft: '3px solid var(--primary)', background: 'var(--bg-main)', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-color)', borderLeftWidth: '3px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Détail des Articles achetés :</div>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: '700' }}>
                                        <th style={{ padding: '8px 0' }}>SKU</th>
                                        <th>DÉSIGNATION</th>
                                        <th>QUANTITÉ</th>
                                        <th>P.U. TTC</th>
                                        <th style={{ textAlign: 'right' }}>TOTAL TTC</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {itemsList.map((item, idx) => {
                                        const qty = item.quantity || 0;
                                        const price = item.unitPriceTTC || item.unitPrice || 0;
                                        const total = qty * price;
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                            <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: '600' }}>{item.sku}</td>
                                            <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.productName}</td>
                                            <td style={{ fontWeight: '600' }}>{qty}</td>
                                            <td>{formatCurrency(price)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(total)}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER FOR AVANCES VIEW */}
      {activeSubTab === 'entrees' && subSubTab === 'avances' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card: Nouvelle Avance */}
          {!isReadOnly && (
            <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '24px' }}>Nouvelle Avance Fournisseur</h3>
            
            <form onSubmit={handleSaveAdvance}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'flex-end', marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>DATE DE PAIEMENT</span>
                  <input
                    type="date"
                    className="form-input"
                    value={avanceDate}
                    onChange={(e) => setAvanceDate(e.target.value)}
                    onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>FOURNISSEUR</span>
                  <select
                    className="select-category-catalog"
                    value={avanceFournisseur}
                    onChange={(e) => setAvanceFournisseur(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Choisir Fournisseur...</option>
                    {fournisseurs.map(f => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>MONTANT DE L'AVANCE (DH)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="ex: 15000"
                    className="form-input"
                    value={avanceAmount}
                    onChange={(e) => setAvanceAmount(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: '700', color: 'var(--text-primary)' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>MODE DE PAIEMENT</span>
                  <select
                    className="select-category-catalog"
                    value={avanceMethod}
                    onChange={(e) => setAvanceMethod(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Effet">Effet</option>
                    <option value="Espèce">Espèce</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-blue-action" style={{ height: '46px', borderRadius: '12px', fontWeight: '700' }}>
                  ENREGISTRER L'AVANCE
                </button>
              </div>
            </form>
          </div>
          )}

          {/* Card: Historique des Avances */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px' }}>
                <History size={16} />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Historique des Avances versées</h3>
            </div>

            {filteredTxs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Aucune avance enregistrée.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('reference')}>RÉFÉRENCE AVANCE{getSortIndicator('reference')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('date')}>DATE{getSortIndicator('date')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>FOURNISSEUR{getSortIndicator('partner_name')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>MONTANT PAYÉ{getSortIndicator('amount')}</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px' }}>MODE</th>
                      <th style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTxs.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '20px 16px', fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {tx.description}
                        </td>
                        <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                          {tx.date}
                        </td>
                        <td style={{ padding: '20px 16px' }}>
                          <span style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>
                            {tx.partner_name || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '20px 16px', fontWeight: '800', color: 'var(--danger)', fontSize: '15px' }}>
                          -{formatCurrency(tx.amount)}
                        </td>
                        <td style={{ padding: '20px 16px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                          {tx.payment_method}
                        </td>
                        <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '14px', color: '#cbd5e1' }}>
                            {!isReadOnly && (
                              <button className="action-icon-btn delete" style={{ color: 'var(--danger)' }} onClick={(e) => handleDeleteClick(tx.id, e)} title="Annuler l'avance">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RENDER FOR VENTES & LIVRAISONS VIEW MATCHING SCREENSHOT */}
      {activeSubTab === 'ventes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Card: Nouvelle Vente */}
          {!isReadOnly && (
            <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '24px' }}>Nouvelle Vente</h3>
            
            <form onSubmit={handleAddItemToVente}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Client */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>CLIENT</span>
                  <select
                    className="select-category-catalog"
                    value={venteClient}
                    onChange={(e) => setVenteClient(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                    required
                  >
                    <option value="">Sélectionner Client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date Document */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>DATE DOCUMENT</span>
                  <input
                    type="date"
                    className="form-input"
                    value={venteDate}
                    onChange={(e) => setVenteDate(e.target.value)}
                    onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                    style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer' }}
                  />
                </div>

                {/* Reglement */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)' }}>RÈGLEMENT</span>
                  <select
                    className="select-category-catalog"
                    value={venteReglement}
                    onChange={(e) => setVenteReglement(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-main)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                    <option value="Virement">Virement</option>
                    <option value="Effet">Effet</option>
                    <option value="Crédit">Crédit</option>
                  </select>
                </div>
              </div>

              {/* Blue Items entry row matching image */}
              <div style={{ backgroundColor: 'var(--bg-main)', borderRadius: '16px', padding: '20px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr auto', gap: '16px', alignItems: 'flex-end', border: '1px solid var(--border-color)' }}>
                {/* Product */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>PRODUIT</span>
                  <select
                    className="select-category-catalog"
                    value={venteProductId}
                    onChange={(e) => setVenteProductId(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="">Choisir...</option>
                    {stockItems.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku}) - Stock: {p.stock} (Neuf) / {p.declassedStock || 0} (Déclassé)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stock Type (Neuf vs Declassé) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>STOCK</span>
                  <select
                    className="select-category-catalog"
                    value={venteStockType}
                    onChange={(e) => setVenteStockType(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', width: '100%', color: 'var(--text-primary)' }}
                  >
                    <option value="Neuf">Neuf</option>
                    <option value="Déclassé">Déclassé</option>
                  </select>
                </div>

                {/* Quantity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>QTÉ</span>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={venteQty}
                    onChange={(e) => setVenteQty(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}
                  />
                </div>

                {/* Sale Price TTC */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="form-label" style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>PRIX VENTE TTC</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant"
                    className="form-input"
                    value={ventePriceTTC}
                    onChange={(e) => setVentePriceTTC(e.target.value)}
                    style={{ backgroundColor: 'var(--bg-card)', height: '46px', border: '1px solid var(--border-color)', borderRadius: '12px', fontWeight: '700', color: 'var(--text-primary)' }}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-blue-action" 
                  style={{ height: '46px', padding: '0 32px', borderRadius: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  AJOUTER
                </button>
              </div>
            </form>

            {/* List of currently added items in this sale */}
            {venteItems.length > 0 && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Composants de la vente en cours :</h4>
                <div className="table-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: '700' }}>
                        <th style={{ padding: '10px 8px' }}>SKU</th>
                        <th style={{ padding: '10px 8px' }}>DÉSIGNATION</th>
                        <th style={{ padding: '10px 8px' }}>TYPE STOCK</th>
                        <th style={{ padding: '10px 8px' }}>QUANTITÉ</th>
                        <th style={{ padding: '10px 8px' }}>P.U. TTC</th>
                        <th style={{ padding: '10px 8px', textAlign: 'right' }}>TOTAL TTC</th>
                        <th style={{ padding: '10px 8px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {venteItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: '600' }}>{item.sku}</td>
                          <td style={{ padding: '12px 8px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.productName}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{ 
                              fontSize: '10px', 
                              fontWeight: '700', 
                              padding: '2px 8px', 
                              borderRadius: '4px',
                              backgroundColor: item.stockType === 'Déclassé' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: item.stockType === 'Déclassé' ? '#f87171' : 'var(--text-secondary)'
                            }}>{item.stockType.toUpperCase()}</span>
                          </td>
                          <td style={{ padding: '12px 8px', fontWeight: '600' }}>{item.quantity}</td>
                          <td style={{ padding: '12px 8px' }}>{formatCurrency(item.priceTTC)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(item.quantity * item.priceTTC)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button 
                              type="button" 
                              className="action-icon-btn delete" 
                              onClick={() => setVenteItems(venteItems.filter((_, i) => i !== idx))}
                              style={{ color: 'var(--danger)' }}
                              title="Supprimer la ligne"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', backgroundColor: 'var(--bg-main)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
                    TOTAL DU BON DE LIVRAISON : <span style={{ color: 'var(--primary)', fontSize: '20px', marginLeft: '8px' }}>{formatCurrency(venteItems.reduce((acc, item) => acc + (item.quantity * item.priceTTC), 0))}</span>
                  </div>
                  <button type="button" className="btn btn-blue-action" onClick={handleSaveVente} style={{ padding: '12px 28px', borderRadius: '12px' }}>
                    VALIDER LA VENTE (BL)
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Card: Historique des Ventes */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-secondary)', padding: '6px', borderRadius: '8px' }}>
                  <History size={16} />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-secondary)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Historique des Ventes</h3>
              </div>

              {/* Date Filters matching image */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#94a3b8' }}>DU</span>
                  <input
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                    style={{ height: '36px', fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#94a3b8' }}>AU</span>
                  <input
                    type="date"
                    className="form-input"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => { if (typeof e.currentTarget.showPicker === 'function') e.currentTarget.showPicker(); }}
                    style={{ height: '36px', fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  />
                </div>
                <button 
                  onClick={handleResetFilters}
                  className="btn btn-white"
                  style={{ height: '36px', padding: '0 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', marginTop: '12px' }}
                >
                  <RotateCcw size={12} /> RÉINITIALISER
                </button>
              </div>
            </div>

            {filteredTxs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                Aucune vente enregistrée dans cette période.
              </div>
            ) : (
              <>
                {selectedVenteIds.length > 0 && (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: '12px', 
                    padding: '12px 20px', 
                    marginBottom: '16px',
                    color: 'var(--text-primary)'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>
                      {selectedVenteIds.length} vente(s) sélectionnée(s)
                    </span>
                    <button 
                      onClick={handleDeleteSelectedVentes}
                      className="btn"
                      style={{ 
                        backgroundColor: '#ef4444', 
                        color: '#ffffff', 
                        border: 'none', 
                        padding: '8px 16px', 
                        borderRadius: '8px', 
                        fontSize: '12px', 
                        fontWeight: '800', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Trash2 size={14} /> SUPPRIMER LA SÉLECTION
                    </button>
                  </div>
                )}
                <div className="table-container">
                  <table className="custom-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', borderBottom: '1px solid var(--border-color)' }}></th>
                        {!isReadOnly && (
                          <th style={{ width: '40px', borderBottom: '1px solid var(--border-color)', padding: '16px' }}>
                            <input 
                              type="checkbox" 
                              checked={filteredTxs.length > 0 && selectedVenteIds.length === filteredTxs.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVenteIds(filteredTxs.map(t => t.id));
                                } else {
                                  setSelectedVenteIds([]);
                                }
                              }}
                              style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                            />
                          </th>
                        )}
                        <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('reference')}>N° BL{getSortIndicator('reference')}</th>
                        <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('date')}>DATE{getSortIndicator('date')}</th>
                        <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('partner_name')}>CLIENT{getSortIndicator('partner_name')}</th>
                        <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', cursor: 'pointer', userSelect: 'none' }} onClick={() => requestSort('amount')}>TOTAL TTC{getSortIndicator('amount')}</th>
                        <th style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', padding: '16px', textAlign: 'right' }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTxs.map((tx) => {
                        const itemsList = parseItems(tx.items);
                        const isExpanded = expandedRows[tx.id];
    
                        return (
                          <React.Fragment key={tx.id}>
                            <tr style={{ cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }} onClick={() => toggleRow(tx.id)}>
                              <td onClick={(e) => { e.stopPropagation(); toggleRow(tx.id); }}>
                                {itemsList.length > 0 ? (
                                  isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)' }} />
                                ) : null}
                              </td>
                              {!isReadOnly && (
                                <td style={{ padding: '20px 16px', width: '40px' }} onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedVenteIds.includes(tx.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedVenteIds(prev => [...prev, tx.id]);
                                      } else {
                                        setSelectedVenteIds(prev => prev.filter(id => id !== tx.id));
                                      }
                                    }}
                                    style={{ cursor: 'pointer', transform: 'scale(1.1)' }}
                                  />
                                </td>
                              )}
                              <td style={{ padding: '20px 16px', fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                                {getBLReference(tx.description)}
                              </td>
                              <td style={{ padding: '20px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>
                                {tx.date}
                              </td>
                              <td style={{ padding: '20px 16px' }}>
                                <span style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>
                                  {tx.partner_name || 'N/A'}
                                </span>
                              </td>
                              <td style={{ padding: '20px 16px', fontWeight: '800', color: 'var(--text-primary)', fontSize: '15px' }}>
                                {formatCurrency(tx.amount)}
                              </td>
                              <td style={{ padding: '20px 16px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: '14px', alignItems: 'center', color: '#cbd5e1' }}>
                                  {tx.type === 'bl' ? (
                                    !isReadOnly && (
                                      <button 
                                        style={{
                                          padding: '4px 10px', 
                                          fontSize: '11px', 
                                          borderRadius: '6px', 
                                          backgroundColor: 'rgba(16, 185, 129, 0.15)', 
                                          color: '#34d399', 
                                          border: '1px solid rgba(16, 185, 129, 0.3)', 
                                          cursor: 'pointer', 
                                          fontWeight: '700'
                                        }} 
                                        onClick={(e) => handleConvertToInvoice(tx, e)}
                                        title="Facturer le Bon de Livraison"
                                      >
                                        Facturer
                                      </button>
                                    )
                                  ) : (
                                    <span style={{ 
                                      fontSize: '10px', 
                                      fontWeight: '800', 
                                      color: '#60a5fa', 
                                      padding: '4px 10px', 
                                      backgroundColor: 'rgba(59, 130, 246, 0.15)', 
                                      borderRadius: '6px', 
                                      border: '1px solid rgba(59, 130, 246, 0.3)',
                                      display: 'inline-block'
                                    }}>
                                      FACTURÉ
                                    </span>
                                  )}
                                  <button className="action-icon-btn" style={{ color: '#2563eb' }} onClick={(e) => { e.stopPropagation(); toggleRow(tx.id); }} title="Voir details">
                                    <Eye size={18} />
                                  </button>
                                  {!isReadOnly && (
                                    <button 
                                      className="action-icon-btn" 
                                      style={{ color: '#10b981' }} 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        handleOpenCommissionModal(tx); 
                                      }} 
                                      title="Ajouter Commission"
                                    >
                                      <Percent size={16} />
                                    </button>
                                  )}
                                  {!isReadOnly && (
                                    <button className="action-icon-btn" style={{ color: '#f59e0b' }} onClick={(e) => { e.stopPropagation(); alert("Edition du BL " + getBLReference(tx.description)); }} title="Modifier">
                                      <Pencil size={16} />
                                    </button>
                                  )}
                                  {!isReadOnly && (
                                    <button 
                                      className="action-icon-btn delete" 
                                      style={{ color: '#ef4444' }} 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTransaction(tx.id, e);
                                      }} 
                                      title="Supprimer la vente"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                  <button className="action-icon-btn" style={{ color: '#3b82f6' }} onClick={(e) => {
                                     e.stopPropagation();
                                     const client = clients.find(c => c.name === tx.partner_name);
                                     printDocument({
                                       type: 'BON DE LIVRAISON',
                                       reference: getBLReference(tx.description),
                                       date: tx.date,
                                       clientName: tx.partner_name || 'Client Inconnu',
                                       clientICE: client?.ice || '',
                                       clientIF: client?.if_id || '',
                                       items: parseItems(tx.items)
                                     });
                                   }} title="BL PDF">
                                    <FileText size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
        
                            {/* Expanded items row */}
                            {isExpanded && itemsList.length > 0 && (
                              <tr>
                                <td colSpan={isReadOnly ? 6 : 7} style={{ padding: '0 16px 20px 56px', backgroundColor: 'transparent' }}>
                                  <div style={{ padding: '16px', borderLeft: '3px solid var(--primary)', background: 'var(--bg-main)', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-color)', borderLeftWidth: '3px', marginTop: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                                    <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Détail des Articles vendus :</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                      <thead>
                                        <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontWeight: '700' }}>
                                          <th style={{ padding: '8px 0' }}>SKU</th>
                                          <th>DÉSIGNATION</th>
                                          <th>STOCK TYPE</th>
                                          <th>QUANTITÉ</th>
                                          <th>P.U. HT</th>
                                          <th style={{ textAlign: 'right' }}>TOTAL HT</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {itemsList.map((item, idx) => {
                                          const qty = item.quantity || 0;
                                          const price = item.unitPriceHT || 0;
                                          const total = qty * price;
                                          return (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                              <td style={{ padding: '10px 0', fontFamily: 'monospace', fontWeight: '600' }}>{item.sku}</td>
                                              <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{item.productName}</td>
                                              <td>
                                                <span style={{ 
                                                  fontSize: '9px', 
                                                  fontWeight: '700', 
                                                  padding: '1px 6px', 
                                                  borderRadius: '3px',
                                                  backgroundColor: item.stockType === 'Déclassé' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                                  color: item.stockType === 'Déclassé' ? '#f87171' : 'var(--text-secondary)'
                                                }}>{(item.stockType || 'Neuf').toUpperCase()}</span>
                                              </td>
                                              <td style={{ fontWeight: '600' }}>{qty}</td>
                                              <td>{formatCurrency(price)}</td>
                                              <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>{formatCurrency(total)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Commission Modal */}
      {showCommissionModal && selectedVenteForCommission && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ color: 'var(--text-primary)', maxWidth: '650px', width: '90%' }}>
            <button className="modal-close" onClick={() => { setShowCommissionModal(false); setSelectedVenteForCommission(null); }}>
              <X size={20} />
            </button>
            <h3 className="top-bar-title" style={{ marginBottom: '20px' }}>
              Ajouter une Commission - {getBLReference(selectedVenteForCommission.description)}
            </h3>

            <form onSubmit={handleSaveCommission}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Responsable de la vente</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nom du responsable..."
                    value={commissionResponsable}
                    onChange={(e) => setCommissionResponsable(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={commissionDate}
                    onChange={(e) => setCommissionDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="form-group">
                  <label className="form-label">Mode de règlement</label>
                  <select
                    className="form-input"
                    value={commissionMethod}
                    onChange={(e) => setCommissionMethod(e.target.value)}
                  >
                    <option value="Virement">Virement</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Chèque">Chèque</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Statut</label>
                  <select
                    className="form-input"
                    value={commissionStatus}
                    onChange={(e) => setCommissionStatus(e.target.value)}
                  >
                    <option value="en_attente">À régler (En attente)</option>
                    <option value="confirmé">Réglé d'office (Confirmé)</option>
                  </select>
                </div>
              </div>

              <h4 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Détail des Commissions par Produit
              </h4>

              <div className="table-container" style={{ maxHeight: '250px', marginBottom: '20px' }}>
                <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px', textAlign: 'left', color: 'var(--text-secondary)' }}>PRODUIT</th>
                      <th style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)' }}>QTE VENDUE</th>
                      <th style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)', width: '130px' }}>COMM. UNITAIRE (DH)</th>
                      <th style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissionItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 10px', fontWeight: '600' }}>
                          {item.productName}
                          {item.sku && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>SKU: {item.sku}</div>}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: '700' }}>
                          {item.quantity}
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '13px', textAlign: 'center', borderRadius: '6px', height: '32px' }}
                            value={item.commissionPerUnit === 0 ? '' : item.commissionPerUnit}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...commissionItems];
                              updated[idx].commissionPerUnit = val;
                              setCommissionItems(updated);
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {formatCurrency(item.commissionPerUnit * item.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Total Commission à Enregistrer
                </span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--success)' }}>
                  {formatCurrency(commissionItems.reduce((sum, item) => sum + (item.commissionPerUnit * item.quantity), 0))}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-white"
                  onClick={() => { setShowCommissionModal(false); setSelectedVenteForCommission(null); }}
                >
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Enregistrer la Commission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
