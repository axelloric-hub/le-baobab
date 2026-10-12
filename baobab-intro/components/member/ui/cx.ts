/** Concatène des classes CSS en ignorant les valeurs vides. */
export function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}
