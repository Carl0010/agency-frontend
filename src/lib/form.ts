/** A text field from a form, trimmed; file inputs and missing fields read as ''. */
export function formText(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === 'string' ? v.trim() : '';
}
