/**
 * Education / anatomy / pathway clips (Visible Body–style) — Piano 1 metadata + knowledge `topicIds`.
 * Playback is presentation-only; physiology engines remain the source of numerical state.
 */

export type EducationClipKind = "anatomy_3d" | "pathway" | "tissue" | "other";

export type EducationClipVideoAsset = {
  kind: "video";
  src: string;
  posterUrl?: string;
  mimeType?: "video/webm" | "video/mp4";
};

export type EducationClipEmbedAsset = {
  kind: "embed";
  /** Vendor iframe URL when license allows */
  embedUrl: string;
  posterUrl?: string;
};

export type EducationClipBindingV1 = {
  clipId: string;
  version?: number;
  kind: EducationClipKind;
  titleIt: string;
  summaryIt?: string;
  /** Knowledge corpus topic slugs (e.g. pathway.krebs) */
  topicIds: string[];
  asset: EducationClipVideoAsset | EducationClipEmbedAsset;
};
