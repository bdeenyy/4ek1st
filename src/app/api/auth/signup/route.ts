import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Необходимо заполнить все поля" },
        { status: 400 }
      );
    }

    // Проверяем, не занят ли email
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    // Хешируем пароль
    const hashedPassword = await hash(password, 12);

    // Создаем пользователя
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN", // Первого зарегистрированного сделаем админом, либо можно по умолчанию MANAGER
      },
    });

    return NextResponse.json(
      { message: "Аккаунт успешно создан", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("SIGNUP_ERROR", error);
    return NextResponse.json(
      { error: "Произошла ошибка при регистрации" },
      { status: 500 }
    );
  }
}
