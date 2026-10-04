import { defineConfig } from 'vitepress';

export default defineConfig({
  base: '/undms/',
  title: 'undms',
  description: 'Async document text and metadata extraction library',
  appearance: 'dark',
  lastUpdated: true,
  cleanUrls: true,
  head: [
    [
      'link',
      {
        rel: 'icon',
        href: '/undms.png',
      },
    ],
  ],
  themeConfig: {
    logo: '/undms.png',
    siteTitle: 'undms',
    nav: [
      {
        text: 'Guide',
        link: '/guide/getting-started',
        activeMatch: '/guide/',
      },
      {
        text: 'API',
        link: '/api/extract',
        activeMatch: '/api/',
      },
      {
        text: 'Examples',
        link: '/examples/basic-extraction',
        activeMatch: '/examples/',
      },
      {
        text: 'Advanced',
        link: '/advanced/performance',
        activeMatch: '/advanced/',
      },
      {
        text: 'FAQ',
        link: '/faq',
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            {
              text: 'Introduction',
              link: '/guide/getting-started',
            },
            {
              text: 'Supported Formats',
              link: '/guide/supported-formats',
            },
            {
              text: 'Architecture',
              link: '/guide/architecture',
            },
          ],
        },
      ],
      '/api/': [
        {
          text: 'Functions',
          items: [
            {
              text: 'extract',
              link: '/api/extract',
            },
            { text: 'extractBatch', link: '/api/extract-batch' },
            {
              text: 'Type Definitions',
              link: '/api/types',
            },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Basic Usage',
          items: [
            {
              text: 'Basic Extraction',
              link: '/examples/basic-extraction',
            },
            {
              text: 'Metadata Extraction',
              link: '/examples/metadata-extraction',
            },
            {
              text: 'Image Processing',
              link: '/examples/image-processing',
            },
          ],
        },
        {
          text: 'Advanced',
          items: [
            {
              text: 'Batch Processing',
              link: '/examples/batch-processing',
            },
            {
              text: 'Error Handling',
              link: '/examples/error-handling',
            },
          ],
        },
      ],
      '/advanced/': [
        {
          text: 'Topics',
          items: [
            {
              text: 'Performance Optimization',
              link: '/advanced/performance',
            },
            {
              text: 'Extensibility',
              link: '/advanced/extensibility',
            },
          ],
        },
      ],
    },
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/xcvzmoon/undms',
      },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/undms',
      },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Mon Albert Gamil',
    },
    search: {
      provider: 'local',
    },
    outline: {
      level: [2, 3],
    },
  },
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
    lineNumbers: true,
  },
});
