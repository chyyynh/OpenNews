import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Debug: Check what's available
console.log("Prisma models available:", {
  rss_requests: typeof prisma.rss_requests,
  rssRequests: typeof (prisma as any).rssRequests,
  rSSRequest: typeof (prisma as any).rSSRequest,
  available: Object.getOwnPropertyNames(prisma).filter(name => !name.startsWith('_') && !name.startsWith('$'))
});

interface RequestRSSData {
  url: string;
  sourceName: string;
  category: string;
  description: string;
  requestedBy: string;
}

export async function POST(request: Request) {
  try {
    const body: RequestRSSData = await request.json();
    const { url, sourceName, category, description, requestedBy } = body;

    // Basic validation
    if (!url || !sourceName || !requestedBy) {
      return NextResponse.json(
        { message: "缺少必填欄位" },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { message: "無效的 RSS URL" },
        { status: 400 }
      );
    }

    // Check for duplicate URLs  
    const existingRequest = await prisma.rss_requests.findFirst({
      where: {
        url: url.trim(),
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { message: "此 RSS URL 已經被申請過了" },
        { status: 400 }
      );
    }

    // Save to database
    const rssRequest = await prisma.rss_requests.create({
      data: {
        url: url.trim(),
        source_name: sourceName.trim(),
        category: category?.trim() || null,
        description: description?.trim() || null,
        requested_by: requestedBy.trim(),
        status: "pending"
      },
    });

    console.log("RSS Request saved to database:", {
      id: rssRequest.id,
      url: rssRequest.url,
      source_name: rssRequest.source_name,
      requested_by: rssRequest.requested_by,
      created_at: rssRequest.created_at,
    });

    return NextResponse.json({
      message: "RSS 請求已成功提交！我們會盡快審核並添加。",
      status: "pending_review",
      requestId: rssRequest.id
    });

  } catch (error) {
    console.error("RSS request error:", error);
    return NextResponse.json(
      { message: "伺服器錯誤，請稍後重試" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}