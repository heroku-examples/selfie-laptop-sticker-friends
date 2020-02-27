import srcFrame1 from './images/frame-01.svg'

const baseType1 = {
  shrink: 0.85,
  ratio: 1/1.2, // height/width
  left: 0.08,
  top: 0.08
}

const frames = {
  'frame-01': {
    src: srcFrame1,
    ...baseType1
  },
  'frame-02': {
    src: srcFrame1,
    ...baseType1
  },
  'frame-03': {
    src: srcFrame1,
    ...baseType1
  }
}


export default {
  ...frames
}
