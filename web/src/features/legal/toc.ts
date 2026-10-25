/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
const NUMBERED_H2 = /^##\s+(\d+[.、)]\s*.+?)\s*#*\s*$/gm

/**
 * Collect the numbered level-two headings ("## 1. Scope") of a markdown
 * document. Documents written as numbered sections get a table of contents;
 * documents with plain headings return an empty list and render without one.
 */
export function getNumberedHeadings(markdown: string): string[] {
  return Array.from(markdown.matchAll(NUMBERED_H2), (match) => match[1])
}
