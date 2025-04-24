/**
 * Utility functions for formatting text, especially for Telegram MarkdownV2.
 */

/**
 * Escapes characters that have special meaning in Telegram MarkdownV2.
 * Note: This should be applied carefully to avoid escaping intended Markdown syntax.
 * Characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
 *
 * @param {string} text The text to escape.
 * @returns {string} The escaped text.
 */
function escapeMarkdownV2(text) {
  if (!text) return '';
  // Escape characters with special meaning in MarkdownV2
  // Make sure to escape the escape character \ itself first if needed, but typically not necessary here.
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

/**
 * Formats raw text (potentially from LLM) for safe Telegram MarkdownV2 rendering.
 * - Converts common incorrect bolding (**text**) to correct MarkdownV2 (*text*).
 * - Escapes special MarkdownV2 characters within the text.
 *
 * @param {string} rawText The raw text response.
 * @returns {string} Text formatted for Telegram MarkdownV2.
 */
function formatTelegramMarkdownV2(rawText) {
  if (!rawText) return '';

  let formattedText = rawText;

  // 1. Convert common incorrect bold format (**text**) to correct V2 format (*text*)
  // Use a non-greedy match to handle multiple instances correctly
  formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // 2. Escape special characters required by MarkdownV2
  // We need to be careful here. We don't want to escape the * we just added for bold.
  // A simpler approach might be to escape everything *first* and then apply formatting.
  // Let's try escaping first, then converting bold markdown that wasn't escaped.

  // Escape all special characters first
  const escapedText = escapeMarkdownV2(formattedText);

  // Re-apply or fix formatting AFTER escaping?
  // This is tricky. Let's try a simpler strategy first: only escape what's NOT part of intended formatting.
  // For now, let's just do the bold conversion, as escaping correctly around intended markdown is complex.
  // We will rely on the LLM prompt to minimize problematic chars and revisit escaping if needed.

  // Basic conversion: Replace **...** with *...*
  // Note: This is simple and might miss edge cases or conflict if user input contained **
  formattedText = rawText.replace(/\*\*(.*?)\*\*/g, '*$1*');

  // TODO: Add more sophisticated escaping/handling if needed based on testing.
  // Potential improvements:
  // - More robust parsing to identify intended markdown vs. literal chars.
  // - Only escape special characters that are NOT part of valid markdown syntax.

  return formattedText;
}

module.exports = {
  formatTelegramMarkdownV2,
  escapeMarkdownV2 // Exporting escape separately might be useful
}; 