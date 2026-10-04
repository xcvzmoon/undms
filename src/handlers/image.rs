use crate::types::*;
use image::{DynamicImage, ImageFormat, ImageReader, imageops::FilterType};
use rten::Model;
use std::{io::Cursor, sync::OnceLock};
const DETECTION_MODEL_BYTES: &[u8] = include_bytes!("../../text-detection-model.rten");
const RECOGNITION_MODEL_BYTES: &[u8] = include_bytes!("../../text-recognition-model.rten");
const MIN_OCR_LONGEST_EDGE: u32 = 1600;
const OCR_EARLY_EXIT_SCORE: usize = 256;
#[derive(Default)]
pub struct ImageHandler {
  model: OnceLock<Result<ocrs::OcrEngine, String>>,
}
impl ImageHandler {
  pub fn new() -> Self {
    Self::default()
  }
  fn load_ocr_engine() -> Result<ocrs::OcrEngine, String> {
    let detection_model = Model::load_static_slice(DETECTION_MODEL_BYTES)
      .map_err(|error| format!("Failed to load detection model: {}", error))?;
    let recognition_model = Model::load_static_slice(RECOGNITION_MODEL_BYTES)
      .map_err(|error| format!("Failed to load recognition model: {}", error))?;

    ocrs::OcrEngine::new(ocrs::OcrEngineParams {
      detection_model: Some(detection_model),
      recognition_model: Some(recognition_model),
      ..Default::default()
    })
    .map_err(|error| format!("Failed to initialize OCR engine: {}", error))
  }

  fn model(&self) -> Result<&ocrs::OcrEngine, String> {
    self
      .model
      .get_or_init(Self::load_ocr_engine)
      .as_ref()
      .map_err(Clone::clone)
  }

  fn run_ocr_pass(
    &self,
    img: &DynamicImage,
    options: &ResolvedOptions,
  ) -> ExtractionResult<String> {
    let model = self
      .model()
      .map_err(|message| ExtractionError::new(ErrorCode::OcrFailed, "ocr", message))?;
    let rgb_img = match img.as_rgb8() {
      Some(rgb) => std::borrow::Cow::Borrowed(rgb),
      None => std::borrow::Cow::Owned(img.to_rgb8()),
    };
    let (width, height) = rgb_img.dimensions();
    let image_source =
      ocrs::ImageSource::from_bytes(rgb_img.as_raw(), (width, height)).map_err(|e| {
        ExtractionError::new(
          ErrorCode::OcrFailed,
          "ocr",
          format!("Failed to create image source: {}", e),
        )
      })?;

    let ocr_input = model.prepare_input(image_source).map_err(|e| {
      ExtractionError::new(
        ErrorCode::OcrFailed,
        "ocr",
        format!("Failed to prepare OCR input: {}", e),
      )
    })?;

    let word_rects = model.detect_words(&ocr_input).map_err(|e| {
      ExtractionError::new(
        ErrorCode::OcrFailed,
        "ocr",
        format!("Failed to detect words: {}", e),
      )
    })?;

    let line_rects = model.find_text_lines(&ocr_input, &word_rects);

    let line_texts = model.recognize_text(&ocr_input, &line_rects).map_err(|e| {
      ExtractionError::new(
        ErrorCode::OcrFailed,
        "ocr",
        format!("OCR recognition failed: {}", e),
      )
    })?;

    let mut extracted_text = String::new();
    for text_line in line_texts.into_iter().flatten() {
      let text = text_line.to_string();
      if !text.trim().is_empty() {
        push_text(&mut extracted_text, &text, options)?;
        push_text(&mut extracted_text, "\n", options)?;
      }
    }

    Ok(extracted_text.trim().to_string())
  }

  fn extract_exif_metadata(
    &self,
    content: &[u8],
  ) -> (GeoLocation, Option<String>, Option<String>, Option<String>) {
    let mut location = GeoLocation {
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

      if let Some(exif_offset) = Self::read_ifd_long(tiff, ifd0, 0x8769)
        && let Some(date) = Self::read_ifd_ascii(tiff, exif_offset as usize, 0x9003)
      {
        datetime_original = Some(date);
      }

      if let Some(gps_offset) = Self::read_ifd_long(tiff, ifd0, 0x8825) {
        let latitude = Self::read_gps_coordinate(tiff, gps_offset as usize, 0x0002, 0x0001);
        let longitude = Self::read_gps_coordinate(tiff, gps_offset as usize, 0x0004, 0x0003);
        location = GeoLocation {
          latitude,
          longitude,
        };
      }
    }

    (location, camera_make, camera_model, datetime_original)
  }

