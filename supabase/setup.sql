-- Luma Cakes · bulut eşitleme kurulumu
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştırın (tekrar çalıştırmak zararsızdır).
-- Yalnızca sade komutlar kullanılır (SQL Editor'ün okuyamadığı fonksiyon / DO blokları yok).
-- Değişiklik zamanı uygulama tarafından sunucu saatiyle ('now') yazılır; diğer cihazlara
-- anlık bildirim Realtime Broadcast ile yapılır (ek ayar gerekmez).

-- Uygulamadaki her kayıt (müşteri, sipariş, ödeme, stok…) burada bir satır olarak tutulur.
create table if not exists public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, tbl, id)
);
create index if not exists records_sync_idx on public.records (user_id, updated_at);

-- Herkes yalnızca kendi kayıtlarını görebilir ve değiştirebilir
alter table public.records enable row level security;
drop policy if exists "Kendi kayitlari" on public.records;
create policy "Kendi kayitlari" on public.records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.records to authenticated;

-- Fotoğraflar: herkesin yalnızca kendi klasörü
insert into storage.buckets (id, name, public) values ('images', 'images', false) on conflict (id) do nothing;
drop policy if exists "Kendi fotograflari" on storage.objects;
create policy "Kendi fotograflari" on storage.objects for all to authenticated using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text) with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
