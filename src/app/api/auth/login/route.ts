import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'E-posta ve şifre zorunludur.' },
        { status: 400 }
      );
    }

    const sql = neon(process.env.DATABASE_URL!);

    const rows = await sql`
      SELECT id, username, email, password, plan, avatar, active_profile
      FROM users
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      );
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password as string);

    if (!valid) {
      return NextResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id:             user.id,
        username:       user.username,
        email:          user.email,
        plan:           user.plan           ?? 'free',
        avatar:         user.avatar         ?? '',
        active_profile: user.active_profile ?? '',
      },
    });
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json(
      { success: false, message: 'Sunucu hatası. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