  fn upscale_dimensions(width: u32, height: u32) -> Option<(u32, u32)> {
    let longest = width.max(height);
    if longest == 0 || longest >= MIN_OCR_LONGEST_EDGE {
      return None;
    }
    Some((
      ((u64::from(width) * 1600) / u64::from(longest)).max(1) as u32,
      ((u64::from(height) * 1600) / u64::from(longest)).max(1) as u32,
    ))
  }
  fn ocr_text_score(text: &str) -> usize {
    text.split_whitespace().count() * 16 + text.chars().filter(|c| c.is_alphanumeric()).count()
  }
  fn extract_text_from_image(
    &self,
    img: &DynamicImage,
    options: &ResolvedOptions,
  ) -> ExtractionResult<String> {
    let dimensions = Self::upscale_dimensions(img.width(), img.height()).filter(|(w, h)| {
      let pixels = u64::from(*w) * u64::from(*h);
      pixels <= options.limits.max_image_pixels
        && pixels * 4 <= options.limits.max_decompressed_bytes as u64
    });
    let first_upscaled = img.width().max(img.height()) < 800 && dimensions.is_some();
    let names = if first_upscaled {
      [
        "upscaled",
        "original",
        "grayscale",
        "contrasted",
        "upscaled_contrasted",
      ]
    } else {
      [
        "original",
        "grayscale",
        "contrasted",
        "upscaled",
        "upscaled_contrasted",
      ]
    };
    let passes = match options.ocr {
      OcrPolicy::Disabled => 0,
      OcrPolicy::Fast => 1,
      OcrPolicy::Balanced => 2,
      OcrPolicy::Accurate => 5,
    };
    let mut upscaled = None;
    let mut best = String::new();
    let mut score = 0;
    let mut last_error = None;
    let mut succeeded = false;
    for name in names.into_iter().take(passes) {
      if name.starts_with("upscaled") && dimensions.is_none() {
        continue;
      }
      if name.starts_with("upscaled") && upscaled.is_none() {
        let (w, h) = dimensions.expect("checked dimensions");
        upscaled = Some(img.resize_exact(w, h, FilterType::Lanczos3));
      }
      let transformed;
      let candidate = match name {
        "upscaled" => upscaled.as_ref().expect("initialized image"),
        "upscaled_contrasted" => {
          transformed = upscaled
            .as_ref()
            .expect("initialized image")
            .grayscale()
            .adjust_contrast(35.0);
          &transformed
        }
        "grayscale" => {
          transformed = img.grayscale();
          &transformed
        }
        "contrasted" => {
          transformed = img.grayscale().adjust_contrast(35.0);
          &transformed
        }
        _ => img,
      };
      match self.run_ocr_pass(candidate, options) {
        Ok(text) => {
          succeeded = true;
          let next = Self::ocr_text_score(&text);
          if next > score || (next == score && text.len() > best.len()) {
            score = next;
            best = text;
          }
          if score >= OCR_EARLY_EXIT_SCORE {
            break;
          }
        }
        Err(error) if error.code == ErrorCode::LimitExceeded => return Err(error),
        Err(error) => last_error = Some(error),
      }
    }
    if succeeded {
      Ok(best)
    } else {
      Err(
        last_error
          .unwrap_or_else(|| ExtractionError::new(ErrorCode::OcrFailed, "ocr", "OCR failed")),
      )
    }
  }
}
impl DocumentHandler for ImageHandler {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let reader = ImageReader::new(Cursor::new(content))
      .with_guessed_format()
      .map_err(|e| ExtractionError::invalid(e.to_string()))?;
    let format = reader.format().map(Self::format_to_string);
    let (width, height) = reader
      .into_dimensions()
      .map_err(|e| ExtractionError::new(ErrorCode::DecodeFailed, "decode", e.to_string()))?;
    if u64::from(width) * u64::from(height) > options.limits.max_image_pixels {
      return Err(ExtractionError::limit("image exceeds maxImagePixels"));
    }
    let (location, camera_make, camera_model, datetime_original) =
      self.extract_exif_metadata(content);
    let mut output = HandlerOutput::new(
      options.needs_text().then(String::new),
      FormatMetadata::Image(ImageMetadata {
        width,
        height,
        format,
        camera_make,
        camera_model,
        datetime_original,
        location,
      }),
      options,
    );
    if !options.needs_text() || options.ocr == OcrPolicy::Disabled {
      return Ok(output);
    }
    let mut reader = ImageReader::new(Cursor::new(content))
      .with_guessed_format()
      .map_err(|e| ExtractionError::invalid(e.to_string()))?;
    let mut limits = image::Limits::default();
    limits.max_alloc = Some(options.limits.max_decompressed_bytes as u64);
    reader.limits(limits);
    let img = reader
      .decode()
      .map_err(|e| ExtractionError::new(ErrorCode::DecodeFailed, "decode", e.to_string()))?;
    match self.extract_text_from_image(&img, options) {
      Ok(text) => push_text(
        output.text.as_mut().expect("text requested"),
        &text,
        options,
      )?,
      Err(error) if error.code == ErrorCode::LimitExceeded => return Err(error),
      Err(error) => warn(
        &mut output.warnings,
        ExtractionWarning {
          code: "OCR_FAILED",
          message: error.message,
          location: None,
          partial: true,
        },
        options,
      ),
    }
    Ok(output)
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

