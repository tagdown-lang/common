import {
  isTagContent,
  isTextContent,
  isTextContents,
  printTag,
  Tag as TagJson,
  TagLayout,
  tagToJson,
} from "@tagdown/core"

export abstract class BaseTag<
  D extends BaseTag<D, A, C>,
  A extends readonly D[],
  C extends readonly (string | D)[],
> implements TagJson
{
  isQuoted: boolean
  isAttribute: boolean
  name: string
  attributes: A
  isLiteral: boolean
  contents: C
  layout?: TagLayout

  abstract attr(path: string[] | string): D | null

  abstract attrs(path: string[] | string): D[]

  abstract tag(path: string[] | string): D | null

  abstract tags(path: string[] | string): D[]

  get text(): string {
    return isTextContents(this.contents) ? this.contents[0] : ""
  }

  getTexts(softLength: number): string {
    let text = ""
    for (const content of this.contents) {
      text += isTagContent(content) ? content.getTexts(softLength) : content
      if (text.length >= softLength) break
    }
    return text
  }

  toBoolean(): boolean {
    return ["true", "yes", "1"].includes(this.text)
  }

  toNumber(): number {
    return parseFloat(this.text) || 0
  }

  toString(): string {
    return printTag(this)
  }

  toDate(): Date {
    const date = new Date(this.text)
    return !isNaN(date.getTime()) ? date : new Date()
  }

  toJSON(): TagJson {
    return tagToJson(this)
  }

  truncate(length: number): string {
    if (length <= 0) return ""
    const text = this.getTexts(length)
    return text.length ? text.slice(0, length - 1) + "…" : ""
  }

  traverse(
    forText: (text: string, index: number, array: C) => void,
    forTag: (tag: D, index: number, array: A | C) => void,
  ): this {
    for (let i = 0; i < this.attributes.length; i++) {
      forTag(this.attributes[i], i, this.attributes)
      this.attributes[i].traverse(forText, forTag)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTextContent(content)) {
        forText(content, i, this.contents)
      } else {
        forTag(content, i, this.contents)
      }
      content = this.contents[i]
      if (isTagContent(content)) {
        content.traverse(forText, forTag)
      }
    }
    return this
  }

  traverseText(forText: (text: string, index: number, array: C) => void): this {
    for (const attr of this.attributes) {
      attr.traverseText(forText)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTextContent(content)) {
        forText(content, i, this.contents)
        content = this.contents[i]
        if (isTagContent(content)) {
          content.traverseText(forText)
        }
      } else {
        content.traverseText(forText)
      }
    }
    return this
  }

  traverseTag(forTag: (tag: D, index: number, array: A | C) => void): this {
    for (let i = 0; i < this.attributes.length; i++) {
      forTag(this.attributes[i], i, this.attributes)
      this.attributes[i].traverseTag(forTag)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTagContent(content)) {
        forTag(content, i, this.contents)
        content = this.contents[i]
        if (isTagContent(content)) {
          content.traverseTag(forTag)
        }
      }
    }
    return this
  }

  traverseAttribute(forAttribute: (attr: D, index: number, array: A | C) => void): this {
    for (let i = 0; i < this.attributes.length; i++) {
      forAttribute(this.attributes[i], i, this.attributes)
      this.attributes[i].traverseAttribute(forAttribute)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTagContent(content)) {
        if (content.isAttribute) forAttribute(content, i, this.contents)
        content = this.contents[i]
        if (isTagContent(content)) {
          content.traverseAttribute(forAttribute)
        }
      }
    }
    return this
  }

  traverseContent(
    forText: (text: string, index: number, array: C) => void,
    forTag: (tag: D, index: number, array: A | C) => void,
  ): this {
    for (const attr of this.attributes) {
      attr.traverseContent(forText, forTag)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTextContent(content)) {
        forText(content, i, this.contents)
      } else {
        forTag(content, i, this.contents)
      }
      content = this.contents[i]
      if (isTagContent(content)) {
        content.traverseContent(forText, forTag)
      }
    }
    return this
  }

  traverseTextContent(forText: (text: string, index: number, array: C) => void): this {
    for (const attr of this.attributes) {
      attr.traverseTextContent(forText)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTextContent(content)) {
        forText(content, i, this.contents)
        content = this.contents[i]
        if (isTagContent(content)) {
          content.traverseTextContent(forText)
        }
      } else {
        content.traverseTextContent(forText)
      }
    }
    return this
  }

  traverseTagContent(forTag: (tag: D, index: number, array: A | C) => void): this {
    for (const attr of this.attributes) {
      attr.traverseTagContent(forTag)
    }
    for (let i = 0; i < this.contents.length; i++) {
      let content = this.contents[i]
      if (isTagContent(content)) {
        forTag(content, i, this.contents)
        content = this.contents[i]
        if (isTagContent(content)) {
          content.traverseTagContent(forTag)
        }
      }
    }
    return this
  }

  abstract clone(): D
}
