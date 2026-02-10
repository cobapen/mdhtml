# mdhtml

mdhtml is a cli tool to convert markdown to html. 

```bash
mdhtml input.md --template template.html
```

When a folder is specified as a source, the tool converts all .md files into .html. 

## Features

- Frontend of @cobapen/markdown
- Swappable template file
- Simple static site generator
- Watch mode

## Install

```
npm install -g @cobapen/mdhtml
```

node.js &gt; 20.11, 21.2 or later required

## Usage

```
mdhtml <input> --template _template.html --output <output>
```

- `--output <path>`: Specify output file/folder
- `--template <file>`: Specify template file or name
- `--config <file>`: Load config JSON file
- `--ignore <pattern>`: Ignored files (glob/path). 
- `--clean`: Clean output folder before conversion
- `--quiet`: Enable quiet mode and suppress conversion messages
- `--watch`: Enable watch mode and monitor filesystem changes
- `--math <path>`: Generate mathjax css file
- `--math-font-url <path>`: Change mathjax fontURL

### Config File Example

```json
{
  "output": "public",
  "template": "_template.html",
  "clean": true,
  "ignore": ["node_modules/**", "**/*.tmp"],
  "math": "css/math.css",
  "math-font-url": "./fonts"
}
```
