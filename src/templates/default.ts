export const defaultTemplate = 
`<!DOCTYPE html>
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
  --color-background: #f8f8f8;
  --color-link: #1560d2;
  --color-primary: #005796;
  --color-white: #f8f8f8;
  --color-black: #333;
  --color-text: #333;
  --color-code-background: #e8e8e8;
  --color-codeblock-text: #abb2bf;
  --color-codeblock-background: #282c34;
  --max-width-page: 960px;
  --max-width-paragraph: 720px;
}

* {
  box-sizing: inherit;
}

html {
  box-sizing: border-box;
  background-color: var(--color-background);
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
  color: var(--color-codeblock-text);
  background: var(--color-codeblock-background);
}

code {
  font-family: consolas, Menlo, "Liberation Mono", Courier, meiryo, arial, monospace;
  display: inline-block;
  white-space: nowrap;
  padding: 0 0.25rem;
  border-radius: 2px;
  background-color: var(--color-code-background);
}

pre > code {
  display: block;
  padding: 1em;
  line-height: 1.2;
  overflow-x: auto;
  white-space: pre;
  background-color: var(--color-codeblock-background);
  overflow-x: auto;
}

pre > code[class^="language-"] {
  font-family: consolas;
  font-size: calc(16px * 0.85);
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
  background-color: green;
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
  </style>
</head>
<body>
  <div id="wrap">
    {{{content}}}
  </div>
</html>
`;

