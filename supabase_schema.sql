-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- 1. PARTNERS (Clients and Suppliers)
create table if not exists public.partners (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    type text not null check (type in ('client', 'fournisseur')),
    email text,
    phone text,
    address text,
    company_name text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. GENERAL INVENTORY / STOCK
create table if not exists public.stock (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    sku text unique not null,
    category text not null,
    quantity integer default 0 not null,
    unit text default 'pcs' not null,
    min_quantity integer default 5 not null,
    unit_price decimal(12, 2) default 0.00 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. SPARE PARTS (Pièces Rechange)
create table if not exists public.spare_parts (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    part_number text unique not null,
    category text not null,
    quantity integer default 0 not null,
    min_quantity integer default 2 not null,
    unit_price decimal(12, 2) default 0.00 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. TRANSACTIONS (Trésor, Finance, Entrées, Ventes)
create table if not exists public.transactions (
    id uuid default uuid_generate_v4() primary key,
    type text not null check (type in ('vente', 'achat', 'charge', 'revenu')),
    amount decimal(12, 2) not null,
    description text,
    partner_id uuid references public.partners(id) on delete set null,
    date date default current_date not null,
    payment_method text default 'Virement' check (payment_method in ('Virement', 'Espèces', 'Carte', 'Chèque')),
    status text default 'confirmé' check (status in ('confirmé', 'en_attente', 'annulé')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. RECOUVREMENTS (Debts and unpaid invoices)
create table if not exists public.debts (
    id uuid default uuid_generate_v4() primary key,
    partner_id uuid references public.partners(id) on delete cascade not null,
    amount decimal(12, 2) not null,
    due_date date not null,
    status text default 'impayé' check (status in ('impayé', 'partiel', 'recouvré')),
    invoice_number text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. SAV TICKETS (After-Sales Service)
create table if not exists public.sav_tickets (
    id uuid default uuid_generate_v4() primary key,
    client_name text not null,
    client_phone text,
    equipment text not null,
    issue text not null,
    status text default 'ouvert' check (status in ('ouvert', 'en_cours', 'résolu')),
    priority text default 'moyenne' check (priority in ('faible', 'moyenne', 'élevée')),
    assigned_technician text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Seed Initial Data
insert into public.partners (name, type, email, phone, address, company_name) values
('Jean Dupont', 'client', 'jean.dupont@email.com', '+33 6 1234 5678', 'Paris, France', 'Dupont Bâtiment'),
('Marie Leroux', 'client', 'marie.leroux@email.com', '+33 6 8765 4321', 'Lyon, France', 'Leroux SARL'),
('Industries Métal-Pro', 'fournisseur', 'sales@metalpro.com', '+33 1 4567 8900', 'Lille, France', 'MetalPro S.A.'),
('ElectroComposants', 'fournisseur', 'contact@electrocomp.com', '+33 2 9876 5432', 'Nantes, France', 'ElectroComposants Ltd')
on conflict do nothing;

-- Query partner IDs to link transactions and debts accurately
do $$
declare
    client1_id uuid;
    client2_id uuid;
    fourn1_id uuid;
    fourn2_id uuid;
begin
    select id into client1_id from public.partners where name = 'Jean Dupont' limit 1;
    select id into client2_id from public.partners where name = 'Marie Leroux' limit 1;
    select id into fourn1_id from public.partners where name = 'Industries Métal-Pro' limit 1;
    select id into fourn2_id from public.partners where name = 'ElectroComposants' limit 1;

    -- Seed Stock
    insert into public.stock (name, sku, category, quantity, unit, min_quantity, unit_price) values
    ('Câble Électrique R2V 3G1.5', 'CAB-R2V-3G15', 'Électricité', 150, 'mètres', 50, 1.25),
    ('Tuyau Cuivre Ø14', 'TUY-CU-14', 'Plomberie', 45, 'mètres', 15, 4.80),
    ('Prise de courant double Legrand', 'PRI-LEG-DBL', 'Électricité', 8, 'pcs', 10, 14.50), -- low stock
    ('Disjoncteur 16A Schneider', 'DIS-SCH-16A', 'Électricité', 20, 'pcs', 5, 8.90)
    on conflict (sku) do nothing;

    -- Seed Spare Parts (Pièces Rechange)
    insert into public.spare_parts (name, part_number, category, quantity, min_quantity, unit_price) values
    ('Filtre à Huile F-104', 'FLT-H-104', 'Moteur', 12, 4, 15.00),
    ('Joint Torique 24mm', 'JNT-TOR-24', 'Plomberie', 200, 50, 0.15),
    ('Résistance Chauffante 2000W', 'RES-CH-2000W', 'Chauffage', 1, 2, 45.00), -- low stock
    ('Courroie de transmission C-45', 'CRT-C-45', 'Moteur', 3, 2, 22.50)
    on conflict (part_number) do nothing;

    -- Seed Transactions
    insert into public.transactions (type, amount, description, partner_id, date, payment_method, status) values
    ('vente', 1250.00, 'Facture F-2026-001 - Travaux électricité', client1_id, current_date - 5, 'Virement', 'confirmé'),
    ('vente', 850.00, 'Facture F-2026-002 - Dépannage plomberie', client2_id, current_date - 2, 'Carte', 'confirmé'),
    ('achat', 600.00, 'Achat de bobines de câble cuivre', fourn1_id, current_date - 10, 'Virement', 'confirmé'),
    ('charge', 150.00, 'Abonnement Télécom & Internet', null, current_date - 7, 'Espèces', 'confirmé'),
    ('revenu', 2500.00, 'Apport en capital / Remboursement TVA', null, current_date - 1, 'Virement', 'confirmé')
    on conflict do nothing;

    -- Seed Debts (Recouvrement)
    insert into public.debts (partner_id, amount, due_date, status, invoice_number) values
    (client1_id, 450.00, current_date + 10, 'impayé', 'FAC-2026-003'),
    (client2_id, 1200.00, current_date - 3, 'impayé', 'FAC-2026-004')
    on conflict do nothing;

    -- Seed SAV Tickets
    insert into public.sav_tickets (client_name, client_phone, equipment, issue, status, priority, assigned_technician) values
    ('Pierre Durant', '+33 6 5555 4444', 'Chaudière Gaz Frisquet', 'Bruit suspect et baisse de pression', 'en_cours', 'élevée', 'Thomas Martin'),
    ('Alice Blanc', '+33 6 4444 3333', 'Climatisation Daikin', 'Ne refroidit plus', 'ouvert', 'moyenne', null),
    ('Robert Martin', '+33 6 3333 2222', 'Tableau Électrique', 'Court-circuit sur le circuit cuisine', 'résolu', 'élevée', 'Thomas Martin')
    on conflict do nothing;
end $$;
