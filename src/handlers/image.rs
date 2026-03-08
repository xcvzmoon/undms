use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{ImageLocation, ImageMetadata, MetadataPayload, build_text_metadata};
use image::{DynamicImage, GenericImageView, ImageFormat, ImageReader, imageops::FilterType};
use rten::Model;
use std::io::Cursor;

const DETECTION_MODEL_BYTES: &[u8] = include_bytes!("../../text-detection-model.rten");
const RECOGNITION_MODEL_BYTES: &[u8] = include_bytes!("../../text-recognition-model.rten");
const MIN_OCR_LONGEST_EDGE: u32 = 1600;
const OCR_CONTRAST_BOOST: f32 = 35.0;

pub struct ImageHandler {
  model: ocrs::OcrEngine,
}

impl ImageHandler {
  pub fn new() -> Self {
    let detection_model =
      Model::load_static_slice(DETECTION_MODEL_BYTES).expect("Failed to load detection model");
    let recognition_model =
      Model::load_static_slice(RECOGNITION_MODEL_BYTES).expect("Failed to load recognition model");

    let model = ocrs::OcrEngine::new(ocrs::OcrEngineParams {
      detection_model: Some(detection_model),
      recognition_model: Some(recognition_model),
      ..Default::default()
    })
    .expect("Failed to initialize OCR engine");

    Self { model }
  }

  fn run_ocr_pass(&self, img: &DynamicImage) -> Result<String, String> {
    let rgb_img = img.to_rgb8();
    let (width, height) = rgb_img.dimensions();
    let image_source = ocrs::ImageSource::from_bytes(rgb_img.as_raw(), (width, height))
      .map_err(|e| format!("Failed to create image source: {}", e))?;

    let ocr_input = self
      .model
      .prepare_input(image_source)
      .map_err(|e| format!("Failed to prepare OCR input: {}", e))?;

    let word_rects = self
      .model
      .detect_words(&ocr_input)
      .map_err(|e| format!("Failed to detect words: {}", e))?;

    let line_rects = self.model.find_text_lines(&ocr_input, &word_rects);

    let line_texts = self
      .model
      .recognize_text(&ocr_input, &line_rects)
      .map_err(|e| format!("OCR recognition failed: {}", e))?;

    let mut extracted_text = String::new();
    for line_text in line_texts {
      if let Some(text_line) = line_text {
        let text = text_line.to_string();
        if !text.trim().is_empty() {
          extracted_text.push_str(&text);
          extracted_text.push('\n');
        }
      }
    }

    Ok(extracted_text.trim().to_string())
  }

  fn extract_text_from_image(&self, img: &DynamicImage) -> Result<String, String> {
    let mut best_text = String::new();
    let mut best_score = 0;
    let mut last_error = None;

    for candidate in Self::ocr_variants(img) {
      match self.run_ocr_pass(&candidate) {
        Ok(text) => {
          let score = Self::ocr_text_score(&text);
          if score > best_score || (score == best_score && text.len() > best_text.len()) {
            best_score = score;
            best_text = text;
          }
        }
        Err(error) => last_error = Some(error),
      }
    }

    if best_score > 0 || last_error.is_none() {
      Ok(best_text)
    } else {
      Err(last_error.unwrap_or_else(|| "OCR extraction failed".to_string()))
    }
  }

  fn extract_exif_metadata(
    &self,
    content: &[u8],
  ) -> (
    ImageLocation,
    Option<String>,
    Option<String>,
    Option<String>,
  ) {
    let mut location = ImageLocation {
      latitude: None,
      longitude: None,
    };
    let mut camera_make = None;
    let mut camera_model = None;
    let mut datetime_original = None;

    if let Some(tiff) = Self::find_exif_tiff(content) {
      let ifd0 = tiff.first_ifd_offset;
      if let Some(make) = Self::read_ifd_ascii(tiff, ifd0, 0x010f) {
        camera_make = Some(make);
      }
      if let Some(model) = Self::read_ifd_ascii(tiff, ifd0, 0x0110) {
        camera_model = Some(model);
      }

      if let Some(exif_offset) = Self::read_ifd_long(tiff, ifd0, 0x8769) {
        if let Some(date) = Self::read_ifd_ascii(tiff, exif_offset as usize, 0x9003) {
          datetime_original = Some(date);
        }
      }

      if let Some(gps_offset) = Self::read_ifd_long(tiff, ifd0, 0x8825) {
        let latitude = Self::read_gps_coordinate(tiff, gps_offset as usize, 0x0002, 0x0001);
        let longitude = Self::read_gps_coordinate(tiff, gps_offset as usize, 0x0004, 0x0003);
        location = ImageLocation {
          latitude,
          longitude,
        };
      }
    }

    (location, camera_make, camera_model, datetime_original)
  }

