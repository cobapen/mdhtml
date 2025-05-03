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

## Install

```
npm install -g @cobapen/mdhtml
```

node.js &gt; 20.11, 21.2 or later required

## Usage

```
mdhtml <input> [args]
```

**Options**

- `--template`: Specify template file. 
- `--output`: Specify output path