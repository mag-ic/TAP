
const initialPartners = [];
const initialStock = [];

const initialSavTickets = [];
const initialCheques = [];
const initialTransactions = [];


const loadLocal = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return defaultVal;
};

const saveLocal = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {}
};

const createPersistentArray = (key, initialVal) => {
  const target = loadLocal(key, initialVal);
  const handler = {
    get(target, prop, receiver) {
      const current = loadLocal(key, target);
      const value = Reflect.get(current, prop, receiver);
      if (typeof value === 'function') {
        return function(...args) {
          const res = value.apply(current, args);
          saveLocal(key, current);
          return res;
        };
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const current = loadLocal(key, target);
      const res = Reflect.set(current, prop, value, receiver);
      saveLocal(key, current);
      return res;
    }
  };
  return new Proxy(target, handler);
};

export const mockPartners = createPersistentArray('tap_partners', initialPartners);
export const mockStock = createPersistentArray('tap_stock', initialStock);
export const mockSavTickets = createPersistentArray('tap_sav_tickets', initialSavTickets);
export const mockCheques = createPersistentArray('tap_cheques', initialCheques);
export const mockTransactions = createPersistentArray('tap_transactions', initialTransactions);

export const resetLocalDatabase = () => {
  localStorage.removeItem('tap_partners');
  localStorage.removeItem('tap_stock');
  localStorage.removeItem('tap_sav_tickets');
  localStorage.removeItem('tap_cheques');
  localStorage.removeItem('tap_transactions');
  window.location.reload();
};