  fn build_metadata(
    &self,
    content: &str,
    width: u32,
    height: u32,
    format: Option<String>,
    location: ImageLocation,
    camera_make: Option<String>,
    camera_model: Option<String>,
    datetime_original: Option<String>,
  ) -> MetadataPayload {
    let text_metadata = build_text_metadata(content);

    MetadataPayload {
      text: text_metadata,
      docx: None,
      xlsx: None,
      pdf: None,
      image: Some(ImageMetadata {
        width,
        height,
        format,
        camera_make,
        camera_model,
        datetime_original,
        location,
      }),
    }
  }

  fn ocr_variants(img: &DynamicImage) -> Vec<DynamicImage> {
    let mut variants = vec![img.clone()];

    let grayscale = img.grayscale();
    variants.push(grayscale.clone());
    variants.push(grayscale.adjust_contrast(OCR_CONTRAST_BOOST));

    if let Some(upscaled) = Self::upscale_for_ocr(img) {
      variants.push(upscaled.clone());
      variants.push(upscaled.grayscale().adjust_contrast(OCR_CONTRAST_BOOST));
    }

    variants
  }

  fn upscale_for_ocr(img: &DynamicImage) -> Option<DynamicImage> {
    let (width, height) = img.dimensions();
    let longest_edge = width.max(height);
    if longest_edge >= MIN_OCR_LONGEST_EDGE || longest_edge == 0 {
      return None;
    }

    let scale = MIN_OCR_LONGEST_EDGE as f32 / longest_edge as f32;
    let new_width = ((width as f32 * scale).round() as u32).max(1);
    let new_height = ((height as f32 * scale).round() as u32).max(1);

    Some(img.resize_exact(new_width, new_height, FilterType::Lanczos3))
  }

  fn ocr_text_score(text: &str) -> usize {
    let trimmed = text.trim();
    if trimmed.is_empty() {
      return 0;
    }

    let word_count = trimmed.split_whitespace().count();
    let alphanumeric_count = trimmed
      .chars()
      .filter(|char| char.is_alphanumeric())
      .count();

    (word_count * 16) + alphanumeric_count
  }
}

impl ImageHandler {
  fn find_exif_tiff(content: &[u8]) -> Option<TiffData<'_>> {
    if content.len() < 4 || content[0] != 0xff || content[1] != 0xd8 {
      return None;
    }

    let mut index = 2;
    while index + 4 <= content.len() {
      if content[index] != 0xff {
        index += 1;
        continue;
      }

      let marker = content[index + 1];
      index += 2;

      if marker == 0xd9 || marker == 0xda {
        break;
      }

      if marker == 0x01 || (0xd0..=0xd7).contains(&marker) {
        continue;
      }

      if index + 2 > content.len() {
        break;
      }

      let length = u16::from_be_bytes([content[index], content[index + 1]]) as usize;
      if length < 2 {
        break;
      }

      let segment_start = index + 2;
      let segment_end = index + length;
      if segment_end > content.len() {
        break;
      }

      if marker == 0xe1 && segment_start + 6 <= content.len() {
        if content[segment_start..segment_start + 6].starts_with(b"Exif\0\0") {
          let tiff_start = segment_start + 6;
          if tiff_start + 8 <= content.len() {
            let endian = &content[tiff_start..tiff_start + 2];
            let is_le = endian == b"II";
            if is_le || endian == b"MM" {
              let magic = if is_le {
                u16::from_le_bytes([content[tiff_start + 2], content[tiff_start + 3]])
              } else {
                u16::from_be_bytes([content[tiff_start + 2], content[tiff_start + 3]])
              };

              if magic != 42 {
                return None;
              }

              let first_ifd_offset = if is_le {
                u32::from_le_bytes([
                  content[tiff_start + 4],
                  content[tiff_start + 5],
                  content[tiff_start + 6],
                  content[tiff_start + 7],
                ]) as usize
              } else {
                u32::from_be_bytes([
                  content[tiff_start + 4],
                  content[tiff_start + 5],
                  content[tiff_start + 6],
                  content[tiff_start + 7],
                ]) as usize
              };

              return Some(TiffData {
                data: content,
                offset: tiff_start,
                is_le,
                first_ifd_offset,
              });
            }
          }
        }
      }

      index = segment_end;
    }

