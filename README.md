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
- Watch changes and convert

## Install

```
npm install -g @cobapen/mdhtml
```

node.js &gt; 20.11, 21.2 or later required

## Usage

```
mdhtml <input> --template _template.html --output <output>
```

- `--output <path>`: Specify output file/folder (Default: outupt)
- `--template <file>`: Specify output folder (Default: _template.html)
- `--clean`: Clean output folder before conversion
- `--quiet`: Enable quiet mode and suppress conversion messages
- `--watch`: Enable watch mode and monitor filesystem changes
- `--math <path>`: Generate mathjax css file (Default: math.css)  
    - `+:full` to disable adaptiveCSS)
