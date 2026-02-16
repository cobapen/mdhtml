export const defaultTemplate = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    
:root {
  --font-family: -apple-system, BlinkMacSystemFont, Helvetica Neue, Segoe UI, BIZ UDPGothic, Meiryo, Hiragino Kaku Gothic ProN, sans-serif;
  --font-size: 0.9rem;
  --line-height: 1.625;
  --color-background: #fcfcfc;
  --color-line: #ccc;
  --color-link: #1560d2;
  --color-primary: #005796;
  --color-white: #fcfcfc;
  --color-black: #333;
  --color-text: #333;
  --color-code-background: #eaeaec;
  --color-codeblock-text: #abb2bf;
  --color-codeblock-background: #282c34;
  --max-width-page: 960px;
  --max-width-paragraph: 720px;
  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;
}

* {
  box-sizing: inherit;
}

html {
  box-sizing: border-box;
  background-color: var(--color-background);
  scrollbar-gutter: stable;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size);
  line-height: var(--line-height);
  color: var(--color-text);
}

div#wrap {
  max-width: var(--max-width-page);
  margin: 0 auto;
  padding: 0 1rem;
}

p, pre {
  max-width: var(--max-width-paragraph);
}

pre {
  position: relative;
  border: 1px solid var(--color-line);
  background-color: var(--color-code-background);
}

code {
  font-family: consolas, Menlo, "Liberation Mono", Courier, meiryo, arial, monospace;
}

:not(pre) > code {
  display: inline-block;
  white-space: nowrap;
  padding: 0 0.25rem;
  border-radius: var(--radius-sm);
  background-color: var(--color-code-background);
}

pre > code {
  display: block;
  padding: 1em;
  line-height: 1.2;
  overflow-x: auto;
  white-space: pre;
  overflow-x: auto;
}

pre > code[class^="language-"] {
  color: var(--color-codeblock-text);
  background-color: var(--color-codeblock-background);
  font-size: 0.85rem;
}

pre > span.title {
  position: absolute;
  visibility: visible !important;
  top: 0;
  right: 0;
  display: inline-block;
  padding: 0.25em 0.5em;
  background-color: gray;
  color: #f0f0f0;
  border-bottom-left-radius: 0.5rem;
}

table {
  max-width: var(--max-width-paragraph);
  overflow-x: auto;
  border: 1px solid var(--color-code-background);
  border-radius: var(--radius-md);
  border-collapse: separate;
  border-spacing: 0;
  background-color: var(--color-background);
}

table.centered {
  text-align: center;
}

caption {
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  text-align: left;
}

thead th {
  background-color: var(--color-primary);
  color: var(--color-white);
  text-align: left;
}

th, td {
  padding: 0.5rem 0.75rem;
  vertical-align: top;
  border-top: 1px solid var(--color-line);
  border-left: 1px solid var(--color-line);
}

th *:first-child,
td *:first-child {
  margin-top: 0;
}

th *:last-child,
td *:last-child {
  margin-bottom: 0;
}

th:last-child,
td:last-child {
  border-right: 1px solid var(--color-line);
}

tbody tr:last-child th,
tbody tr:last-child td {
  border-bottom: 1px solid var(--color-line);
}

tr:nth-child(even) td {
  background: #fff;
}

thead tr:first-child th:first-child {
  border-top-left-radius: var(--radius-md);
}

thead tr:first-child th:last-child {
  border-top-right-radius: var(--radius-md);
}

tbody tr:last-child td:first-child {
  border-bottom-left-radius: var(--radius-md);
}

tbody tr:last-child td:last-child {
  border-bottom-right-radius: var(--radius-md);
}
.hljs {
  background: #1E1E1E;
  color: #DCDCDC;
}

.hljs-keyword,
.hljs-literal,
.hljs-symbol,
.hljs-name {
  color: #569CD6;
}
.hljs-link {
  color: #569CD6;
  text-decoration: underline;
}

.hljs-built_in,
.hljs-type {
  color: #4EC9B0;
}

.hljs-number,
.hljs-class {
  color: #B8D7A3;
}

.hljs-string,
.hljs-meta .hljs-string {
  color: #D69D85;
}

.hljs-regexp,
.hljs-template-tag {
  color: #9A5334;
}

.hljs-subst,
.hljs-function,
.hljs-title,
.hljs-params,
.hljs-formula {
  color: #DCDCDC;
}

.hljs-comment,
.hljs-quote {
  color: #57A64A;
  font-style: italic;
}

.hljs-doctag {
  color: #608B4E;
}

.hljs-meta,
.hljs-meta .hljs-keyword,

.hljs-tag {
  color: #9B9B9B;
}

.hljs-variable,
.hljs-template-variable {
  color: #BD63C5;
}

.hljs-attr,
.hljs-attribute {
  color: #9CDCFE;
}

.hljs-section {
  color: gold;
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: bold;
}

/*.hljs-code {
  font-family:'Monospace';
}*/

.hljs-bullet,
.hljs-selector-tag,
.hljs-selector-id,
.hljs-selector-class,
.hljs-selector-attr,
.hljs-selector-pseudo {
  color: #D7BA7D;
}

.hljs-addition {
  background-color: #144212;
  display: inline-block;
  width: 100%;
}

.hljs-deletion {
  background-color: #600;
  display: inline-block;
  width: 100%;
}
    {{{mathcss}}}
  </style>
</head>
<body>
  <div id="wrap">
    {{{content}}}
  </div>
</html>
`;

