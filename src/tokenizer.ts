import { mergesBinary, vocabularyBase64 } from './constants'
import { PriorityQueue } from './priority_queue'
import { decodeBase64, hexToUtf8Byte, utf8ByteToHex } from './utils'

const utf8Decoder = new TextDecoder('utf-8')
const utf8Encoder = new TextEncoder()

type TokenId = number

class Data {
  static #vocabById: ReadonlyArray<string>
  static #vocabByString: Map<string, TokenId>
  static #merges: Map<string, TokenId>

  private constructor() {}

  private static get vocabById() {
    if (!Data.#vocabById) {
      Data.#vocabById = Data.#decodeVocabulary(vocabularyBase64)
    }

    return Data.#vocabById
  }

  static getVocabById(id: TokenId) {
    return this.vocabById[id]
  }

  private static get vocabByString() {
    if (!Data.#vocabByString) {
      Data.#vocabByString = new Map<string, TokenId>()
      Data.vocabById.forEach((tokenString, tokenId) => {
        Data.#vocabByString.set(tokenString, tokenId)
      })
    }

    return Data.#vocabByString
  }

  static getVocabByString(tokenString: string) {
    return this.vocabByString.get(tokenString)
  }

  private static get merges() {
    if (!Data.#merges) {
      Data.#merges = Data.#decompressMerges(mergesBinary)
    }

    return Data.#merges
  }

  static getMergeByIdentifierString(mergeIdentifierString: string) {
    return Data.merges.get(mergeIdentifierString)
  }

  /**
   * Helper function to decode the vocabulary.
   *
   * vocab_base64 is base64-encoded string of tokens delimited by '\n' (line break) in utf-8.
   * The row number of the token (indexing from 0) represents the id of the token in mistral tokenizer.
   *
   * Most tokens look like this: "ic" (without the quotes) (representing the "i" character followed by the "c" character)
   * Some tokens are special. In particular, spaces are replaced with the "▁" character and line-break is represented as "<0x0A>".
   *
   * This helper function returns the vocabulary as an array that contains Strings representing tokens:
   *
   *  "<unk>"   // Special token: unknown token
   *  "<s>"     // Special token: beginning of string
   *  "</s>"    // Special token: end of string
   *  "<0x00>"  // Byte-level token representing the 0-byte
   *  "<0x01>"  // Byte-level token ...
   *  "<0x02>"  // Byte-level token ...
   *  ...       // More byte-level tokens
   *  "<0x0A>"  // Byte-level token representing '\n' (line break). This is one of the few byte-level tokens that appear to be actually needed in practice.
   *  ...       // More byte-level tokens
   *  "<0xFF>"  // Byte-level token ...
   *  "▁▁"     // Token representing 2 consecutive spaces.
   *  "▁t"     // Token representing the space character followed by the "t" character.
   *  "er"      // Token representing the "e" character followed by the "r" character. Most tokens look like this.
   *  ...       // 32000 tokens
   */
  static #decodeVocabulary(vocabulary: string) {
    const byteArray = Uint8Array.from(decodeBase64(vocabulary), (c) => c.charCodeAt(0))
    return utf8Decoder.decode(byteArray).split('\n')
  }

  static #decompressMerges(binary: string) {
    // Base64 decode binary.
    const byteArrayString = decodeBase64(binary)

    // Convert byteArrayString to byteArray.
    const byteArray = new Uint8Array(byteArrayString.length)
    for (let i = 0; i < byteArrayString.length; i++) {
      byteArray[i] = byteArrayString.charCodeAt(i)
    }

    // Each byte-pair represents a tokenId.
    // Convert byte-pairs to tokenIds (integers between 0 and 32000).
    const tokenIds = []

    for (let i = 0; i < byteArray.length; i += 2) {
      const byte1 = byteArray[i]
      const byte2 = byteArray[i + 1]
      const tokenId = byte1 + (byte2 << 8)
      tokenIds.push(tokenId)
    }

    const merges = new Map<string, TokenId>()

    // Each pair of tokenIds represents a merge.
    for (let i = 0; i < tokenIds.length; i += 2) {
      const id1 = tokenIds[i]
      const id2 = tokenIds[i + 1]
      const mergeIdentifierString = this.getMergeIdentifierString(id1, id2)
      // Key identifies token pair, value represents merge priority.
      merges.set(mergeIdentifierString, i + 1)
    }

    return merges
  }

  static getMergeIdentifierString(firstTokenId: TokenId, secondTokenId: TokenId) {
    return `${this.getVocabById(firstTokenId)} ${this.getVocabById(secondTokenId)}`
  }

  static mapCharactersToTokenIds(prompt: string, addBosToken: boolean, addPrecedingSpace: boolean) {
    const tokenIds: Array<TokenId> = []

    // Special "beginning of string" token.
    if (addBosToken) {
      tokenIds.push(1)
    }

    // Special: spaces are represented as thick underscore ▁ (id 28705).
    const promptAltered = (
      addPrecedingSpace
        ? ` ${prompt}` // Special "preceding space" added to beginning of prompt.
        : prompt
    ).replaceAll(' ', this.getVocabById(28705))

    // We need to use Array.from to iterate over characters in order to support UTF-8 multipoint characters.
    const charArray = Array.from(promptAltered)

    // Transform each character to its corresponding token.
    for (const c of charArray) {
      const id = this.getVocabByString(c)

      if (id) {
        // Typical case
        tokenIds.push(id)
      } else {
        // Special case where token not found and we have to fallback to byte-level tokens.
        const bytes = utf8Encoder.encode(c)

        for (const byte of bytes) {
          const hex = this.getVocabByString(utf8ByteToHex(byte))

          if (hex) {
            tokenIds.push(hex)
          } else {
            // This is not supposed to happen because the mistral vocabulary has a token corresponding to each byte,
            // but if this happens regardless, let's follow the protocol and tokenize to <UNK> token instead of crashing.
            console.log(
              `Encountered unknown character ${c} (partial UTF-8 byte ${byte} + hex + ${utf8ByteToHex(byte)})`,
            )

            tokenIds[tokenIds.length - 1] = 0
          }
        }
      }
    }

    return tokenIds
  }
}

