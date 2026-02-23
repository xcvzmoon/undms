# Similarity Comparison

Compare documents and text using various similarity algorithms.

## Basic Text Comparison

Compare two text strings:

```ts
import { computeTextSimilarity } from 'undms';

const source = 'the quick brown fox jumps over the lazy dog';
const references = [
  'the quick brown fox jumps over the lazy dog', // exact match
  'a quick brown fox jumps over a lazy dog', // slight variation
  'the slow red fox jumps over the lazy cat', // different
];

const results = computeTextSimilarity(source, references, 30, 'hybrid');

results.forEach((match) => {
  console.log(
    `Reference ${match.referenceIndex}: ${match.similarityPercentage.toFixed(1)}% - "${references[match.referenceIndex]}"`,
  );
});
```

## Document Similarity

Compare full documents against reference texts:

```ts
import { computeDocumentSimilarity } from 'undms';
import * as fs from 'fs';

const pdfBuffer = fs.readFileSync('./essay.pdf');

const result = computeDocumentSimilarity(
  [
    {
      name: 'essay.pdf',
      size: pdfBuffer.length,
      type: 'application/pdf',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: pdfBuffer,
    },
  ],
  [
    'machine learning artificial intelligence',
    'climate change environment',
    'economic policy finance',
  ],
  40,
  'hybrid',
);

const doc = result[0].documents[0];

console.log('Essay matches:');
doc.similarityMatches.forEach((match) => {
  console.log(`  ${match.similarityPercentage.toFixed(1)}% - Reference ${match.referenceIndex}`);
});
```

## Plagiarism Detection

Detect potential plagiarism in student submissions:

```ts
import { computeDocumentSimilarity } from 'undms';
import * as fs from 'fs';

interface PlagiarismResult {
  student: string;
  match: string;
  similarity: number;
}

const referenceSources = [
  'Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed',
  'Deep learning uses neural networks with multiple layers to learn representations of data',
  'Natural language processing enables computers to understand and generate human language',
];

function checkPlagiarism(submissionsDir: string): PlagiarismResult[] {
  const files = fs.readdirSync(submissionsDir);
  const results: PlagiarismResult[] = [];

  for (const file of files) {
    const buffer = fs.readFileSync(submissionsDir + '/' + file);
    const studentName = file.replace('.txt', '');

    const result = computeDocumentSimilarity(
      [
        {
          name: file,
          size: buffer.length,
          type: 'text/plain',
          lastModified: Date.now(),
          webkitRelativePath: '',
          buffer,
        },
      ],
      referenceSources,
      50, // threshold
      'hybrid',
    );

    const matches = result[0].documents[0].similarityMatches;

    for (const match of matches) {
      results.push({
        student: studentName,
        match: referenceSources[match.referenceIndex].substring(0, 30) + '...',
        similarity: match.similarityPercentage,
      });
    }
  }

  return results;
}

const plagiarismResults = checkPlagiarism('./submissions');

console.log('Plagiarism Report:');
plagiarismResults.sort((a, b) => b.similarity - a.similarity);

for (const result of plagiarismResults) {
  const severity =
    result.similarity > 80 ? '🔴 HIGH' : result.similarity > 60 ? '🟡 MEDIUM' : '🟢 LOW';
  console.log(
    `${severity} ${result.student}: ${result.similarity.toFixed(1)}% match with "${result.match}"`,
  );
}
```

## Content Recommendation Engine

Build a simple content recommendation system:

