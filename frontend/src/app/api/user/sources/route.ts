import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const user_id = url.searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id parameter" },
        { status: 400 }
      );
    }

    // Get user's selected sources using Prisma
    const userPreferences = await prisma.userPreferences.findUnique({
      where: { user_id },
      select: { selected_sources: true }
    });

    return NextResponse.json({
      selected_sources: userPreferences?.selected_sources || [],
    });
  } catch (error) {
    console.error("Error in sources GET API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { user_id, selected_sources } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    if (!Array.isArray(selected_sources)) {
      return NextResponse.json(
        { error: "selected_sources must be an array" },
        { status: 400 }
      );
    }

    // Upsert user sources preferences using Prisma
    await prisma.userPreferences.upsert({
      where: { user_id },
      update: {
        selected_sources,
        updated_at: new Date(),
      },
      create: {
        user_id,
        selected_sources,
        updated_at: new Date(),
      },
    });

    return NextResponse.json({ 
      message: "Sources preferences saved successfully",
      selected_sources 
    });
  } catch (error) {
    console.error("Error in sources POST API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}