    None
  }

  fn read_ifd_ascii(tiff: TiffData<'_>, ifd_offset: usize, tag: u16) -> Option<String> {
    let entry = Self::find_ifd_entry(tiff, ifd_offset, tag)?;
    if entry.field_type != 2 {
      return None;
    }
    let bytes = Self::read_entry_bytes(tiff, entry)?;
    let trimmed = bytes.split(|b| *b == 0).next().unwrap_or(&bytes);
    Some(String::from_utf8_lossy(trimmed).to_string())
  }

  fn read_ifd_long(tiff: TiffData<'_>, ifd_offset: usize, tag: u16) -> Option<u32> {
    let entry = Self::find_ifd_entry(tiff, ifd_offset, tag)?;
    if entry.field_type != 4 || entry.count < 1 {
      return None;
    }
    let bytes = Self::read_entry_bytes(tiff, entry)?;
    if bytes.len() < 4 {
      return None;
    }
    Some(Self::read_u32(tiff, &bytes[0..4]))
  }

  fn read_gps_coordinate(
    tiff: TiffData<'_>,
    ifd_offset: usize,
    value_tag: u16,
    ref_tag: u16,
  ) -> Option<f64> {
    let ref_entry = Self::find_ifd_entry(tiff, ifd_offset, ref_tag)?;
    if ref_entry.field_type != 2 {
      return None;
    }
    let ref_bytes = Self::read_entry_bytes(tiff, ref_entry)?;
    let ref_value = ref_bytes.first().copied()?;
    let sign = match ref_value {
      b'S' | b'W' => -1.0,
      _ => 1.0,
    };

    let value_entry = Self::find_ifd_entry(tiff, ifd_offset, value_tag)?;
    if value_entry.field_type != 5 || value_entry.count < 3 {
      return None;
    }

    let data = Self::read_entry_bytes(tiff, value_entry)?;
    if data.len() < 24 {
      return None;
    }

    let deg = Self::read_rational(tiff, &data[0..8])?;
    let min = Self::read_rational(tiff, &data[8..16])?;
    let sec = Self::read_rational(tiff, &data[16..24])?;

    Some((deg + (min / 60.0) + (sec / 3600.0)) * sign)
  }

  fn read_rational(tiff: TiffData<'_>, bytes: &[u8]) -> Option<f64> {
    if bytes.len() < 8 {
      return None;
    }
    let numerator = Self::read_u32(tiff, &bytes[0..4]) as f64;
    let denominator = Self::read_u32(tiff, &bytes[4..8]) as f64;
    if denominator == 0.0 {
      return None;
    }
    Some(numerator / denominator)
  }

  fn find_ifd_entry(tiff: TiffData<'_>, ifd_offset: usize, tag: u16) -> Option<IfdEntry> {
    let base = tiff.offset + ifd_offset;
    if base + 2 > tiff.data.len() {
      return None;
    }
    let count = Self::read_u16(tiff, &tiff.data[base..base + 2]) as usize;
    let entries_start = base + 2;
    for index in 0..count {
      let entry_offset = entries_start + index * 12;
      if entry_offset + 12 > tiff.data.len() {
        return None;
      }
      let tag_value = Self::read_u16(tiff, &tiff.data[entry_offset..entry_offset + 2]);
      if tag_value == tag {
        let field_type = Self::read_u16(tiff, &tiff.data[entry_offset + 2..entry_offset + 4]);
        let count = Self::read_u32(tiff, &tiff.data[entry_offset + 4..entry_offset + 8]);
        let raw_value = [
          tiff.data[entry_offset + 8],
          tiff.data[entry_offset + 9],
          tiff.data[entry_offset + 10],
          tiff.data[entry_offset + 11],
        ];
        let value_offset = Self::read_u32(tiff, &raw_value);
        return Some(IfdEntry {
          field_type,
          count,
          value_offset,
          raw_value,
        });
      }
    }
    None
  }

  fn read_entry_bytes(tiff: TiffData<'_>, entry: IfdEntry) -> Option<Vec<u8>> {
    let unit: usize = match entry.field_type {
      1 | 2 => 1,
      3 => 2,
      4 => 4,
      5 => 8,
      _ => return None,
    };
    let length = unit.saturating_mul(entry.count as usize);
    if length == 0 {
      return None;
    }

    if length <= 4 {
      return Some(entry.raw_value[..length].to_vec());
    }

    let start = tiff.offset + entry.value_offset as usize;
    let end = start + length;
    if end > tiff.data.len() {
      return None;
    }
    Some(tiff.data[start..end].to_vec())
  }

  fn read_u16(tiff: TiffData<'_>, bytes: &[u8]) -> u16 {
    if tiff.is_le {
      u16::from_le_bytes([bytes[0], bytes[1]])
    } else {
      u16::from_be_bytes([bytes[0], bytes[1]])
    }
  }

  fn read_u32(tiff: TiffData<'_>, bytes: &[u8]) -> u32 {
    if tiff.is_le {
      u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
    } else {
      u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
    }
  }
}

