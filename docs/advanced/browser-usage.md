# Browser Usage

Use undms in web browsers for client-side document processing.

## Installation

For browser usage, use the browser-specific build:

```html
<script src="https://unpkg.com/undms/browser.js"></script>
```

Or import via module:

```html
<script type="module">
  import * as undms from 'https://unpkg.com/undms/browser.js';
</script>
```

## File Input Handling

Process files from HTML file inputs:

```html
<input type="file" id="fileInput" accept=".pdf,.docx,.txt" multiple />

<script type="module">
  import { extract } from 'undms/browser.js';

  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;

    for (const file of files) {
      const buffer = await file.arrayBuffer();

      const result = extract([
        {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: '',
          buffer: Buffer.from(buffer),
        },
      ]);

      console.log(result[0].documents[0].content);
    }
  });
</script>
```

## Drag and Drop

Implement drag and drop file processing:

```html
<div id="dropZone" style="border: 2px dashed #ccc; padding: 2rem; text-align: center;">
  Drop files here to extract text
</div>

<div id="results"></div>

<script type="module">
  import { extract } from 'undms/browser.js';

  const dropZone = document.getElementById('dropZone');
  const results = document.getElementById('results');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#22c55e';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#ccc';
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#ccc';

    const files = e.dataTransfer.files;
    const documents = [];

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      documents.push({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        webkitRelativePath: '',
        buffer: Buffer.from(buffer),
      });
    }

    const extractionResults = extract(documents);

    results.innerHTML = extractionResults
      .map(
        (group) => `
        <h3>${group.mimeType}</h3>
        ${group.documents
          .map(
            (doc) => `
          <div class="file-result">
            <h4>${doc.name}</h4>
            <pre>${doc.content.substring(0, 200)}...</pre>
            <p>Processing time: ${doc.processingTime.toFixed(2)}ms</p>
          </div>
        `,
          )
          .join('')}
      `,
      )
      .join('');
  });
</script>
```

## Web Worker Integration

Process documents without blocking the main thread:

```javascript
// worker.js
import { extract } from 'undms/browser.js';

self.onmessage = async (e) => {
  const { files } = e.data;

  const documents = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: '',
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );

  const results = extract(documents);

  self.postMessage(results);
};
```

```html
<!-- index.html -->
<script type="module">
  const worker = new Worker('worker.js', { type: 'module' });

  const fileInput = document.getElementById('fileInput');

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);

    worker.postMessage({ files });

    worker.onmessage = (e) => {
      console.log('Results:', e.data);
    };
  });
</script>
```

## Progress Tracking

Show progress for large file batches:

```html
<progress id="progress" value="0" max="100"></progress>
<span id="status">Ready</span>

<script type="module">
  import { extract } from 'undms/browser.js';

  async function processFiles(files) {
    const progress = document.getElementById('progress');
    const status = document.getElementById('status');
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = Array.from(files).slice(i, i + batchSize);
      const documents = await Promise.all(
        batch.map(async (file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          webkitRelativePath: '',
          buffer: Buffer.from(await file.arrayBuffer()),
        })),
      );

      const batchResults = extract(documents);
      results.push(...batchResults);

      const percent = Math.round(((i + batchSize) / files.length) * 100);
      progress.value = percent;
      status.textContent = `Processing... ${percent}%`;
    }

    status.textContent = 'Complete!';
    return results;
  }
</script>
```

## Client-Side Similarity

Perform similarity analysis entirely in the browser:

```html
<script type="module">
  import { computeTextSimilarity } from 'undms/browser.js';

  const sourceText = document.getElementById('source').value;
  const referenceTexts = [
    'machine learning artificial intelligence',
    'deep learning neural networks',
    'web development programming',
  ];

  const matches = computeTextSimilarity(sourceText, referenceTexts, 50, 'hybrid');

  console.log('Similarity results:');
  matches.forEach((match) => {
    console.log(`${referenceTexts[match.referenceIndex]}: ${match.similarityPercentage}%`);
  });
</script>
```

## File Type Detection

Use the File API for proper MIME type detection:

```html
<script type="module">
  import { extract } from 'undms/browser.js';

  async function handleFile(file) {
    // Use type from File object
    let mimeType = file.type;

    // Fallback to extension-based detection
    if (!mimeType || mimeType === 'application/octet-stream') {
      mimeType = getMimeTypeFromExtension(file.name);
    }

    const buffer = await file.arrayBuffer();

    const result = extract([
      {
        name: file.name,
        size: file.size,
        type: mimeType,
        lastModified: file.lastModified,
        webkitRelativePath: '',
        buffer: Buffer.from(buffer),
      },
    ]);

    return result[0].documents[0];
  }

  function getMimeTypeFromExtension(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const types = {
      txt: 'text/plain',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
    };
    return types[ext] || 'application/octet-stream';
  }
</script>
```

## Storage Integration

Combine with browser storage:

```html
<script type="module">
  import { extract } from 'undms/browser.js';

  // Cache extracted content in IndexedDB
  const db = await openDB('undms-cache', 1, {
    upgrade(db) {
      db.createObjectStore('documents', { keyPath: 'id' });
    },
  });

  async function extractWithCache(file) {
    const id = `${file.name}-${file.lastModified}`;

    // Check cache
    const cached = await db.get('documents', id);
    if (cached) return cached.content;

    // Extract
    const buffer = await file.arrayBuffer();
    const result = extract([
      {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        webkitRelativePath: '',
        buffer: Buffer.from(buffer),
      },
    ]);

    const content = result[0].documents[0].content;

    // Cache result
    await db.put('documents', { id, content, timestamp: Date.now() });

    return content;
  }

  function openDB(name, version, upgrade) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (e) => upgrade(e.target.result);
    });
  }
</script>
```

## Limitations

Browser usage has some limitations:

- **No native modules** - Uses browser.js bundle
- **Memory limits** - Browser memory constraints apply
- **No file system** - Limited to File API
- **OCR performance** - May be slower than native

## Security Considerations

- Files are processed entirely client-side
- No data leaves the browser
- Use Content Security Policy appropriately
- Validate file types before processing
