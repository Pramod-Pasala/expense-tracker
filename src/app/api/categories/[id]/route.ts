import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { CategoriesFile } from "@/lib/schema";
import { validateCategoriesFile } from "@/lib/schema";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drive = await getDriveClient(req);
    const body = await req.json();

    const raw = await readFile<any>(drive, "categories.json");
    if (!raw) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    const data: CategoriesFile = validateCategoriesFile(raw);

    const idx = data.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    data.categories[idx] = {
      ...data.categories[idx],
      ...body,
    };
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "categories.json", data);

    return NextResponse.json(data.categories[idx]);
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const drive = await getDriveClient(req);
    const raw = await readFile<any>(drive, "categories.json");
    if (!raw) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    const data: CategoriesFile = validateCategoriesFile(raw);

    const idx = data.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Archive instead of hard delete
    data.categories[idx].archived = true;
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "categories.json", data);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
