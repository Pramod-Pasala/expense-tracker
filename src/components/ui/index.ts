/**
 * Barrel re-export of all UI primitives.
 *
 * Import from "@/components/ui" — e.g. `import { Button, Card, Input } from "@/components/ui"`.
 * Keeps the original ui.tsx barrel API (named exports, TextInput alias) while
 * letting each component live in its own file.
 */
export { default as Amount } from "./Amount";
export { default as Badge } from "./Badge";
export { default as Button } from "./Button";
export { default as Card } from "./Card";
export { default as DateInput } from "./DateInput";
export { default as EmptyState } from "./EmptyState";
export { default as Input } from "./Input";
export { default as Label } from "./Label";
export { default as LoadingState } from "./LoadingState";
export { default as Modal } from "./Modal";
export { default as PageHeader } from "./PageHeader";
export { default as Select } from "./Select";
export { default as Spinner } from "./Spinner";
export { default as TextArea } from "./TextArea";

/** Alias matching the original ui.tsx barrel name. */
export { default as TextInput } from "./Input";
