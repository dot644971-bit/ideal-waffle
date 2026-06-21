import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

function generateId(prefix = '') {
  return prefix + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const COLORS = ['#e50914','#0070f3','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || username.length < 3)
      return NextResponse.json({ success: false, message: 'Kullanıcı adı en az 3 karakter olmalı.' }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ success: false, message: 'Geçerli bir e-posta adresi girin.' }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ success: false, message: 'Şifre en az 6 karakter olmalı.' }, { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);

    const existing = await sql`SELECT id FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
    if (existing.length > 0)
      return NextResponse.json({ success: false, message: 'Bu e-posta zaten kayıtlı.' }, { status: 409 });

    const takenUsername = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${username}) LIMIT 1`;
    if (takenUsername.length > 0)
      return NextResponse.json({ success: false, message: 'Bu kullanıcı adı zaten alınmış.' }, { status: 409 });

    const hash      = await bcrypt.hash(password, 10);
    const userId    = generateId('u_');
    const profileId = generateId('p_');
    const color     = randomColor();
    const now       = new Date().toISOString();

    await sql`
      INSERT INTO users (id, username, email, password, plan, avatar, active_profile, created_at)
      VALUES (${userId}, ${username}, ${email}, ${hash}, 'free', '', ${profileId}, ${now})
    `;

    await sql`
      INSERT INTO profiles (id, user_id, name, avatar, color, pin)
      VALUES (${profileId}, ${userId}, ${username}, 'default', ${color}, '')
    `;

    return NextResponse.json({
      success: true,
      user: {
        id:             userId,
        username,
        email,
        plan:           'free',
        avatar:         '',
        active_profile: profileId,
      },
    });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
