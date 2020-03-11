import heroku from './images/frames/heroku-logo.svg'
import blank from './images/frames/blank-sticker.svg'
import clojure from './images/frames/clojure.svg'
import goGopher from './images/frames/go-gopher.svg'
import javaDuke from './images/frames/java-duke.svg'
import nodeJs from './images/frames/node-js.svg'
import php from './images/frames/php.svg'
import python from './images/frames/python.svg'

import ruby from './images/frames/ruby.svg'
import scala from './images/frames/scala.svg'


const baseType1 = {
  shrink: 0.85,
  ratio: 1/1.2, // height/width
  left: 0.08,
  top: 0.08
}

const frames = {
  'heroku-logo': {
    src: heroku,
    ...baseType1
  },
  'blank-sticker': {
    src: blank,
    ...baseType1
  },
  'clojure': {
    src: clojure,
    ...baseType1
  },
  'go-gopher': {
    src: goGopher,
    ...baseType1
  },
  'java-duke': {
    src: javaDuke,
    ...baseType1
  },
  'node-js': {
    src: nodeJs,
    ...baseType1
  },
  'php': {
    src: php,
    ...baseType1
  },
  'python': {
    src: python,
    ...baseType1
  },
  'ruby': {
    src: ruby,
    ...baseType1
  },
  'scala': {
    src: scala,
    ...baseType1
  }
}


export default {
  ...frames
}
