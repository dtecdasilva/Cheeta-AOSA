/**
 * Cheeta Academia Online — brand constants.
 *
 * Names and logo files live here so that every screen says the same thing
 * and a logo swap is a one-line change. Colours and type are in
 * src/app/globals.css.
 */

export interface LogoAsset {
  /** Path under /public. */
  src: string;
  /** Intrinsic pixel size of the file. Only the ratio matters: the logo is
   *  always scaled by height with its width following, never stretched. */
  width: number;
  height: number;
}

export const BRAND = {
  /** The brand. */
  name: "Cheeta Academia Online",
  /** The product, in full. */
  platformName: "Cheeta Academia Online School Application Platform",
  /** The product, where space is short. */
  shortName: "Cheeta AOSA Platform",
  /** Label set beside the mark in navigation. */
  navLabel: "Cheeta AOSA",

  logo: {
    /** Icon / mark — compact layouts: sidebar, mobile header. */
    mark: { src: "/logo.png", width: 64, height: 64 } as LogoAsset,
    /**
     * Full logo (mark + wordmark) — used wherever there is room for it.
     *
     * Set this once the file is in /public, with the file's real pixel
     * dimensions, e.g.
     *   full: { src: "/logo-full.svg", width: 720, height: 160 }
     * While it is `null`, the mark is shown with the name set beside it.
     */
    full: null as LogoAsset | null,
  },
} as const;
