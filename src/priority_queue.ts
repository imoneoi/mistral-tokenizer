// PriorityQueue implementation is copied from https://stackoverflow.com/a/42919752 with minor refactoring.
export class PriorityQueue<T> {
  #heap: Array<T> = []
  #comparator: (a: T, b: T) => boolean

  constructor(comparator: (a: T, b: T) => boolean = (a, b) => a > b) {
    this.#heap = []
    this.#comparator = comparator
  }

  size(): number {
    return this.#heap.length
  }

  isEmpty(): boolean {
    return this.size() === 0
  }

  peek(): T | undefined {
    return this.#heap[0]
  }

  push(...values: Array<T>): number {
    values.forEach((value) => {
      this.#heap.push(value)
      this.#siftUp()
    })
    return this.size()
  }

  pop(): T | undefined {
    const poppedValue = this.peek()
    const bottom = this.size() - 1
    if (bottom > 0) {
      this.#swap(0, bottom)
    }
    this.#heap.pop()
    this.#siftDown()
    return poppedValue
  }

  replace(value: T): T | undefined {
    const replacedValue = this.peek()
    this.#heap[0] = value
    this.#siftDown()
    return replacedValue
  }

  #parent(i: number): number {
    return ((i + 1) >>> 1) - 1
  }

  #left(i: number): number {
    return (i << 1) + 1
  }

  #right(i: number): number {
    return (i + 1) << 1
  }

  #greater(i: number, j: number): boolean {
    return this.#comparator(this.#heap[i], this.#heap[j])
  }

  #swap(i: number, j: number): void {
    ;[this.#heap[i], this.#heap[j]] = [this.#heap[j], this.#heap[i]]
  }

  #siftUp(): void {
    let node = this.size() - 1
    while (node > 0 && this.#greater(node, this.#parent(node))) {
      this.#swap(node, this.#parent(node))
      node = this.#parent(node)
    }
  }

  #siftDown() {
    let node = 0
    while (
      (this.#left(node) < this.size() && this.#greater(this.#left(node), node)) ||
      (this.#right(node) < this.size() && this.#greater(this.#right(node), node))
    ) {
      const maxChild =
        this.#right(node) < this.size() && this.#greater(this.#right(node), this.#left(node))
          ? this.#right(node)
          : this.#left(node)
      this.#swap(node, maxChild)
      node = maxChild
    }
  }
}