type TokenNode = {
  origPos: number
  tokenId: number
  prev: TokenNode | null
  next: TokenNode | null
  mergePrio?: number
  mergeToString?: string
  deleted?: boolean
}

export class MistralTokenizer {
  constructor(readonly shouldTrackPerformance: boolean = false) {}

  encode(prompt: string, addBosToken: boolean = true, addPrecedingSpace: boolean = true): ReadonlyArray<TokenId> {
    const startTime = this.shouldTrackPerformance ? performance.now() : 0

    if (prompt.length === 0) {
      return []
    }

    // Initially each character is transformed to a tokenId, later there will be merges of these.
    const tokenIds = Data.mapCharactersToTokenIds(prompt, addBosToken, addPrecedingSpace)

    // Set up priority queue to efficiently iterate merge possibilities in priority order.
    const mergeQueue = new PriorityQueue<TokenNode>((a, b) => {
      if (!a.mergePrio || !b.mergePrio) {
        return false
      }
      return a.mergePrio < b.mergePrio
    })

    const addToMergeQueue = (leftNode: TokenNode) => {
      if (leftNode.next) {
        const mergeIdentifierString = Data.getMergeIdentifierString(leftNode.tokenId, leftNode.next.tokenId)

        // Merge priority is primarily determined by the location of the merge in the "merges" data,
        // secondarily determined by the relative position of the node in the linked list
        // (We want to perform equal merges from left to right).
        const mergeLocation = Data.getMergeByIdentifierString(mergeIdentifierString)

        // If mergeLocation not found in merges, that means this merge is not possible according to vocabulary.
        if (mergeLocation) {
          const mergePrio = mergeLocation + leftNode.origPos / prompt.length
          leftNode.mergePrio = mergePrio
          leftNode.mergeToString = mergeIdentifierString.replace(' ', '')
          mergeQueue.push(leftNode)
        }
      }
    }

    // Fill merge queue from initial merge possibilities and construct linked list.
    let firstTokenNode: TokenNode = {
      origPos: 0,
      tokenId: tokenIds[0],
      prev: null,
      next: null,
    }

    let prevTokenNode = firstTokenNode
    for (let i = 1; i < tokenIds.length; i++) {
      const currTokenNode = {
        origPos: i,
        tokenId: tokenIds[i],
        prev: prevTokenNode,
        next: null,
      }
      prevTokenNode.next = currTokenNode
      addToMergeQueue(prevTokenNode)
      prevTokenNode = currTokenNode
    }

    // Perform merges in priority order.
    while (!mergeQueue.isEmpty()) {
      const leftOfMerge = mergeQueue.pop()

      // Check that this merge is still possible.
      if (!leftOfMerge || leftOfMerge.deleted || !leftOfMerge.next || leftOfMerge.next.deleted) {
        continue
      }

      // Mark leftOfMerge and rightOfMerge as being deleted, because they are actually being replaced by a merged token.
      leftOfMerge.deleted = true
      leftOfMerge.next.deleted = true

      // It's a little bit more complicated to fix the prev of leftOfMerge.

      if (leftOfMerge.prev) {
        const oldPrev = leftOfMerge.prev
        // Mark oldPrev as deleted, to avoid erroneous merges later (ref to this node might exist in priorityqueue).
        oldPrev.deleted = true
        // Replace oldPrev within the linked list with a copy of itself.
        const newPrev: TokenNode = {
          origPos: oldPrev.origPos,
          tokenId: oldPrev.tokenId,
          prev: oldPrev.prev,
          next: oldPrev.next,
        }

        leftOfMerge.prev = newPrev
        // Update linked list reference of "prev of prev".
        if (newPrev.prev) {
          newPrev.prev.next = newPrev
        } else {
          // If "prev of prev" does not exist, that means newPrev must be the new firstNode.
          firstTokenNode = newPrev
        }
      }

      if (leftOfMerge.mergeToString) {
        const tokenId = Data.getVocabByString(leftOfMerge.mergeToString)

        if (tokenId) {
          // Create node representing merge result.
          const resultOfMerge: TokenNode = {
            origPos: leftOfMerge.origPos,
            tokenId,
            prev: leftOfMerge.prev,
            next: leftOfMerge.next.next,
          }

          // Consider adding to merge queue: prev--resultOfMerge.
          if (resultOfMerge.prev) {
            resultOfMerge.prev.next = resultOfMerge
            resultOfMerge.prev
            addToMergeQueue(resultOfMerge.prev)
          } else {
            // If prev does not exist then this is the new firstNode.
            firstTokenNode = resultOfMerge
          }

          // Consider adding to merge queue: resultOfMerge--next.
          if (resultOfMerge.next) {
            resultOfMerge.next.prev = resultOfMerge

            addToMergeQueue(resultOfMerge)
          }
        }
      }
    }

    // Get final tokenIds by traversing the linked list.
    const mergedTokenIds: Array<TokenId> = []

    for (
      let currTokenNode: TokenNode | null = firstTokenNode;
      currTokenNode !== null;
      currTokenNode = currTokenNode.next
    ) {
      mergedTokenIds.push(currTokenNode.tokenId)
    }

    if (this.shouldTrackPerformance) {
      const endTime = performance.now()
      console.log(`encode() took ${endTime - startTime} milliseconds.`)
    }

    return mergedTokenIds
  }

  decode(tokenIds: ReadonlyArray<TokenId>, addBosToken: boolean = true, addPrecedingSpace: boolean = true): string {
    const utf8byteVals: Array<number> = []
    const startIndex = addBosToken ? 1 : 0

    for (let i = startIndex; i < tokenIds.length; i++) {
      const tokenId = tokenIds[i]
      const tokenString = Data.getVocabById(tokenId)

      if (tokenString.startsWith('<0x') && tokenString.endsWith('>')) {
        // Special case.
        const utf8byte = hexToUtf8Byte(tokenString)
        utf8byteVals.push(utf8byte)
      } else {
        // Typical case.
        const utf8bytes = utf8Encoder.encode(tokenString)
        utf8bytes.forEach((utf8Byte) => utf8byteVals.push(utf8Byte))
      }
    }

    const uint8Array = new Uint8Array(utf8byteVals)
    const decodedString = utf8Decoder.decode(uint8Array)
    const spacesFixed = decodedString.replaceAll(Data.getVocabById(28705), ' ')

    // Note that preceding space must be removed here at string level, not earlier at token level, because multiple consecutive spaces are represented as single token.
    return addPrecedingSpace ? spacesFixed.slice(1) : spacesFixed
  }
}
