"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, CategoryType } from "@/lib/types";
import { cn, getErrorMessage, checkAuthExpired} from "@/lib/format";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";

/* -------------------------------------------------------------------------- */
/*  Types & constants                                                         */
/* -------------------------------------------------------------------------- */

interface CategoriesResponse {
  categories: Category[];
}

const CATEGORY_TYPES: { value: CategoryType; label: string; icon: string }[] = [
  { value: "expense", label: "Expense", icon: "📉" },
  { value: "income", label: "Income", icon: "📈" },
  { value: "both", label: "Both", icon: "🔁" },
];

const PRESET_COLORS = [
  "#EF4444",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#10B981",
  "#22C55E",
  "#6B7280",
];

const CATEGORY_EMOJIS = [
  { emoji: "🏷️", name: "tag label" },
  { emoji: "📦", name: "box package shipping" },
  { emoji: "🍔", name: "burger food fast food" },
  { emoji: "☕", name: "coffee drink cafe" },
  { emoji: "🛒", name: "cart shopping groceries" },
  { emoji: "🏠", name: "house home rent mortgage" },
  { emoji: "🚗", name: "car auto vehicle transport" },
  { emoji: "⛽", name: "fuel gas petrol" },
  { emoji: "💡", name: "light electricity idea bulb" },
  { emoji: "📱", name: "phone mobile cell" },
  { emoji: "💊", name: "pill medicine health pharmacy" },
  { emoji: "🎓", name: "graduation education school university" },
  { emoji: "✈️", name: "plane flight travel air" },
  { emoji: "🏨", name: "hotel accommodation stay" },
  { emoji: "🎬", name: "movie cinema film entertainment" },
  { emoji: "🎮", name: "game gaming controller play" },
  { emoji: "👕", name: "shirt clothes fashion clothing" },
  { emoji: "💪", name: "gym fitness workout muscle" },
  { emoji: "🎁", name: "gift present birthday" },
  { emoji: "💰", name: "money cash savings" },
  { emoji: "💵", name: "dollar bill cash money" },
  { emoji: "💳", name: "card credit debit" },
  { emoji: "🏦", name: "bank finance" },
  { emoji: "📈", name: "chart graph invest stock" },
  { emoji: "💻", name: "laptop computer tech" },
  { emoji: "🔧", name: "tools repair fix wrench" },
  { emoji: "🐾", name: "pet animal dog cat" },
  { emoji: "🌱", name: "plant nature garden" },
  { emoji: "📚", name: "books library reading study" },
  { emoji: "🎨", name: "art paint creative" },
  { emoji: "🚌", name: "bus transport public" },
  { emoji: "🚆", name: "train rail transport" },
  { emoji: "🍽️", name: "restaurant dining food" },
  { emoji: "🛡️", name: "insurance shield protection" },
  { emoji: "Taxi", name: "taxi cab ride" },
  { emoji: "🧾", name: "receipt bill invoice" },
  { emoji: "🍷", name: "wine drink alcohol bar" },
  { emoji: "🚌", name: "bus transit" },
  { emoji: "🚕", name: "taxi cab" },
  { emoji: "💈", name: "barber haircut salon" },
  { emoji: "🧹", name: "cleaning" },
  { emoji: "🪑", name: "furniture home decor" },
  { emoji: "🔌", name: "electronics cable charger" },
  { emoji: "🛞", name: "tire wheel car repair" },
  { emoji: "🎵", name: "music song audio" },
  { emoji: "📝", name: "notes write journal" },
  { emoji: "🌍", name: "travel world globe" },
  { emoji: "❤️", name: "health love care" },
  { emoji: "🏥", name: "hospital medical doctor" },
  { emoji: "🦷", name: "dentist teeth" },
  { emoji: "👁️", name: "eye optician vision" },
  { emoji: "🧴", name: "toiletries shampoo" },
  { emoji: "🛏️", name: "bed sleep furniture" },
  { emoji: "🍳", name: "cooking kitchen breakfast" },
  { emoji: "🧊", name: "groceries frozen" },
  { emoji: "🚿", name: "utilities water shower" },
  { emoji: "🔋", name: "battery power energy" },
  { emoji: "📧", name: "email communication" },
  { emoji: "🌐", name: "internet web online" },
  { emoji: "🗂️", name: "files documents folder" },
  { emoji: "🎯", name: "goal target budget" },
  { emoji: "🪙", name: "coin money savings" },
  { emoji: "💎", name: "luxury jewelry valuable" },
  { emoji: "🛋️", name: "sofa couch living" },
  { emoji: "🪟", name: "window home" },
  { emoji: "🧑‍💻", name: "freelance work remote" },
  { emoji: "🏦", name: "bank salary" },
  { emoji: "🎁", name: "donation charity gift" },
  { emoji: "💵", name: "refund cashback" },
  { emoji: "📈", name: "dividend interest" },
];

