export const BJJ_CONCEPTS = [
  "frame",
  "post",
  "wedge",
  "base",
  "posture",
  "centerline",
  "inside position",
  "pressure",
  "underhook",
  "overhook",
  "grip",
  "angle",
  "hip escape",
  "bridge",
  "hook",
  "cross-face",
  "knee shield",
  "pummel",
] as const;

export type BJJConcept = (typeof BJJ_CONCEPTS)[number];
