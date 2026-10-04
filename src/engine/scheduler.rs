use super::{Input, Processed, image_job, process};
use crate::{handlers::image::ImageHandler, types::ResolvedOptions};
use std::{
  sync::{Arc, Mutex, OnceLock, mpsc},
  time::Instant,
};
use tokio::sync::oneshot;
const MAX_REQUESTS: usize = 32;
const MAX_RESERVED_BYTES: usize = 512 * 1024 * 1024;
static ADMISSION: Mutex<(usize, usize)> = Mutex::new((0, 0));
static POOL: OnceLock<Result<rayon::ThreadPool, String>> = OnceLock::new();
type ImageJob = Box<dyn FnOnce() + Send + 'static>;
static IMAGE_QUEUE: OnceLock<Result<mpsc::Sender<ImageJob>, String>> = OnceLock::new();
static IMAGE_HANDLER: OnceLock<ImageHandler> = OnceLock::new();
pub fn image_handler() -> &'static ImageHandler {
  IMAGE_HANDLER.get_or_init(ImageHandler::new)
}
pub fn worker_count() -> usize {
  std::thread::available_parallelism()
    .map_or(1, usize::from)
    .clamp(1, 4)
}
fn pool() -> Result<&'static rayon::ThreadPool, String> {
  POOL
    .get_or_init(|| {
      rayon::ThreadPoolBuilder::new()
        .num_threads(worker_count())
        .thread_name(|n| format!("undms-cpu-{n}"))
        .build()
        .map_err(|e| e.to_string())
    })
    .as_ref()
    .map_err(Clone::clone)
}
fn submit_image(job: ImageJob) -> Result<(), String> {
  let queue = IMAGE_QUEUE
    .get_or_init(|| {
      let (tx, rx) = mpsc::channel::<ImageJob>();
      // A Rayon caller can steal another queued OCR job while waiting for RTen.
      // A dedicated thread prevents reentrant inference; admission bounds its queue.
      std::thread::Builder::new()
        .name("undms-image-0".into())
        .spawn(move || {
          while let Ok(job) = rx.recv() {
            job();
          }
        })
        .map_err(|error| error.to_string())?;
      Ok(tx)
    })
    .as_ref()
    .map_err(Clone::clone)?;
  queue.send(job).map_err(|_| "OCR worker stopped".into())
}
#[derive(Debug)]
pub struct Admission {
  bytes: usize,
}
impl Admission {
  pub fn reserve(bytes: usize) -> Result<Self, String> {
    let mut state = ADMISSION
      .lock()
      .map_err(|_| "scheduler admission unavailable")?;
    if state.0 >= MAX_REQUESTS || bytes > MAX_RESERVED_BYTES.saturating_sub(state.1) {
      return Err("OVERLOADED: extraction request/byte capacity exceeded".into());
    }
    state.0 += 1;
    state.1 += bytes;
    Ok(Self { bytes })
  }
}
impl Drop for Admission {
  fn drop(&mut self) {
    if let Ok(mut state) = ADMISSION.lock() {
      state.0 -= 1;
      state.1 -= self.bytes;
    }
  }
}
pub async fn run(
  input: Input,
  options: Arc<ResolvedOptions>,
  submitted: Instant,
  admission: Arc<Admission>,
) -> Result<Processed, String> {
  let (tx, rx) = oneshot::channel();
  let image = image_job(&input, &options);
  let job = move || {
    let _admission = admission;
    if tx.is_closed() {
      return;
    }
    let output = process(input, &options, submitted);
    let _ = tx.send(output);
  };
  if image {
    submit_image(Box::new(job))?;
  } else {
    pool()?.spawn_fifo(job);
  }
  rx.await
    .map_err(|_| "extraction worker stopped".to_string())
}
#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn admission_releases_capacity() {
    let a = Admission::reserve(MAX_RESERVED_BYTES).unwrap();
    assert!(Admission::reserve(1).is_err());
    drop(a);
    assert!(Admission::reserve(1).is_ok());

    // Hold every CPU worker, then cancel a polled request while its job is queued.
    // The queued closure must retain the reservation until a worker discards it.
    let admission = Arc::new(Admission::reserve(MAX_RESERVED_BYTES).unwrap());
    let started = Arc::new(std::sync::Barrier::new(worker_count() + 1));
    let release = Arc::new(std::sync::Barrier::new(worker_count() + 1));
    for _ in 0..worker_count() {
      let started = Arc::clone(&started);
      let release = Arc::clone(&release);
      pool().unwrap().spawn_fifo(move || {
        started.wait();
        release.wait();
      });
    }
    started.wait();
    let mut future = Box::pin(run(
      Input {
        bytes: Vec::new(),
        source: Default::default(),
        pre_error: None,
      },
      Arc::new(ResolvedOptions::default()),
      Instant::now(),
      Arc::clone(&admission),
    ));
    let waker = futures_util::task::noop_waker_ref();
    let mut context = std::task::Context::from_waker(waker);
    assert!(std::future::Future::poll(future.as_mut(), &mut context).is_pending());
    drop(future);
    drop(admission);
    assert!(Admission::reserve(1).is_err());
    release.wait();
    let deadline = Instant::now() + std::time::Duration::from_secs(2);
    loop {
      if Admission::reserve(1).is_ok() {
        break;
      }
      assert!(Instant::now() < deadline, "cancelled job leaked admission");
      std::thread::yield_now();
    }
  }
}
