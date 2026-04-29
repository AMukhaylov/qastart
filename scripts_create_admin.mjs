import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, serviceKey);

const email = 'admin@qastart.app';
// генерим надёжный пароль
const pw = 'QAstart-Admin-' + Math.random().toString(36).slice(2, 8) + '!7';

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password: pw,
  email_confirm: true,
  user_metadata: { full_name: 'Администратор школы' },
});

if (error) {
  console.error('ERR:', error.message);
  process.exit(1);
}

const userId = data.user.id;

// убираем дефолтную роль student и ставим admin
await supabase.from('user_roles').delete().eq('user_id', userId);
const { error: rErr } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
if (rErr) { console.error('ROLE ERR:', rErr.message); process.exit(1); }

console.log('OK');
console.log('USER_ID:', userId);
console.log('EMAIL:', email);
console.log('PASSWORD:', pw);