#[cfg(test)]
mod tests {
  use super::ImageHandler;
  use image::DynamicImage;

  #[test]
  fn new_initializes_embedded_models() {
    let _handler = ImageHandler::new();
  }

  #[test]
  fn ocr_variants_include_upscaled_preprocessed_images_for_small_inputs() {
    let img = DynamicImage::new_rgb8(320, 240);
    let variants = ImageHandler::ocr_variants(&img);

    assert_eq!(variants.len(), 5);
    assert!(
      variants.iter().any(|variant| variant.width() > img.width()),
      "expected at least one upscaled OCR variant"
    );
  }

  #[test]
  fn upscale_for_ocr_skips_large_images() {
    let img = DynamicImage::new_rgb8(2200, 1600);
    assert!(ImageHandler::upscale_for_ocr(&img).is_none());
  }
}

#[derive(Clone, Copy)]
struct TiffData<'a> {
  data: &'a [u8],
  offset: usize,
  is_le: bool,
  first_ifd_offset: usize,
}

#[derive(Clone, Copy)]
struct IfdEntry {
  field_type: u16,
  count: u32,
  value_offset: u32,
  raw_value: [u8; 4],
}

impl DocumentHandler for ImageHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    mime_type.starts_with("image/")
      && (mime_type == "image/jpeg"
        || mime_type == "image/jpg"
        || mime_type == "image/png"
        || mime_type == "image/gif"
        || mime_type == "image/bmp"
        || mime_type == "image/tiff"
        || mime_type == "image/webp")
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    let cursor = Cursor::new(content);
    let reader = match ImageReader::new(cursor).with_guessed_format() {
      Ok(reader) => reader,
      Err(error) => {
        return ExtractionResult {
          content: None,
          encoding: Some("utf-8".to_string()),
          metadata: None,
          error: Some(format!("Failed to read image: {}", error)),
        };
      }
    };

    let format = reader.format().map(Self::format_to_string);
    let img = match reader.decode() {
      Ok(img) => img,
      Err(error) => {
        return ExtractionResult {
          content: None,
          encoding: Some("utf-8".to_string()),
          metadata: None,
          error: Some(format!("Failed to decode image: {}", error)),
        };
      }
    };

    let (width, height) = img.dimensions();
    let (location, camera_make, camera_model, datetime_original) =
      self.extract_exif_metadata(content);

    match self.extract_text_from_image(&img) {
      Ok(text) => {
        let metadata = self.build_metadata(
          &text,
          width,
          height,
          format,
          location,
          camera_make,
          camera_model,
          datetime_original,
        );
        ExtractionResult {
          content: Some(text),
          encoding: Some("utf-8".to_string()),
          metadata: Some(metadata),
          error: None,
        }
      }
      Err(error) => ExtractionResult {
        content: None,
        encoding: Some("utf-8".to_string()),
        metadata: None,
        error: Some(error),
      },
    }
  }
}

impl ImageHandler {
  fn format_to_string(format: ImageFormat) -> String {
    match format {
      ImageFormat::Png => "png".to_string(),
      ImageFormat::Jpeg => "jpeg".to_string(),
      ImageFormat::Gif => "gif".to_string(),
      ImageFormat::Bmp => "bmp".to_string(),
      ImageFormat::Tiff => "tiff".to_string(),
      ImageFormat::WebP => "webp".to_string(),
      ImageFormat::Pnm => "pnm".to_string(),
      ImageFormat::Tga => "tga".to_string(),
      ImageFormat::Dds => "dds".to_string(),
      ImageFormat::Ico => "ico".to_string(),
      ImageFormat::Farbfeld => "farbfeld".to_string(),
      _ => "unknown".to_string(),
    }
  }
}
