# Supported formats

| Format     | MIME hints                                                                            | Extraction                                                                                     |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Plain text | `text/*`, `application/json`, `application/xml`, JavaScript and TypeScript MIME types | Decoded text and Unicode statistics                                                            |
| DOCX       | OOXML Word MIME type, `application/docx`                                              | Body paragraphs, nested tables, hyperlinks, tabs, breaks, common properties, structural counts |
| XLSX       | OOXML spreadsheet MIME type, `application/xlsx`                                       | Workbook-order sheets, sparse coordinates in TSV text, per-sheet extents and cell counts       |
| PPTX       | OOXML presentation MIME type, `application/pptx`                                      | Presentation-order slide text, common properties, slide count                                  |
| PDF        | `application/pdf`                                                                     | Embedded text, common properties, page count and page size in points                           |
| Images     | JPEG, PNG, GIF, BMP, TIFF, WebP MIME types                                            | Image dimensions, available EXIF/GPS values, optional OCR                                      |

OOXML MIME types are `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, and `application/vnd.openxmlformats-officedocument.presentationml.presentation`.

Legacy binary `.doc`, `.xls`, and `.ppt` are unsupported. PDF text extraction does not OCR scanned pages. Password-protected documents and malformed documents may return errors. Missing properties remain absent; unavailable GPS coordinates are optional fields.

For text, a BOM or explicit encoding takes precedence over automatic detection. Use [decoding options](/api/types#options) for strict UTF-8 or replacement of invalid sequences.
