/**
 * What an institution says about itself to applicants: a logo, a motto and a
 * short description. The limits live here so the form and the server agree.
 */

export const MOTTO_MAX_CHARS = 150;
/** "A brief description of, say, 250 words maximum." */
export const DESCRIPTION_MAX_WORDS = 250;
/** A ceiling on length as well, so 250 enormous "words" can't be saved. */
export const DESCRIPTION_MAX_CHARS = 3000;

/** The logo's accepted types and size, as the upload endpoint enforces them. */
export const LOGO_FILE_TYPES = ["png", "jpg", "jpeg"];
export const LOGO_MAX_MB = 1;

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** The message for a description that is too long; null when it is fine. */
export function descriptionProblem(text: string): string | null {
  const words = wordCount(text);
  return words > DESCRIPTION_MAX_WORDS ? `Keep the description to ${DESCRIPTION_MAX_WORDS} words or fewer (it is ${words}).` : null;
}
