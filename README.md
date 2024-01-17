# 🌬️ mistral-tokenizer-ts 🌬️

This repository is a TypeScript fork of [`mistral-tokenizer-js`](https://github.com/imoneoi/mistral-tokenizer), initially developed by [imoneoi]().

It is designed to maintain the core functionality of the tokenizer while leveraging the advantages of TypeScript for better type safety and developer experience. 

Please refer to the original repository for more context and the foundational work behind the tokenizer.

## Install

```sh
npm install mistral-tokenizer-ts
```

## Usage

```ts
import { MistralTokenizer } from 'mistral-tokenizer-ts'

const tokenizer = new MistralTokenizer()

// Encode.
const tokens = tokenizer.encode('Hello world!')

// Decode.
const decoded = tokenizer.decode([1, 22557, 1526, 28808])
```

## Tests

```sh
npm run test
```

## Credit

* [`@imoneoi`](https://github.com/imoneoi)
