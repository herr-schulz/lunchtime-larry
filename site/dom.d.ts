export function escapeHtml(value: unknown): string;
export function safeUrl(value: unknown): string;
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): { toString(): string } | string;
export function setHtml(el: Element | null | undefined, value: unknown): void;