      if marker == 0xe1
        && segment_start + 6 <= segment_end
        && content[segment_start..segment_start + 6].starts_with(b"Exif\0\0")
      {
        let tiff_start = segment_start + 6;
        if tiff_start + 8 <= segment_end {
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
              data: &content[..segment_end],
              offset: tiff_start,
              is_le,
              first_ifd_offset,
            });
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
    let trimmed = bytes.split(|b| *b == 0).next().unwrap_or(bytes);
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
      b'S' if ref_tag == 0x0001 => -1.0,
      b'W' if ref_tag == 0x0003 => -1.0,
      b'N' if ref_tag == 0x0001 => 1.0,
      b'E' if ref_tag == 0x0003 => 1.0,
      _ => return None,
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

    let coordinate = deg + (min / 60.0) + (sec / 3600.0);
    let maximum = if ref_tag == 0x0001 { 90.0 } else { 180.0 };
    (min < 60.0 && sec < 60.0 && coordinate <= maximum).then_some(coordinate * sign)
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

  fn find_ifd_entry<'a>(tiff: TiffData<'a>, ifd_offset: usize, tag: u16) -> Option<IfdEntry<'a>> {
    let base = tiff.offset.checked_add(ifd_offset)?;
    if base.checked_add(2)? > tiff.data.len() {
      return None;
    }
    let count = Self::read_u16(tiff, &tiff.data[base..base + 2]) as usize;
    let entries_start = base + 2;
    for index in 0..count {
      let entry_offset = entries_start.checked_add(index.checked_mul(12)?)?;
      if entry_offset.checked_add(12)? > tiff.data.len() {
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
          raw_value: &tiff.data[entry_offset + 8..entry_offset + 12],
        });
      }
    }
    None
  }

  fn read_entry_bytes<'a>(tiff: TiffData<'a>, entry: IfdEntry<'a>) -> Option<&'a [u8]> {
    let unit: usize = match entry.field_type {
      1 | 2 => 1,
      3 => 2,
      4 => 4,
      5 => 8,
      _ => return None,
    };
    let length = unit.checked_mul(entry.count as usize)?;
    if length == 0 {
      return None;
    }

    if length <= 4 {
      return Some(&entry.raw_value[..length]);
    }

    let start = tiff.offset.checked_add(entry.value_offset as usize)?;
    let end = start.checked_add(length)?;
    if end > tiff.data.len() {
      return None;
    }
    Some(&tiff.data[start..end])
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

#[derive(Clone, Copy)]
struct TiffData<'a> {
  data: &'a [u8],
  offset: usize,
  is_le: bool,
  first_ifd_offset: usize,
}

#[derive(Clone, Copy)]
struct IfdEntry<'a> {
  field_type: u16,
  count: u32,
  value_offset: u32,
  raw_value: &'a [u8],
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

#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn initialization_is_lazy() {
    assert!(ImageHandler::new().model.get().is_none());
  }
  #[test]
  fn upscale_eligibility_uses_dimensions() {
    assert_eq!(
      ImageHandler::upscale_dimensions(400, 200),
      Some((1600, 800))
    );
    assert_eq!(ImageHandler::upscale_dimensions(1600, 800), None);
  }
  #[test]
  fn malformed_exif_offsets_are_safe() {
    let t = TiffData {
      data: &[0; 16],
      offset: 8,
      is_le: true,
      first_ifd_offset: 0,
    };
    assert!(ImageHandler::find_ifd_entry(t, usize::MAX, 1).is_none());
  }
  #[test]
  fn metadata_skips_model() {
    let mut bytes = Cursor::new(Vec::new());
    DynamicImage::new_rgb8(2, 3)
      .write_to(&mut bytes, ImageFormat::Png)
      .unwrap();
    let h = ImageHandler::new();
    let options = ResolvedOptions {
      text: false,
      statistics: false,
      ..Default::default()
    };
    let output = h.extract(bytes.get_ref(), &options).unwrap();
    assert!(output.text.is_none());
    assert!(output.metadata.is_some());
    assert!(h.model.get().is_none());
  }
}
