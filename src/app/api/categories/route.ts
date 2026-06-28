import { NextRequest, NextResponse } from "next/server";
import { getDriveClient } from "@/lib/session";
import { readFile, writeFile } from "@/lib/drive";
import type { CategoriesFile, Category } from "@/lib/schema";
import { validateCategoriesFile, defaultCategories } from "@/lib/schema";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const raw = await readFile<any>(drive, "categories.json");
    if (!raw) {
      // First run: seed default categories
      const cats: CategoriesFile = {
        schema_version: 1,
        updated_at: new Date().toISOString(),
        categories: defaultCategories(),
      };
      await writeFile(drive, "categories.json", cats);
      return NextResponse.json(cats);
    }
    const data = validateCategoriesFile(raw);
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const drive = await getDriveClient(req);
    const body = await req.json();

    const raw = await readFile<any>(drive, "categories.json");
    const data: CategoriesFile = raw
      ? validateCategoriesFile(raw)
      : {
          schema_version: 1,
          updated_at: new Date().toISOString(),
          categories: defaultCategories(),
        };

    const newCategory: Category = {
      id: uuidv4(),
      name: body.name,
      parent_id: body.parent_id || null,
      type: body.type || "expense",
      color: body.color || "#607D8B",
      icon: body.icon || "tag",
      archived: false,
      created_at: new Date().toISOString(),
      metadata: body.metadata || {},
    };

    data.categories.push(newCategory);
    data.updated_at = new Date().toISOString();
    await writeFile(drive, "categories.json", data);

    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: any) {
    if (error.message === "Not authenticated") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