```ts
import { computeTextSimilarity } from 'undms';

interface Article {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

const articles: Article[] = [
  {
    id: '1',
    title: 'Introduction to Python',
    content: 'Python is a high-level programming language...',
    tags: ['python', 'programming', 'tutorial'],
  },
  {
    id: '2',
    title: 'Machine Learning Basics',
    content: 'Machine learning is a subset of artificial intelligence...',
    tags: ['machine-learning', 'ai', 'tutorial'],
  },
  {
    id: '3',
    title: 'Web Development with JavaScript',
    content: 'JavaScript is a versatile programming language for web...',
    tags: ['javascript', 'web', 'programming'],
  },
  {
    id: '4',
    title: 'Deep Learning Networks',
    content: 'Deep learning uses neural networks to model complex patterns...',
    tags: ['deep-learning', 'ai', 'neural-networks'],
  },
  {
    id: '5',
    title: 'Cooking Recipes',
    content: 'This recipe uses fresh ingredients to create a delicious meal...',
    tags: ['cooking', 'food', 'recipes'],
  },
];

function getRecommendations(userArticle: string, threshold = 20): Article[] {
  const articleContents = articles.map((a) => a.content);
  const matches = computeTextSimilarity(userArticle, articleContents, threshold, 'hybrid');

  return matches
    .map((m) => ({
      article: articles[m.referenceIndex],
      score: m.similarityPercentage,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.article);
}

const userReads = 'I am interested in learning neural networks and deep learning algorithms';

const recommendations = getRecommendations(userReads);

console.log('Recommended Articles:');
recommendations.forEach((article) => {
  console.log(`  - ${article.title} (${article.tags.join(', ')})`);
});
```

## Document Clustering

Group similar documents together:

```ts
import { computeTextSimilarity } from 'undms';

interface Document {
  id: string;
  content: string;
}

const documents: Document[] = [
  { id: 'doc1', content: 'Python programming tutorial for beginners' },
  { id: 'doc2', content: 'Advanced JavaScript techniques and patterns' },
  { id: 'doc3', content: 'Python data science and machine learning guide' },
  { id: 'doc4', content: 'Web development with React and JavaScript' },
  { id: 'doc5', content: 'Cooking recipes and food preparation tips' },
  { id: 'doc6', content: 'Machine learning algorithms and applications' },
];

interface Cluster {
  id: number;
  documents: string[];
}

function clusterDocuments(docs: Document[], threshold: number): Cluster[] {
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < docs.length; i++) {
    if (assigned.has(docs[i].id)) continue;

    const cluster: Cluster = {
      id: clusters.length,
      documents: [docs[i].id],
    };
    assigned.add(docs[i].id);

    const contents = docs.map((d) => d.content);

    for (let j = i + 1; j < docs.length; j++) {
      if (assigned.has(docs[j].id)) continue;

      const matches = computeTextSimilarity(
        docs[i].content,
        [docs[j].content],
        threshold,
        'jaccard',
      );

      if (matches.length > 0 && matches[0].similarityPercentage >= threshold) {
        cluster.documents.push(docs[j].id);
        assigned.add(docs[j].id);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

const clusters = clusterDocuments(documents, 30);

console.log('Document Clusters:');
clusters.forEach((cluster) => {
  console.log(`\nCluster ${cluster.id + 1}:`);
  cluster.documents.forEach((docId) => {
    const doc = documents.find((d) => d.id === docId);
    console.log(`  - ${doc?.content.substring(0, 40)}...`);
  });
});
```

## Version Comparison

Compare different versions of a document:

```ts
import { computeTextSimilarity } from 'undms';

interface Version {
  version: string;
  content: string;
}

const versions: Version[] = [
  {
    version: 'v1.0',
    content: 'The quick brown fox jumps over the lazy dog. This is a sample sentence.',
  },
  {
    version: 'v1.1',
    content: 'The quick brown fox jumped over the lazy dog. This is a sample paragraph.',
  },
  {
    version: 'v2.0',
    content: 'The quick red fox jumped over the sleeping dog. This document has been revised.',
  },
  {
    version: 'v3.0',
    content: 'A completely new version of the document with different content entirely.',
  },
];

function compareVersions(versions: Version[]) {
  console.log('Version Comparison Matrix:\n');
  console.log('         ', ...versions.map((v) => v.version.padEnd(10)).join('   '));

  for (let i = 0; i < versions.length; i++) {
    const row = [versions[i].version.padEnd(10)];

    for (let j = 0; j < versions.length; j++) {
      if (i === j) {
        row.push('-'.padEnd(10));
        continue;
      }

      const matches = computeTextSimilarity(
        versions[i].content,
        [versions[j].content],
        0,
        'levenshtein',
      );

      row.push(`${matches[0].similarityPercentage.toFixed(0)}%`.padEnd(10));
    }

    console.log(row.join('   '));
  }
}

compareVersions(versions);
```

