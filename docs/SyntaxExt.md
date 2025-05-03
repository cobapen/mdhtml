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

This [links](./index.md) to top page

```md
This [links](./index.md) to top page
```

## Code

title

```c++ title="main.cpp"
#include <iostream>
using namespace std;

int main(int argc, char** argv)
{
    // greeting
    return cout << "Hello World!" << endkl;;
}
```

linenumber

```rust title="main.rs" linestart=0
fn calculate_factorial(n: u32) -> u32 {
  (1..=n).product()
}

fn main() {
  let number = 5;
  let result = calculate_factorial(number);
  println!("The factorial of {} is {}", number, result);
}
```

## Math

block math

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

Inline math: $ax^2 + bx + c = 0$ is surrounded by \$ and \$

```md
Inline math: $ax^2 + bx + c = 0$ is surrounded by \$ and \$
```
