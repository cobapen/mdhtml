# Markdown: Syntax Extensions

## TOC

[[toc]]

```md
[[toc]]
```

## DefList

Word1
:   Definition of word 1

Word2
:   Definition of word 2

```md
Word1
:   Definition of word 1

Word2
:   Definition of word 2
```

## Footnote

This line has a footnote[^ref]

[^ref]: this is footnote

```md
This line has a footnote[^ref]

[^ref]: this is footnote
```

## Link-Rewrite

This [links](./index.md) to top page (Rewrites .md to .html)

```md
This [links](./index.md) to top page (Rewrites .md to .html)
```

## Code

title, linenumber

```rust title="main.rs" linestart=1
fn calculate_factorial(n: u32) -> u32 {
  (1..=n).product()
}

fn main() {
  let number = 5;
  let result = calculate_factorial(number);
  println!("The factorial of {} is {}", number, result);
}
```

``````md
```rust title="main.rs" linestart=1
fn calculate_factorial(n: u32) -> u32 {
  (1..=n).product()
}

fn main() {
  let number = 5;
  let result = calculate_factorial(number);
  println!("The factorial of {} is {}", number, result);
}
```
``````

## Table (GFM)

| Item   | Status | Note        |
|--------|--------|-------------|
| Task A | Done   | Completed   |
| Task B | Doing  | In progress |
| Task C | Todo   | Not started |

```md
| Item   | Status | Note        |
|--------|--------|-------------|
| Task A | Done   | Completed   |
| Task B | Doing  | In progress |
| Task C | Todo   | Not started |
```

## Table (FlatTable)

[Syntax](https://www.npmjs.com/package/markdown-it-adv-table)

```table width=50% cols="15,15,30" header-cols=1 header-rows=2
r2^| Name
c2^| Score

| Math
| English

| Alice
| 90
| 85

| Bob
| 78
| 88
```

``````md
```table width=50% cols="15,15,30" header-cols=1 header-rows=2
r2^| Name
c2^| Score

| Math
| English

| Alice
| 90
| 85

| Bob
| 78
| 88
```
``````

## Math

### Block math

$$
\begin{align}
    \nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} & = \frac{4\pi}{c}\vec{\mathbf{j}} \\
    \nabla \cdot \vec{\mathbf{E}} & = 4 \pi \rho \\
    \nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} & = \vec{\mathbf{0}} \\
    \nabla \cdot \vec{\mathbf{B}} & = 0
\end{align}
$$

```md
$$
\begin{align}
    \nabla \times \vec{\mathbf{B}} -\, \frac1c\, \frac{\partial\vec{\mathbf{E}}}{\partial t} & = \frac{4\pi}{c}\vec{\mathbf{j}} \\
    \nabla \cdot \vec{\mathbf{E}} & = 4 \pi \rho \\
    \nabla \times \vec{\mathbf{E}}\, +\, \frac1c\, \frac{\partial\vec{\mathbf{B}}}{\partial t} & = \vec{\mathbf{0}} \\
    \nabla \cdot \vec{\mathbf{B}} & = 0
\end{align}
$$
```

### Inline math
 
$ax^2 + bx + c = 0$ is surrounded by \$ and \$

```md
Inline math:  
$ax^2 + bx + c = 0$ is surrounded by \$ and \$
```

### Extensions 

**mhchem and physics**

$\ce{CO2 + C -> 2CO}$

$\pu{5 mol.L^-1} \times \pu{2 L} = \pu{10 mol}$

$\Delta f = \laplacian f = \pdv[2]{f}{x} + \pdv[2]{f}{y} + \pdv[2]{f}{z}$

```md
$\ce{CO2 + C -> 2CO}$

$\pu{5 mol.L^-1} \times \pu{2 L} = \pu{10 mol}$

$\Delta f = \laplacian f = \pdv[2]{f}{x} + \pdv[2]{f}{y} + \pdv[2]{f}{z}$
```
