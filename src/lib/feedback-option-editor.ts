export type FeedbackOption = { label: string; value: string };

/**
 * Parse the admin's label-only editor while retaining the stable value for any
 * existing option. New options use their Russian label as the stored value.
 */
export function parseFeedbackOptionLabels(
  text: string,
  existingOptions: FeedbackOption[] = [],
): FeedbackOption[] {
  const available = [...existingOptions];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((label) => {
      const existingIndex = available.findIndex((option) => option.label === label);
      if (existingIndex >= 0) {
        const [existing] = available.splice(existingIndex, 1);
        return { label, value: existing!.value };
      }
      return { label, value: label };
    });
}
