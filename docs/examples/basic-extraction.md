# Basic extraction

```ts
import { readFile } from 'node:fs/promises';
import { extract } from 'undms';

const outcome = await extract({
  data: await readFile('report.pdf'),
  name: 'report.pdf',
});

if (outcome.status === 'error') {
  console.error(outcome.error.code, outcome.error.message);
} else {
  console.log(outcome.result.text);
  console.log(outcome.result.metadata);
  console.log(outcome.result.warnings);
}
```