function typeLabel(t: CategoryType) {
  return CATEGORY_TYPES.find((x) => x.value === t)?.label ?? t;
}
function typeIcon(t: CategoryType) {
  return CATEGORY_TYPES.find((x) => x.value === t)?.icon ?? "🏷️";
}

/* -------------------------------------------------------------------------- */
/*  Category form modal                                                       */
/* -------------------------------------------------------------------------- */

interface CategoryFormValues {
  name: string;
  type: CategoryType;
  parent_id: string | null;
  color: string;
  icon: string;
}

const emptyForm: CategoryFormValues = {
  name: "",
  type: "expense",
  parent_id: null,
  color: "#6B7280",
  icon: "🏷️",
};

function CategoryFormModal({
  open,
  onClose,
  onSubmit,
  initial,
  submitting,
  parents,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
  initial: CategoryFormValues | null;
  submitting: boolean;
  /** Non-archived top-level categories eligible to be parents. */
  parents: Category[];
}) {
  const [values, setValues] = useState<CategoryFormValues>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [onlineEmojis, setOnlineEmojis] = useState<{ emoji: string; name: string }[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setValues(initial ?? emptyForm);
      setError(null);
      setOnlineEmojis([]);
    }
  }

  // Filter preset emojis based on the category name being typed
  const filteredEmojis = useMemo(() => {
    const q = values.name.trim().toLowerCase();
    if (!q) return CATEGORY_EMOJIS;
    const words = q.split(/\s+/);
    return CATEGORY_EMOJIS.filter((item) =>
      words.some((w) => item.name.includes(w)),
    );
  }, [values.name]);

  // Search for emojis online using the category name
  const searchOnlineEmojis = async () => {
    const q = values.name.trim();
    if (!q) return;
    setSearchingOnline(true);
    try {
      // Use the free emoji API (no key required)
      const res = await fetch(
        `https://emoji-api.com/emojis?search=${encodeURIComponent(q)}`,
      );
      if (res.ok) {
        const data = await res.json();
        const results = (Array.isArray(data) ? data : []).slice(0, 24).map((item: { character: string; slug: string }) => ({
          emoji: item.character,
          name: item.slug || "",
        }));
        if (results.length > 0) {
          setOnlineEmojis(results);
        } else {
          // Fallback: try GitHub's emoji API (maps short names to emoji images)
          // We search for matching names and return the Unicode representation
          setOnlineEmojis([]);
        }
      } else {
        // API failed — try alternative approach using GitHub's emoji list
        const ghRes = await fetch("https://api.github.com/emojis");
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const entries = Object.entries(ghData as Record<string, string>);
          const matched = entries
            .filter(([name]) => name.toLowerCase().includes(q.toLowerCase()))
            .slice(0, 24)
            .map(([name]) => ({ emoji: name, name }));
          setOnlineEmojis(matched);
        }
      }
    } catch {
      // Non-fatal — online search is optional
    } finally {
      setSearchingOnline(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      setError("Category name is required.");
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit category" : "Add category"}
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Name"
          placeholder="e.g. Groceries"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={!!error && !values.name.trim()}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Icon</label>
            <button
              type="button"
              onClick={searchOnlineEmojis}
              disabled={!values.name.trim() || searchingOnline}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:text-gray-300"
            >
              {searchingOnline ? "Searching…" : "Search online"}
            </button>
          </div>

          {/* Online search results */}
          {onlineEmojis.length > 0 && (
            <>
              <p className="text-xs text-gray-400">From the web:</p>
              <div className="flex flex-wrap items-center gap-2">
                {onlineEmojis.map((item) => (
                  <button
                    key={item.emoji + item.name}
                    type="button"
                    title={item.name}
                    onClick={() => setValues((v) => ({ ...v, icon: item.emoji }))}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg transition-transform hover:scale-110",
                      values.icon === item.emoji
                        ? "border-gray-900 ring-2 ring-offset-2"
                        : "border-transparent bg-gray-50",
                    )}
                    aria-label={`Select icon ${item.name}`}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
              <div className="h-px bg-gray-100 my-1" />
            </>
          )}

          {/* Preset emojis filtered by category name */}
          <p className="text-xs text-gray-400">
            {values.name.trim() ? `Matching "${values.name.trim()}"` : "All icons"}
          </p>
          <div className="flex flex-wrap items-center gap-2 max-h-40 overflow-y-auto">
            {filteredEmojis.map((item) => (
              <button
                key={item.emoji + item.name}
                type="button"
                title={item.name}
                onClick={() => setValues((v) => ({ ...v, icon: item.emoji }))}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg transition-transform hover:scale-110",
                  values.icon === item.emoji
                    ? "border-gray-900 ring-2 ring-offset-2"
                    : "border-transparent bg-gray-50",
                )}
                aria-label={`Select icon ${item.name}`}
              >
                {item.emoji}
              </button>
            ))}
            {filteredEmojis.length === 0 && (
              <span className="text-xs text-gray-400">No matching icons — try searching online</span>
            )}
            <input
              type="text"
              value={values.icon}
              onChange={(e) => setValues((v) => ({ ...v, icon: e.target.value }))}
              className="h-9 w-14 rounded-lg border border-gray-200 px-2 text-center text-lg"
              maxLength={4}
              aria-label="Custom icon"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Type"
            value={values.type}
            onChange={(e) =>
              setValues((v) => ({ ...v, type: e.target.value as CategoryType }))
            }
          >
            {CATEGORY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </Select>
          <Select
            label="Parent category"
            value={values.parent_id ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, parent_id: e.target.value || null }))
            }
          >
            <option value="">None (top-level)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Color</label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValues((v) => ({ ...v, color: c }))}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                  values.color.toLowerCase() === c.toLowerCase()
                    ? "border-gray-900 ring-2 ring-offset-2"
                    : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Select color ${c}`}
              />
            ))}
            <input
              type="color"
              value={values.color}
              onChange={(e) =>
                setValues((v) => ({ ...v, color: e.target.value }))
              }
              className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Custom color"
            />
          </div>
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : initial ? "Save changes" : "Create category"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Icons                                                                     */
/* -------------------------------------------------------------------------- */

function PencilIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <path d="M10 12h4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={cn("h-5 w-5 transition-transform", open && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Category row                                                             */
/* -------------------------------------------------------------------------- */

function CategoryRow({
  category,
  onEdit,
  onArchive,
}: {
  category: Category;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
        style={{ backgroundColor: `${category.color}1A` }}
      >
        {category.icon || "🏷️"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">{category.name}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit category"
          title="Edit"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onArchive}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
          aria-label="Archive category"
          title="Archive"
        >
          <ArchiveIcon />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    // loading/error reset is handled by callers so this function does not
    // synchronously call setState (which would be flagged when called from an
    // effect — react-hooks/set-state-in-effect).
    try {
      const res = await fetch("/api/categories");
      if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load categories (${res.status})`);
      }
      const data: CategoriesResponse = await res.json();
      setCategories(data.categories ?? []);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load on mount. The setState calls all run inside async callbacks
  // (after `await`), so the effect body itself does not call setState.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/categories");
        if (cancelled) return;
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load categories (${res.status})`);
        }
        const data: CategoriesResponse = await res.json();
        if (cancelled) return;
        setCategories(data.categories ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e) || "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

  /** Top-level active categories, grouped by type. */
  const grouped = useMemo(() => {
    const topLevel = active.filter((c) => !c.parent_id);
    const byType: Record<CategoryType, Category[]> = {
      expense: [],
      income: [],
      both: [],
    };
    for (const c of topLevel) byType[c.type].push(c);
    return byType;
  }, [active]);

  /** Map of parent_id -> child categories (active only). */
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of active) {
      if (c.parent_id) {
        const arr = map.get(c.parent_id) ?? [];
        arr.push(c);
        map.set(c.parent_id, arr);
      }
    }
    return map;
  }, [active]);

  /** Candidate parents: active top-level categories (not the one being edited). */
  const candidateParents = useMemo(() => {
    return active.filter((c) => !c.parent_id && c.id !== editing?.id);
  }, [active, editing]);

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setModalOpen(true);
  };

  const handleSubmit = async (values: CategoryFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        type: values.type,
        parent_id: values.parent_id,
        color: values.color,
        icon: values.icon,
      };
      if (editing) {
        const res = await fetch(`/api/categories/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to update category");
        }
        const updated: Category = await res.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create category");
        }
        const created: Category = await res.json();
        setCategories((prev) => [...prev, created]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    try {
      const res = await fetch(`/api/categories/${target.id}`, {
        method: "DELETE",
      });
      if (checkAuthExpired(res)) return; if (checkAuthExpired(res)) return;
        if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to archive category");
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === target.id ? { ...c, archived: true } : c)),
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Organise your income and expenses with categories.
          </p>
        </div>
        <Button onClick={openAdd}>
          <PlusIcon />
          Add Category
        </Button>
      </div>

      {error && (
        <Card>
          <EmptyState
            icon="⚠️"
            title="Something went wrong"
            description={error}
            action={
              <Button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  load();
                }}
              >
                Try again
              </Button>
            }
          />
        </Card>
      )}

      {!error && categories.length === 0 ? (
        <Card>
          <EmptyState
            icon="🏷️"
            title="No categories yet"
            description="Default categories are usually created automatically. Add your first category to get started."
            action={
              <Button onClick={openAdd}>
                <PlusIcon />
                Add Category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {CATEGORY_TYPES.map((group) => {
            const items = grouped[group.value];
            if (items.length === 0) return null;
            return (
              <section key={group.value}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg">{group.icon}</span>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {group.label}
                  </h2>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((cat) => {
                    const kids = childrenByParent.get(cat.id) ?? [];
                    return (
                      <div key={cat.id} className="space-y-2">
                        <CategoryRow
                          category={cat}
                          onEdit={() => openEdit(cat)}
                          onArchive={() => setArchiveTarget(cat)}
                        />
                        {kids.length > 0 && (
                          <div className="ml-5 space-y-2 border-l-2 border-gray-200 pl-4">
                            {kids.map((kid) => (
                              <CategoryRow
                                key={kid.id}
                                category={kid}
                                onEdit={() => openEdit(kid)}
                                onArchive={() => setArchiveTarget(kid)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {archived.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowArchived((s) => !s)}
                className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                <span>Archived ({archived.length})</span>
                <ChevronIcon open={showArchived} />
              </button>
              {showArchived && (
                <div className="mt-3 space-y-2">
                  {archived.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-3 opacity-70"
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-base"
                        style={{ backgroundColor: `${cat.color}1A` }}
                      >
                        {cat.icon || "🏷️"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-600">
                          {cat.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {typeIcon(cat.type)} {typeLabel(cat.type)}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openEdit(cat)}
                      >
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <CategoryFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        parents={candidateParents}
        initial={
          editing
            ? {
                name: editing.name,
                type: editing.type,
                parent_id: editing.parent_id,
                color: editing.color,
                icon: editing.icon,
              }
            : null
        }
      />

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive category"
        message={`Archive "${archiveTarget?.name ?? ""}"? It will be hidden from your active categories.`}
        confirmLabel="Archive"
        variant="danger"
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