## Keyword Extraction

Use similarity to find keywords in a document:

```ts
import { computeTextSimilarity } from 'undms';

const document = `
Python is a high-level programming language that emphasizes code readability.
It supports multiple programming paradigms including procedural, object-oriented,
and functional programming. Python has a comprehensive standard library known
as the "batteries included" philosophy.
`.trim();

const candidates = [
  'python programming language',
  'code readability',
  'object-oriented programming',
  'standard library',
  'functional programming',
  'web development',
  'data science',
  'machine learning',
  'batteries included',
  'syntax',
];

const matches = computeTextSimilarity(document, candidates, 30, 'ngram');

console.log('Keywords extracted (by similarity):');
matches
  .sort((a, b) => b.similarityPercentage - a.similarityPercentage)
  .slice(0, 5)
  .forEach((m) => {
    console.log(`  ${candidates[m.referenceIndex]}: ${m.similarityPercentage.toFixed(1)}%`);
  });
```

## Fuzzy Search

Implement fuzzy search functionality:

```ts
import { computeTextSimilarity } from 'undms';

interface SearchableItem {
  id: string;
  title: string;
  description: string;
}

const items: SearchableItem[] = [
  { id: '1', title: 'Python Tutorial', description: 'Learn Python programming from scratch' },
  { id: '2', title: 'JavaScript Guide', description: 'Master JavaScript development' },
  { id: '3', title: 'Rust Cookbook', description: 'Advanced Rust programming techniques' },
  { id: '4', title: 'TypeScript Basics', description: 'Introduction to TypeScript language' },
  { id: '5', title: 'Go Programming', description: 'Getting started with Go language' },
];

function fuzzySearch(query: string, threshold = 40): SearchableItem[] {
  const searchText = `${query} ${query}`.toLowerCase();
  const searchable = items.map((item) => `${item.title} ${item.description}`.toLowerCase());

  const matches = computeTextSimilarity(searchText, searchable, threshold, 'hybrid');

  return matches
    .sort((a, b) => b.similarityPercentage - a.similarityPercentage)
    .map((m) => items[m.referenceIndex]);
}

// Test searches
const queries = ['python', 'javascript coding', 'programming languages', 'rust', 'typescript'];

for (const query of queries) {
  const results = fuzzySearch(query);
  console.log(`\nSearch: "${query}"`);
  console.log(`Found ${results.length} results:`);
  results.forEach((r) => console.log(`  - ${r.title}: ${r.description}`));
}
```

## Algorithm Comparison

Compare different similarity algorithms:

```ts
import { computeTextSimilarity } from 'undms';

const source = 'artificial intelligence machine learning';

const references = [
  'artificial intelligence machine learning',
  'AI and deep learning',
  'machine learning algorithms',
  'natural language processing',
];

const methods = ['jaccard', 'ngram', 'levenshtein', 'hybrid'] as const;

console.log('Algorithm Comparison:\n');
console.log('Reference'.padEnd(40), ...methods.map((m) => m.padEnd(12)).join(''));
console.log('-'.repeat(80));

for (const ref of references) {
  const row = [ref.substring(0, 38)];

  for (const method of methods) {
    const matches = computeTextSimilarity(source, [ref], 0, method);
    row.push(`${matches[0].similarityPercentage.toFixed(0)}%`.padEnd(12));
  }

  console.log(...row);
}
```
