import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth";

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { status, adminNotes } = await request.json();
    const { id } = await params;

    // Validate status
    if (!["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Update the RSS request
    const updatedRequest = await prisma.rss_requests.update({
      where: { id },
      data: {
        status,
        admin_notes: adminNotes || null,
        updated_at: new Date(),
      },
    });

    console.log(`RSS request ${id} updated to status: ${status}`);

    // If approved, you might want to add logic here to:
    // 1. Add the RSS source to your scraping system
    // 2. Send notification to the requester
    // 3. Update the RssList table

    if (status === "approved") {
      // Example: Add to RssList (you might want to modify this based on your needs)
      try {
        await prisma.rssList.create({
          data: {
            name: updatedRequest.source_name,
            url: updatedRequest.url,
            RSSLink: updatedRequest.url,
            type: "rss",
          },
        });
        console.log(`RSS source ${updatedRequest.source_name} added to RssList`);
      } catch (error) {
        console.error("Error adding to RssList:", error);
        // Continue even if this fails
      }
    }

    return NextResponse.json(updatedRequest);

  } catch (error) {
    console.error("Error updating RSS request:", error);
    return NextResponse.json(
      { error: "Failed to update RSS request" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}