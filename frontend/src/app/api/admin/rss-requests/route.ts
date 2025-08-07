import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // Check if user is authenticated (basic check, you might want to add admin role check)
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch all RSS requests, ordered by creation date (newest first)
    const requests = await prisma.rss_requests.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    return NextResponse.json(requests);

  } catch (error) {
    console.error("Error fetching RSS requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch RSS requests" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}